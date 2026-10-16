import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMetaGraphBaseUrl } from "@/lib/oauth/meta";
import type { Json } from "@/lib/supabase/database.types";
import {
  accessTokenFromContext,
  issueAttachedMediaDeliveryUrl,
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

type FacebookPhotoCreated = { id?: string; post_id?: string };
type FacebookFeedCreated = { id?: string };
type FacebookReelStart = { video_id?: string; upload_url?: string };
type FacebookReelFinish = { success?: boolean };
type FacebookObject = {
  id?: string;
  permalink_url?: string;
  status?: {
    video_status?: string;
    uploading_phase?: { status?: string };
    processing_phase?: { status?: string };
    publishing_phase?: { status?: string };
  };
};
type FacebookUploadResult = {
  success?: boolean;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    is_transient?: boolean;
    error_user_title?: string;
    error_user_msg?: string;
    fbtrace_id?: string;
  };
};
type UnknownPublishAttempt = {
  error_code: string | null;
  provider_request_id: string | null;
  started_at: string;
};

const REEL_MIN_DURATION_MS = 4_000;
const REEL_MAX_DURATION_MS = 60_000;
const REEL_MIN_WIDTH = 540;
const REEL_MIN_HEIGHT = 960;

function invalidContent(message: string, code: string): PublishAdapterResult {
  return {
    outcome: "INVALID_CONTENT",
    errorCode: code,
    errorMessageSafe: message,
  };
}

function metadataRecord(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, Json | undefined>;
  return value as Record<string, Json | undefined>;
}

function stringMetadata(value: Json, key: string) {
  const record = metadataRecord(value);
  const item = record[key];
  return typeof item === "string" ? item : null;
}

function preflightMedia(media: NonNullable<Awaited<ReturnType<typeof loadRuntimePublicationContext>>["media"]>) {
  if (media.processing_status !== "READY" || !media.object_key) {
    return invalidContent("A mídia ainda não está pronta para publicação.", "FACEBOOK_MEDIA_NOT_READY");
  }

  if (media.mime_type.startsWith("image/")) {
    if (!["image/jpeg", "image/png"].includes(media.mime_type)) {
      return invalidContent("Para esta integração do Facebook, envie uma imagem JPEG ou PNG.", "FACEBOOK_IMAGE_FORMAT");
    }
    return null;
  }

  if (media.mime_type.startsWith("video/")) {
    if (!["video/mp4", "video/quicktime"].includes(media.mime_type)) {
      return invalidContent("Para Reels do Facebook, envie um arquivo MP4 ou MOV.", "FACEBOOK_REEL_FORMAT");
    }
    if (media.duration_ms !== null && (media.duration_ms < REEL_MIN_DURATION_MS || media.duration_ms > REEL_MAX_DURATION_MS)) {
      return invalidContent("O Reel do Facebook precisa ter entre 4 e 60 segundos.", "FACEBOOK_REEL_DURATION");
    }
    if (media.width !== null && media.height !== null) {
      if (media.width < REEL_MIN_WIDTH || media.height < REEL_MIN_HEIGHT) {
        return invalidContent("O Reel do Facebook precisa ter pelo menos 540 × 960 pixels.", "FACEBOOK_REEL_RESOLUTION");
      }
      const ratio = media.width / media.height;
      const target = 9 / 16;
      if (Math.abs(ratio - target) > 0.025) {
        return invalidContent("O Reel do Facebook precisa estar no formato vertical 9:16.", "FACEBOOK_REEL_ASPECT_RATIO");
      }
    }
    return null;
  }

  return invalidContent("Este tipo de mídia ainda não é suportado na Página do Facebook.", "FACEBOOK_MEDIA_TYPE");
}

async function existingReel(postTargetId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");

  const result = await admin
    .from("provider_assets")
    .select("id,provider_asset_id,state,metadata,created_at")
    .eq("post_target_id", postTargetId)
    .eq("provider", "facebook")
    .eq("kind", "REEL")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function existingPublishedAsset(postTargetId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");

  const result = await admin
    .from("provider_assets")
    .select("id,provider_asset_id,state,metadata,kind,created_at")
    .eq("post_target_id", postTargetId)
    .eq("provider", "facebook")
    .eq("state", "PUBLISHED")
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

async function saveReel(args: {
  organizationId: string;
  postTargetId: string;
  videoId: string;
  state: string;
  uploadUrl?: string | null;
  publicUrl?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");

  const previous = await admin
    .from("provider_assets")
    .select("metadata")
    .eq("provider", "facebook")
    .eq("provider_asset_id", args.videoId)
    .eq("kind", "REEL")
    .maybeSingle();

  const metadata = metadataRecord(previous.data?.metadata ?? null);
  const result = await admin.from("provider_assets").upsert({
    organization_id: args.organizationId,
    post_target_id: args.postTargetId,
    provider: "facebook",
    provider_asset_id: args.videoId,
    kind: "REEL",
    state: args.state,
    metadata: {
      ...metadata,
      ...(args.uploadUrl ? { upload_url: args.uploadUrl } : {}),
      ...(args.publicUrl ? { permalink: args.publicUrl } : {}),
      updated_by: "facebook_adapter",
      updated_at: new Date().toISOString(),
    },
  }, {
    onConflict: "provider,provider_asset_id",
  });

  if (result.error) throw new Error(result.error.message);
}

async function rememberPublishedPhoto(args: {
  organizationId: string;
  postTargetId: string;
  externalId: string;
  photoId?: string | null;
  publicUrl?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");

  const result = await admin.from("provider_assets").upsert({
    organization_id: args.organizationId,
    post_target_id: args.postTargetId,
    provider: "facebook",
    provider_asset_id: args.externalId,
    kind: "PHOTO",
    state: "PUBLISHED",
    metadata: {
      photo_id: args.photoId ?? null,
      permalink: args.publicUrl ?? null,
      published_at: new Date().toISOString(),
    },
  }, {
    onConflict: "provider,provider_asset_id",
  });

  if (result.error) throw new Error(result.error.message);
}

async function facebookObject(objectId: string, accessToken: string) {
  return metaGraphRequest<FacebookObject>({
    baseUrl: getMetaGraphBaseUrl(),
    path: `/${encodeURIComponent(objectId)}`,
    accessToken,
    params: { fields: "id,permalink_url,status" },
  });
}

function retryAfterSeconds(response: Response) {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const numeric = Number(header);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.ceil(numeric);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : null;
}

async function uploadHostedReel(uploadUrl: string, fileUrl: string, accessToken: string): Promise<MetaResponse<FacebookUploadResult>> {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `OAuth ${accessToken}`,
      file_url: fileUrl,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => null) as FacebookUploadResult | null;
  return {
    ok: response.ok && !data?.error && data?.success !== false,
    status: response.status,
    data,
    requestId: response.headers.get("x-fb-request-id") ?? data?.error?.fbtrace_id ?? null,
    retryAfterSeconds: retryAfterSeconds(response),
  };
}

function toReconcileFailure(response: MetaResponse<unknown>): ReconcileAdapterResult {
  const classified = classifyMetaFailure(response);
  if (classified.outcome === "AUTH_REQUIRED" || classified.outcome === "RATE_LIMIT" || classified.outcome === "TRANSIENT_FAILURE") {
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
    outcome: classified.outcome === "INVALID_CONTENT" ? "FAILED_FINAL" : classified.outcome,
    providerRequestId: classified.providerRequestId,
    httpStatus: classified.httpStatus,
    errorCode: classified.errorCode,
    errorMessageSafe: classified.errorMessageSafe,
  };
}

function statusValue(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function isPublishedStatus(data: FacebookObject | null | undefined) {
  const publishing = statusValue(data?.status?.publishing_phase?.status);
  const video = statusValue(data?.status?.video_status);
  return publishing === "complete" || publishing === "completed" || video === "published";
}

function isFailedStatus(data: FacebookObject | null | undefined) {
  const statuses = [
    data?.status?.video_status,
    data?.status?.uploading_phase?.status,
    data?.status?.processing_phase?.status,
    data?.status?.publishing_phase?.status,
  ].map(statusValue);
  return statuses.some(value => value === "error" || value === "failed" || value === "expired");
}

async function publishPhoto(job: PublicationWorkerJob, accessToken: string) {
  const context = await loadRuntimePublicationContext(job.postTargetId);
  if (!context.media) return invalidContent("Adicione uma imagem antes de publicar no Facebook.", "FACEBOOK_IMAGE_REQUIRED");

  const deliveryUrl = await issueMediaDeliveryUrl(context);
  const create = await metaGraphRequest<FacebookPhotoCreated>({
    baseUrl: getMetaGraphBaseUrl(),
    path: `/${encodeURIComponent(context.connection.provider_account_id)}/photos`,
    method: "POST",
    accessToken,
    params: {
      url: deliveryUrl,
      caption: context.target.caption,
      published: true,
    },
  });

  if (!create.ok || (!create.data?.id && !create.data?.post_id)) return classifyMetaFailure(create);

  const externalId = create.data.post_id || create.data.id as string;
  const details = await facebookObject(externalId, accessToken);
  const permalink = details.ok ? details.data?.permalink_url ?? null : null;

  try {
    await rememberPublishedPhoto({
      organizationId: job.organizationId,
      postTargetId: job.postTargetId,
      externalId,
      photoId: create.data.id ?? null,
      publicUrl: permalink,
    });
    await revokeMediaDeliveryUrls(job.postTargetId);
  } catch {
    return {
      outcome: "UNKNOWN" as const,
      providerRequestId: externalId,
      errorCode: "FACEBOOK_PHOTO_PERSIST_UNKNOWN",
      errorMessageSafe: "O Facebook recebeu a imagem, mas o Tela Social ainda precisa confirmar o registro local.",
    };
  }

  return {
    outcome: "SUCCEEDED" as const,
    providerRequestId: externalId,
    publicUrl: permalink,
  };
}


async function publishCarousel(job: PublicationWorkerJob, accessToken: string) {
  const context = await loadRuntimePublicationContext(job.postTargetId);
  const items = context.media_items ?? [];
  if (items.length < 2 || items.length > 10) {
    return invalidContent("O carrossel do Facebook precisa ter entre 2 e 10 imagens.", "FACEBOOK_CAROUSEL_COUNT");
  }

  const childIds: string[] = [];
  for (const item of items) {
    if (!item.mime_type.startsWith("image/") || item.processing_status !== "READY" || !item.object_key) {
      return invalidContent("O carrossel do Facebook precisa usar imagens prontas.", "FACEBOOK_CAROUSEL_MEDIA");
    }
    const deliveryUrl = await issueAttachedMediaDeliveryUrl(context, item);
    const child = await metaGraphRequest<FacebookPhotoCreated>({
      baseUrl: getMetaGraphBaseUrl(),
      path: `/${encodeURIComponent(context.connection.provider_account_id)}/photos`,
      method: "POST",
      accessToken,
      params: { url: deliveryUrl, published: false },
    });
    if (!child.ok || !child.data?.id) return classifyMetaFailure(child);
    childIds.push(child.data.id);
  }

  const params: Record<string, string | boolean> = { message: context.target.caption };
  childIds.forEach((id, index) => {
    params[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id });
  });

  const create = await metaGraphRequest<FacebookFeedCreated>({
    baseUrl: getMetaGraphBaseUrl(),
    path: `/${encodeURIComponent(context.connection.provider_account_id)}/feed`,
    method: "POST",
    accessToken,
    params,
  });
  if (!create.ok || !create.data?.id) return classifyMetaFailure(create);

  const details = await facebookObject(create.data.id, accessToken);
  const permalink = details.ok ? details.data?.permalink_url ?? null : null;

  try {
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
    const saved = await admin.from("provider_assets").upsert({
      organization_id: job.organizationId,
      post_target_id: job.postTargetId,
      provider: "facebook",
      provider_asset_id: create.data.id,
      kind: "CAROUSEL",
      state: "PUBLISHED",
      metadata: { child_photo_ids: childIds, permalink, published_at: new Date().toISOString() },
    }, { onConflict: "provider,provider_asset_id" });
    if (saved.error) throw new Error(saved.error.message);
    await revokeMediaDeliveryUrls(job.postTargetId);
  } catch {
    return {
      outcome: "UNKNOWN" as const,
      providerRequestId: create.data.id,
      errorCode: "FACEBOOK_CAROUSEL_PERSIST_UNKNOWN",
      errorMessageSafe: "O Facebook recebeu o carrossel, mas o Tela Social ainda precisa confirmar o registro local.",
    };
  }

  return { outcome: "SUCCEEDED" as const, providerRequestId: create.data.id, publicUrl: permalink };
}

async function publishReel(job: PublicationWorkerJob, accessToken: string) {
  const context = await loadRuntimePublicationContext(job.postTargetId);
  if (!context.media) return invalidContent("Adicione um vídeo antes de publicar um Reel no Facebook.", "FACEBOOK_REEL_REQUIRED");

  let reel = await existingReel(job.postTargetId);

  if (reel?.state === "PUBLISHED") {
    await revokeMediaDeliveryUrls(job.postTargetId);
    return {
      outcome: "SUCCEEDED" as const,
      providerRequestId: reel.provider_asset_id,
      publicUrl: stringMetadata(reel.metadata, "permalink"),
    };
  }

  if (!reel) {
    const start = await metaGraphRequest<FacebookReelStart>({
      baseUrl: getMetaGraphBaseUrl(),
      path: `/${encodeURIComponent(context.connection.provider_account_id)}/video_reels`,
      method: "POST",
      accessToken,
      params: { upload_phase: "start" },
    });

    if (!start.ok || !start.data?.video_id || !start.data.upload_url) return classifyMetaFailure(start);

    try {
      await saveReel({
        organizationId: job.organizationId,
        postTargetId: job.postTargetId,
        videoId: start.data.video_id,
        uploadUrl: start.data.upload_url,
        state: "CREATED",
      });
    } catch {
      return {
        outcome: "UNKNOWN" as const,
        providerRequestId: start.data.video_id,
        errorCode: "FACEBOOK_REEL_SESSION_PERSIST_UNKNOWN",
        errorMessageSafe: "O Facebook criou a sessão do Reel, mas o Tela Social ainda precisa confirmar o registro local.",
      };
    }

    reel = await existingReel(job.postTargetId);
    if (!reel) {
      return {
        outcome: "UNKNOWN" as const,
        providerRequestId: start.data.video_id,
        errorCode: "FACEBOOK_REEL_SESSION_NOT_RELOADED",
        errorMessageSafe: "A sessão do Reel foi criada, mas não pôde ser recuperada com segurança.",
      };
    }
  }

  const uploadUrl = stringMetadata(reel.metadata, "upload_url");
  if (!uploadUrl) {
    return {
      outcome: "FAILED_FINAL" as const,
      providerRequestId: reel.provider_asset_id,
      errorCode: "FACEBOOK_REEL_UPLOAD_URL_MISSING",
      errorMessageSafe: "A sessão de upload do Reel está incompleta. Crie a publicação novamente.",
    };
  }

  if (reel.state === "CREATED") {
    const deliveryUrl = await issueMediaDeliveryUrl(context);
    const upload = await uploadHostedReel(uploadUrl, deliveryUrl, accessToken);
    if (!upload.ok) return classifyMetaFailure(upload);

    try {
      await saveReel({
        organizationId: job.organizationId,
        postTargetId: job.postTargetId,
        videoId: reel.provider_asset_id,
        uploadUrl,
        state: "UPLOADED",
      });
    } catch {
      return {
        outcome: "UNKNOWN" as const,
        providerRequestId: reel.provider_asset_id,
        errorCode: "FACEBOOK_REEL_UPLOAD_PERSIST_UNKNOWN",
        errorMessageSafe: "O vídeo chegou ao Facebook, mas o Tela Social ainda precisa confirmar o estado da sessão.",
      };
    }
    reel = await existingReel(job.postTargetId);
    if (!reel) {
      return {
        outcome: "UNKNOWN" as const,
        errorCode: "FACEBOOK_REEL_UPLOAD_NOT_RELOADED",
        errorMessageSafe: "O upload foi concluído, mas o estado local não pôde ser recuperado.",
      };
    }
  }

  if (reel.state === "FINISHING") {
    const status = await facebookObject(reel.provider_asset_id, accessToken);
    if (!status.ok) return classifyMetaFailure(status);
    if (isFailedStatus(status.data)) {
      return {
        outcome: "FAILED_FINAL" as const,
        providerRequestId: reel.provider_asset_id,
        errorCode: "FACEBOOK_REEL_PROCESSING_FAILED",
        errorMessageSafe: "O Facebook informou que não conseguiu processar este Reel.",
      };
    }
    if (isPublishedStatus(status.data) || status.data?.permalink_url) {
      const permalink = status.data?.permalink_url ?? null;
      await saveReel({
        organizationId: job.organizationId,
        postTargetId: job.postTargetId,
        videoId: reel.provider_asset_id,
        uploadUrl,
        publicUrl: permalink,
        state: "PUBLISHED",
      });
      await revokeMediaDeliveryUrls(job.postTargetId);
      return { outcome: "SUCCEEDED" as const, providerRequestId: reel.provider_asset_id, publicUrl: permalink };
    }

    const publishing = statusValue(status.data?.status?.publishing_phase?.status);
    if (publishing && publishing !== "not_started") {
      return {
        outcome: "TRANSIENT_FAILURE" as const,
        providerRequestId: reel.provider_asset_id,
        errorCode: "FACEBOOK_REEL_PUBLISHING",
        errorMessageSafe: "O Facebook ainda está processando o Reel.",
        retryAfterSeconds: 30,
      };
    }
  }

  try {
    await saveReel({
      organizationId: job.organizationId,
      postTargetId: job.postTargetId,
      videoId: reel.provider_asset_id,
      uploadUrl,
      state: "FINISHING",
    });
  } catch {
    return {
      outcome: "TRANSIENT_FAILURE" as const,
      providerRequestId: reel.provider_asset_id,
      errorCode: "FACEBOOK_REEL_FINISH_STATE_FAILED",
      errorMessageSafe: "O Tela Social ainda não conseguiu preparar a etapa final do Reel.",
      retryAfterSeconds: 15,
    };
  }

  const finish = await metaGraphRequest<FacebookReelFinish>({
    baseUrl: getMetaGraphBaseUrl(),
    path: `/${encodeURIComponent(context.connection.provider_account_id)}/video_reels`,
    method: "POST",
    accessToken,
    params: {
      video_id: reel.provider_asset_id,
      upload_phase: "finish",
      video_state: "PUBLISHED",
      description: context.target.caption,
      title: context.target.title || undefined,
    },
  });

  if (!finish.ok || finish.data?.success === false) return classifyMetaFailure(finish);

  const details = await facebookObject(reel.provider_asset_id, accessToken);
  const permalink = details.ok ? details.data?.permalink_url ?? null : null;

  try {
    await saveReel({
      organizationId: job.organizationId,
      postTargetId: job.postTargetId,
      videoId: reel.provider_asset_id,
      uploadUrl,
      publicUrl: permalink,
      state: "PUBLISHED",
    });
    await revokeMediaDeliveryUrls(job.postTargetId);
  } catch {
    return {
      outcome: "UNKNOWN" as const,
      providerRequestId: reel.provider_asset_id,
      errorCode: "FACEBOOK_REEL_PUBLISH_PERSIST_UNKNOWN",
      errorMessageSafe: "O Facebook aceitou a publicação do Reel, mas o Tela Social ainda precisa confirmar o registro local.",
    };
  }

  return {
    outcome: "SUCCEEDED" as const,
    providerRequestId: reel.provider_asset_id,
    publicUrl: permalink,
  };
}

export const facebookPublishAdapter: PublishAdapter = {
  provider: "facebook",

  async publish(job: PublicationWorkerJob): Promise<PublishAdapterResult> {
    const context = await loadRuntimePublicationContext(job.postTargetId);

    if (context.target.provider !== "facebook") {
      return {
        outcome: "FAILED_FINAL",
        errorCode: "PROVIDER_MISMATCH",
        errorMessageSafe: "O destino não pertence ao Facebook.",
      };
    }

    if (context.connection.connection_status !== "CONNECTED") {
      return {
        outcome: "AUTH_REQUIRED",
        errorCode: "FACEBOOK_CONNECTION_NOT_CONNECTED",
        errorMessageSafe: "Reconecte a Página do Facebook para continuar.",
      };
    }

    const accessToken = await accessTokenFromContext(context);
    if (!accessToken) {
      return {
        outcome: "AUTH_REQUIRED",
        errorCode: "FACEBOOK_TOKEN_UNAVAILABLE",
        errorMessageSafe: "A autorização da Página do Facebook não está disponível.",
      };
    }

    if (!context.media) {
      return invalidContent("Adicione uma imagem ou vídeo antes de publicar no Facebook.", "FACEBOOK_MEDIA_REQUIRED");
    }

    const isCarousel = context.target.content_intent === "CAROUSEL" && (context.media_items?.length ?? 0) > 1;
    if (!isCarousel) {
      const preflight = preflightMedia(context.media);
      if (preflight) return preflight;
    }

    const published = await existingPublishedAsset(job.postTargetId);
    if (published) {
      return {
        outcome: "SUCCEEDED",
        providerRequestId: published.provider_asset_id,
        publicUrl: stringMetadata(published.metadata, "permalink"),
      };
    }

    if (isCarousel) return publishCarousel(job, accessToken);
    if (context.media.mime_type.startsWith("video/")) return publishReel(job, accessToken);
    return publishPhoto(job, accessToken);
  },

  async reconcile(job: PublicationWorkerJob): Promise<ReconcileAdapterResult> {
    const context = await loadRuntimePublicationContext(job.postTargetId);

    if (context.target.provider !== "facebook") {
      return {
        outcome: "FAILED_FINAL",
        errorCode: "PROVIDER_MISMATCH",
        errorMessageSafe: "O destino não pertence ao Facebook.",
      };
    }

    if (context.connection.connection_status !== "CONNECTED") {
      return {
        outcome: "AUTH_REQUIRED",
        errorCode: "FACEBOOK_CONNECTION_NOT_CONNECTED",
        errorMessageSafe: "Reconecte a Página do Facebook para verificar a publicação.",
      };
    }

    const accessToken = await accessTokenFromContext(context);
    if (!accessToken) {
      return {
        outcome: "AUTH_REQUIRED",
        errorCode: "FACEBOOK_TOKEN_UNAVAILABLE",
        errorMessageSafe: "A autorização da Página do Facebook não está disponível.",
      };
    }

    const published = await existingPublishedAsset(job.postTargetId);
    if (published) {
      await revokeMediaDeliveryUrls(job.postTargetId);
      return {
        outcome: "SUCCEEDED",
        providerRequestId: published.provider_asset_id,
        publicUrl: stringMetadata(published.metadata, "permalink"),
      };
    }

    const reel = await existingReel(job.postTargetId);
    if (reel) {
      const status = await facebookObject(reel.provider_asset_id, accessToken);
      if (!status.ok) return toReconcileFailure(status);

      if (isFailedStatus(status.data)) {
        return {
          outcome: "FAILED_FINAL",
          providerRequestId: reel.provider_asset_id,
          errorCode: "FACEBOOK_REEL_PROCESSING_FAILED",
          errorMessageSafe: "O Facebook informou que não conseguiu processar este Reel.",
        };
      }

      if (isPublishedStatus(status.data) || status.data?.permalink_url) {
        const permalink = status.data?.permalink_url ?? null;
        try {
          await saveReel({
            organizationId: job.organizationId,
            postTargetId: job.postTargetId,
            videoId: reel.provider_asset_id,
            uploadUrl: stringMetadata(reel.metadata, "upload_url"),
            publicUrl: permalink,
            state: "PUBLISHED",
          });
          await revokeMediaDeliveryUrls(job.postTargetId);
        } catch {
          return {
            outcome: "TRANSIENT_FAILURE",
            providerRequestId: reel.provider_asset_id,
            errorCode: "FACEBOOK_REEL_RECONCILE_PERSIST_FAILED",
            errorMessageSafe: "O Reel foi confirmado no Facebook, mas o registro local ainda precisa ser atualizado.",
            retryAfterSeconds: 30,
          };
        }
        return { outcome: "SUCCEEDED", providerRequestId: reel.provider_asset_id, publicUrl: permalink };
      }

      if (reel.state === "UPLOADED" || reel.state === "CREATED") {
        return {
          outcome: "SAFE_TO_RETRY",
          providerRequestId: reel.provider_asset_id,
          errorCode: "FACEBOOK_REEL_SAFE_TO_CONTINUE",
          errorMessageSafe: "A sessão do Reel foi confirmada e pode continuar sem criar outro upload.",
        };
      }

      return {
        outcome: "TRANSIENT_FAILURE",
        providerRequestId: reel.provider_asset_id,
        errorCode: "FACEBOOK_REEL_PROCESSING",
        errorMessageSafe: "O Facebook ainda está processando o Reel.",
        retryAfterSeconds: 30,
      };
    }

    const unknown = await latestUnknownPublishAttempt(job.postTargetId);
    if (unknown?.provider_request_id) {
      const details = await facebookObject(unknown.provider_request_id, accessToken);
      if (!details.ok) return toReconcileFailure(details);

      if (details.data?.id) {
        const permalink = details.data.permalink_url ?? null;
        if (context.media?.mime_type.startsWith("image/")) {
          try {
            await rememberPublishedPhoto({
              organizationId: job.organizationId,
              postTargetId: job.postTargetId,
              externalId: details.data.id,
              publicUrl: permalink,
            });
            await revokeMediaDeliveryUrls(job.postTargetId);
          } catch {
            return {
              outcome: "TRANSIENT_FAILURE",
              providerRequestId: details.data.id,
              errorCode: "FACEBOOK_PHOTO_RECONCILE_PERSIST_FAILED",
              errorMessageSafe: "A publicação foi confirmada no Facebook, mas o registro local ainda precisa ser atualizado.",
              retryAfterSeconds: 30,
            };
          }
          return { outcome: "SUCCEEDED", providerRequestId: details.data.id, publicUrl: permalink };
        }
      }
    }

    return {
      outcome: "UNKNOWN",
      errorCode: "FACEBOOK_RECONCILE_NOT_CONFIRMED",
      errorMessageSafe: "Ainda não foi possível confirmar com segurança o estado da publicação no Facebook.",
    };
  },
};
