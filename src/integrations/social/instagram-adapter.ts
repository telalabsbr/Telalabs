import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import {
  accessTokenFromContext,
  issueMediaDeliveryUrl,
  loadRuntimePublicationContext,
  revokeMediaDeliveryUrls,
} from "./runtime-context";
import { classifyMetaFailure, metaGraphRequest, type MetaResponse } from "./meta-http";
import type {
  PublicationWorkerJob,
  PublishAdapter,
  PublishAdapterResult,
  ReconcileAdapterResult,
} from "./provider-registry";

type ContainerCreated = { id?: string };
type ContainerStatus = { id?: string; status_code?: string; status?: string };
type PublishedMedia = { id?: string };
type UnknownPublishAttempt = {
  error_code: string | null;
  provider_request_id: string | null;
  started_at: string;
};

const REEL_MAX_BYTES = 1024 * 1024 * 1024;
const REEL_MIN_DURATION_MS = 3_000;
const REEL_MAX_DURATION_MS = 15 * 60 * 1000;

function wait(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function invalidContent(message: string, code: string): PublishAdapterResult {
  return {
    outcome: "INVALID_CONTENT",
    errorCode: code,
    errorMessageSafe: message,
  };
}

function preflightMedia(media: NonNullable<Awaited<ReturnType<typeof loadRuntimePublicationContext>>["media"]>) {
  if (media.processing_status !== "READY" || !media.object_key) {
    return invalidContent("A mídia ainda não está pronta para publicação.", "MEDIA_NOT_READY");
  }

  if (media.mime_type.startsWith("video/")) {
    if (!["video/mp4", "video/quicktime"].includes(media.mime_type)) {
      return invalidContent("Para Reels, envie um arquivo MP4 ou MOV.", "INSTAGRAM_REEL_FORMAT");
    }
    if (media.size_bytes > REEL_MAX_BYTES) {
      return invalidContent("O Reel ultrapassa o limite de 1 GB aceito por esta integração do Instagram.", "INSTAGRAM_REEL_SIZE");
    }
    if (media.duration_ms !== null && (
      media.duration_ms < REEL_MIN_DURATION_MS || media.duration_ms > REEL_MAX_DURATION_MS
    )) {
      return invalidContent("O Reel precisa ter entre 3 segundos e 15 minutos.", "INSTAGRAM_REEL_DURATION");
    }
    if (media.width !== null && media.width > 1920) {
      return invalidContent("O Reel ultrapassa a largura máxima suportada pela publicação via API.", "INSTAGRAM_REEL_WIDTH");
    }
    return null;
  }

  if (media.mime_type.startsWith("image/")) {
    if (media.mime_type !== "image/jpeg") {
      return invalidContent("A publicação de imagem do Instagram precisa usar JPEG nesta primeira integração.", "INSTAGRAM_IMAGE_FORMAT");
    }
    return null;
  }

  return invalidContent("Este tipo de mídia ainda não é suportado no Instagram.", "INSTAGRAM_MEDIA_TYPE");
}

async function existingContainer(postTargetId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");

  const result = await admin
    .from("provider_assets")
    .select("id,provider_asset_id,state,metadata,created_at")
    .eq("post_target_id", postTargetId)
    .eq("provider", "instagram")
    .eq("kind", "CONTAINER")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function latestUnknownPublishAttempt(postTargetId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");

  const result = await admin
    .from("publication_attempts")
    .select("error_code,provider_request_id,started_at")
    .eq("post_target_id", postTargetId)
    .eq("operation", "PUBLISH")
    .eq("outcome", "UNKNOWN")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  return result.data as UnknownPublishAttempt | null;
}

async function rememberContainer(args: {
  organizationId: string;
  postTargetId: string;
  containerId: string;
  mediaType: "IMAGE" | "REELS";
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");

  const result = await admin.from("provider_assets").upsert({
    organization_id: args.organizationId,
    post_target_id: args.postTargetId,
    provider: "instagram",
    provider_asset_id: args.containerId,
    kind: "CONTAINER",
    state: "PROCESSING",
    metadata: {
      media_type: args.mediaType,
      created_by: "instagram_adapter",
    },
  }, {
    onConflict: "provider,provider_asset_id",
  });

  if (result.error) throw new Error(result.error.message);
}

async function rememberPublishedMedia(args: {
  organizationId: string;
  postTargetId: string;
  mediaId: string;
  containerId?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");

  const result = await admin.from("provider_assets").upsert({
    organization_id: args.organizationId,
    post_target_id: args.postTargetId,
    provider: "instagram",
    provider_asset_id: args.mediaId,
    kind: "MEDIA",
    state: "PUBLISHED",
    metadata: {
      source_container_id: args.containerId ?? null,
      reconciled: true,
    },
  }, {
    onConflict: "provider,provider_asset_id",
  });

  if (result.error) throw new Error(result.error.message);
}

async function markContainerPublished(args: {
  providerAssetRowId: string;
  organizationId: string;
  postTargetId: string;
  containerId: string;
  mediaId: string;
  previousMetadata: Json;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");

  const metadata = (
    args.previousMetadata && typeof args.previousMetadata === "object" && !Array.isArray(args.previousMetadata)
      ? args.previousMetadata
      : {}
  ) as Record<string, Json | undefined>;

  const update = await admin.from("provider_assets").update({
    state: "PUBLISHED",
    metadata: {
      ...metadata,
      published_media_id: args.mediaId,
      published_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  }).eq("id", args.providerAssetRowId);

  if (update.error) throw new Error(update.error.message);

  const mediaAsset = await admin.from("provider_assets").upsert({
    organization_id: args.organizationId,
    post_target_id: args.postTargetId,
    provider: "instagram",
    provider_asset_id: args.mediaId,
    kind: "MEDIA",
    state: "PUBLISHED",
    metadata: {
      source_container_id: args.containerId,
    },
  }, {
    onConflict: "provider,provider_asset_id",
  });

  if (mediaAsset.error) throw new Error(mediaAsset.error.message);
}

async function containerStatus(containerId: string, accessToken: string) {
  return metaGraphRequest<ContainerStatus>({
    path: `/${encodeURIComponent(containerId)}`,
    accessToken,
    params: { fields: "status_code,status" },
  });
}

async function publishedMedia(mediaId: string, accessToken: string) {
  return metaGraphRequest<PublishedMedia>({
    path: `/${encodeURIComponent(mediaId)}`,
    accessToken,
    params: { fields: "id" },
  });
}

function publishedIdFromMetadata(metadata: Json) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata.published_media_id;
  return typeof value === "string" ? value : null;
}

function reconcileMetaFailure(response: MetaResponse<unknown>): ReconcileAdapterResult {
  const classified = classifyMetaFailure(response);

  if (
    classified.outcome === "AUTH_REQUIRED" ||
    classified.outcome === "RATE_LIMIT" ||
    classified.outcome === "TRANSIENT_FAILURE"
  ) {
    return {
      outcome: classified.outcome,
      providerRequestId: classified.providerRequestId,
      httpStatus: classified.httpStatus,
      errorCode: classified.errorCode,
      errorMessageSafe: classified.errorMessageSafe,
      retryAfterSeconds: classified.retryAfterSeconds,
    };
  }

  return {
    outcome: "UNKNOWN",
    providerRequestId: classified.providerRequestId,
    httpStatus: classified.httpStatus,
    errorCode: classified.errorCode ?? "INSTAGRAM_RECONCILE_QUERY_UNCERTAIN",
    errorMessageSafe: "Ainda não foi possível confirmar com segurança o estado da publicação no Instagram.",
  };
}

function failedContainer(status: ContainerStatus, providerRequestId?: string | null): ReconcileAdapterResult {
  return {
    outcome: "FAILED_FINAL",
    providerRequestId,
    errorCode: `INSTAGRAM_CONTAINER_${status.status_code ?? "FAILED"}`,
    errorMessageSafe: status.status || "O Instagram confirmou que não conseguiu processar a mídia.",
  };
}

export const instagramPublishAdapter: PublishAdapter = {
  provider: "instagram",

  async publish(job: PublicationWorkerJob): Promise<PublishAdapterResult> {
    const context = await loadRuntimePublicationContext(job.postTargetId);

    if (context.target.provider !== "instagram") {
      return {
        outcome: "FAILED_FINAL",
        errorCode: "PROVIDER_MISMATCH",
        errorMessageSafe: "O destino não pertence ao Instagram.",
      };
    }

    if (context.connection.connection_status !== "CONNECTED") {
      return {
        outcome: "AUTH_REQUIRED",
        errorCode: "INSTAGRAM_CONNECTION_NOT_CONNECTED",
        errorMessageSafe: "Reconecte a conta do Instagram para continuar.",
      };
    }

    const accessToken = await accessTokenFromContext(context);
    if (!accessToken) {
      return {
        outcome: "AUTH_REQUIRED",
        errorCode: "INSTAGRAM_TOKEN_UNAVAILABLE",
        errorMessageSafe: "A autorização do Instagram expirou ou não está disponível.",
      };
    }

    if (!context.media) {
      return invalidContent("Adicione uma imagem ou vídeo antes de publicar no Instagram.", "INSTAGRAM_MEDIA_REQUIRED");
    }

    const preflight = preflightMedia(context.media);
    if (preflight) return preflight;

    const isVideo = context.media.mime_type.startsWith("video/");
    let container = await existingContainer(job.postTargetId);

    if (container?.state === "PUBLISHED") {
      const mediaId = publishedIdFromMetadata(container.metadata);
      await revokeMediaDeliveryUrls(job.postTargetId);
      return {
        outcome: "SUCCEEDED",
        providerRequestId: mediaId ?? container.provider_asset_id,
      };
    }

    if (!container) {
      const deliveryUrl = await issueMediaDeliveryUrl(context);
      const create = await metaGraphRequest<ContainerCreated>({
        path: `/${encodeURIComponent(context.connection.provider_account_id)}/media`,
        method: "POST",
        accessToken,
        params: isVideo
          ? {
              media_type: "REELS",
              video_url: deliveryUrl,
              caption: context.target.caption,
              share_to_feed: true,
            }
          : {
              image_url: deliveryUrl,
              caption: context.target.caption,
            },
      });

      if (!create.ok || !create.data?.id) {
        return classifyMetaFailure(create);
      }

      try {
        await rememberContainer({
          organizationId: job.organizationId,
          postTargetId: job.postTargetId,
          containerId: create.data.id,
          mediaType: isVideo ? "REELS" : "IMAGE",
        });
      } catch {
        return {
          outcome: "UNKNOWN",
          providerRequestId: create.data.id,
          errorCode: "INSTAGRAM_CONTAINER_PERSIST_UNKNOWN",
          errorMessageSafe: "O Instagram recebeu a mídia, mas o Tela Social não conseguiu confirmar o registro local.",
        };
      }

      container = await existingContainer(job.postTargetId);
      if (!container) {
        return {
          outcome: "UNKNOWN",
          providerRequestId: create.data.id,
          errorCode: "INSTAGRAM_CONTAINER_NOT_RELOADED",
          errorMessageSafe: "O container foi criado, mas não pôde ser recuperado com segurança.",
        };
      }
    }

    let statusResponse = await containerStatus(container.provider_asset_id, accessToken);

    for (let check = 0; check < 3 && statusResponse.ok && statusResponse.data?.status_code !== "FINISHED"; check += 1) {
      const statusCode = statusResponse.data?.status_code;
      if (statusCode === "ERROR" || statusCode === "EXPIRED") break;
      await wait(1500);
      statusResponse = await containerStatus(container.provider_asset_id, accessToken);
    }

    if (!statusResponse.ok) return classifyMetaFailure(statusResponse);

    if (statusResponse.data?.status_code === "ERROR" || statusResponse.data?.status_code === "EXPIRED") {
      return {
        outcome: "INVALID_CONTENT",
        providerRequestId: statusResponse.requestId,
        errorCode: `INSTAGRAM_CONTAINER_${statusResponse.data.status_code}`,
        errorMessageSafe: statusResponse.data.status || "O Instagram não conseguiu processar a mídia.",
      };
    }

    if (statusResponse.data?.status_code !== "FINISHED") {
      return {
        outcome: "TRANSIENT_FAILURE",
        providerRequestId: statusResponse.requestId,
        errorCode: "INSTAGRAM_CONTAINER_PROCESSING",
        errorMessageSafe: "O Instagram ainda está processando a mídia. O Tela Social verificará novamente.",
        retryAfterSeconds: 30,
      };
    }

    const publish = await metaGraphRequest<PublishedMedia>({
      path: `/${encodeURIComponent(context.connection.provider_account_id)}/media_publish`,
      method: "POST",
      accessToken,
      params: { creation_id: container.provider_asset_id },
    });

    if (!publish.ok || !publish.data?.id) {
      return classifyMetaFailure(publish);
    }

    try {
      await markContainerPublished({
        providerAssetRowId: container.id,
        organizationId: job.organizationId,
        postTargetId: job.postTargetId,
        containerId: container.provider_asset_id,
        mediaId: publish.data.id,
        previousMetadata: container.metadata,
      });
      await revokeMediaDeliveryUrls(job.postTargetId);
    } catch {
      return {
        outcome: "UNKNOWN",
        providerRequestId: publish.data.id,
        errorCode: "INSTAGRAM_PUBLISH_PERSIST_UNKNOWN",
        errorMessageSafe: "O Instagram respondeu à publicação, mas o Tela Social não conseguiu confirmar o registro local.",
      };
    }

    return {
      outcome: "SUCCEEDED",
      providerRequestId: publish.data.id,
    };
  },

  async reconcile(job: PublicationWorkerJob): Promise<ReconcileAdapterResult> {
    const context = await loadRuntimePublicationContext(job.postTargetId);

    if (context.target.provider !== "instagram") {
      return {
        outcome: "FAILED_FINAL",
        errorCode: "PROVIDER_MISMATCH",
        errorMessageSafe: "O destino não pertence ao Instagram.",
      };
    }

    if (context.connection.connection_status !== "CONNECTED") {
      return {
        outcome: "AUTH_REQUIRED",
        errorCode: "INSTAGRAM_CONNECTION_NOT_CONNECTED",
        errorMessageSafe: "Reconecte a conta do Instagram para verificar a publicação.",
      };
    }

    const accessToken = await accessTokenFromContext(context);
    if (!accessToken) {
      return {
        outcome: "AUTH_REQUIRED",
        errorCode: "INSTAGRAM_TOKEN_UNAVAILABLE",
        errorMessageSafe: "A autorização do Instagram expirou ou não está disponível.",
      };
    }

    const container = await existingContainer(job.postTargetId);
    if (container?.state === "PUBLISHED") {
      const mediaId = publishedIdFromMetadata(container.metadata);
      await revokeMediaDeliveryUrls(job.postTargetId);
      return {
        outcome: "SUCCEEDED",
        providerRequestId: mediaId ?? container.provider_asset_id,
      };
    }

    const unknownAttempt = await latestUnknownPublishAttempt(job.postTargetId);
    const unknownCode = unknownAttempt?.error_code ?? null;
    const providerObjectId = unknownAttempt?.provider_request_id ?? null;

    if (unknownCode === "INSTAGRAM_PUBLISH_PERSIST_UNKNOWN" && providerObjectId) {
      const mediaResponse = await publishedMedia(providerObjectId, accessToken);
      if (!mediaResponse.ok) return reconcileMetaFailure(mediaResponse);

      if (!mediaResponse.data?.id || mediaResponse.data.id !== providerObjectId) {
        return {
          outcome: "UNKNOWN",
          providerRequestId: providerObjectId,
          errorCode: "INSTAGRAM_RECONCILE_MEDIA_NOT_CONFIRMED",
          errorMessageSafe: "O Instagram ainda não confirmou a mídia publicada.",
        };
      }

      try {
        if (container) {
          await markContainerPublished({
            providerAssetRowId: container.id,
            organizationId: job.organizationId,
            postTargetId: job.postTargetId,
            containerId: container.provider_asset_id,
            mediaId: providerObjectId,
            previousMetadata: container.metadata,
          });
        } else {
          await rememberPublishedMedia({
            organizationId: job.organizationId,
            postTargetId: job.postTargetId,
            mediaId: providerObjectId,
          });
        }
        await revokeMediaDeliveryUrls(job.postTargetId);
      } catch {
        return {
          outcome: "TRANSIENT_FAILURE",
          providerRequestId: providerObjectId,
          errorCode: "INSTAGRAM_RECONCILE_LOCAL_PERSIST_FAILED",
          errorMessageSafe: "A publicação foi confirmada no Instagram, mas o registro local ainda precisa ser atualizado.",
          retryAfterSeconds: 30,
        };
      }

      return {
        outcome: "SUCCEEDED",
        providerRequestId: providerObjectId,
      };
    }

    if (
      (unknownCode === "INSTAGRAM_CONTAINER_PERSIST_UNKNOWN" ||
        unknownCode === "INSTAGRAM_CONTAINER_NOT_RELOADED") &&
      providerObjectId
    ) {
      const statusResponse = await containerStatus(providerObjectId, accessToken);
      if (!statusResponse.ok) return reconcileMetaFailure(statusResponse);

      if (statusResponse.data?.status_code === "ERROR" || statusResponse.data?.status_code === "EXPIRED") {
        return failedContainer(statusResponse.data, providerObjectId);
      }

      if (statusResponse.data?.status_code !== "FINISHED") {
        return {
          outcome: "TRANSIENT_FAILURE",
          providerRequestId: providerObjectId,
          errorCode: "INSTAGRAM_RECONCILE_CONTAINER_PROCESSING",
          errorMessageSafe: "O Instagram ainda está processando a mídia antes de permitir uma nova tentativa segura.",
          retryAfterSeconds: 30,
        };
      }

      try {
        await rememberContainer({
          organizationId: job.organizationId,
          postTargetId: job.postTargetId,
          containerId: providerObjectId,
          mediaType: context.media?.mime_type.startsWith("video/") ? "REELS" : "IMAGE",
        });
      } catch {
        return {
          outcome: "TRANSIENT_FAILURE",
          providerRequestId: providerObjectId,
          errorCode: "INSTAGRAM_RECONCILE_CONTAINER_PERSIST_FAILED",
          errorMessageSafe: "O container foi confirmado no Instagram, mas o registro local ainda precisa ser atualizado.",
          retryAfterSeconds: 30,
        };
      }

      return {
        outcome: "SAFE_TO_RETRY",
        providerRequestId: providerObjectId,
        errorCode: "INSTAGRAM_RECONCILED_CONTAINER_READY",
        errorMessageSafe: "O container foi confirmado e uma nova tentativa de publicação é segura.",
      };
    }

    if (container) {
      const statusResponse = await containerStatus(container.provider_asset_id, accessToken);
      if (!statusResponse.ok) return reconcileMetaFailure(statusResponse);

      if (statusResponse.data?.status_code === "ERROR" || statusResponse.data?.status_code === "EXPIRED") {
        return failedContainer(statusResponse.data, container.provider_asset_id);
      }

      if (statusResponse.data?.status_code !== "FINISHED") {
        return {
          outcome: "TRANSIENT_FAILURE",
          providerRequestId: container.provider_asset_id,
          errorCode: "INSTAGRAM_RECONCILE_CONTAINER_PROCESSING",
          errorMessageSafe: "O Instagram ainda está processando a mídia.",
          retryAfterSeconds: 30,
        };
      }

      return {
        outcome: "UNKNOWN",
        providerRequestId: container.provider_asset_id,
        errorCode: "INSTAGRAM_RECONCILE_AMBIGUOUS_FINISHED_CONTAINER",
        errorMessageSafe: "O container está pronto, mas ainda não há prova segura de que a publicação foi ou não concluída.",
      };
    }

    return {
      outcome: "UNKNOWN",
      providerRequestId: providerObjectId,
      errorCode: "INSTAGRAM_RECONCILE_NO_PROVIDER_ASSET",
      errorMessageSafe: "Não há evidência suficiente para republicar com segurança. O Tela Social continuará verificando antes de exigir ação manual.",
    };
  },
};
