import "server-only";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createUntypedSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/oauth/token-crypto";
import { getObjectStorageConfig } from "@/lib/storage/r2";
import type { Json } from "@/lib/supabase/database.types";

export type RuntimePublicationContext = {
  target: {
    id: string;
    organization_id: string;
    post_id: string;
    social_connection_id: string;
    provider: string;
    content_intent: string;
    caption: string;
    title: string;
    provider_config: Json;
    scheduled_at: string;
    state: string;
  };
  connection: {
    id: string;
    provider_account_id: string;
    display_name: string;
    username: string | null;
    connection_status: string;
    scopes: string[];
    token_expires_at: string | null;
    metadata: Json;
  };
  credential: null | {
    access_token_ciphertext: string;
    refresh_token_ciphertext: string | null;
    expires_at: string | null;
    key_version: string;
  };
  post: {
    id: string;
    brand_id: string;
    internal_title: string;
    base_caption: string | null;
  };
  media: null | {
    id: string;
    object_key: string | null;
    filename: string;
    mime_type: string;
    size_bytes: number;
    duration_ms: number | null;
    width: number | null;
    height: number | null;
    storage_class: string;
    origin: string;
    processing_status: string;
    metadata: Json;
  };
};

export async function loadRuntimePublicationContext(postTargetId: string) {
  const admin = createUntypedSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");

  const result = await admin.rpc("worker_get_publication_context", {
    p_post_target_id: postTargetId,
  });

  if (result.error || !result.data) {
    throw new Error(result.error?.message || "PUBLICATION_CONTEXT_NOT_FOUND");
  }

  return result.data as RuntimePublicationContext;
}

export async function accessTokenFromContext(context: RuntimePublicationContext) {
  const credential = context.credential;
  if (!credential?.access_token_ciphertext) return null;

  if (credential.expires_at && new Date(credential.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return decryptToken(credential.access_token_ciphertext);
}

export async function issueMediaDeliveryUrl(context: RuntimePublicationContext, ttlSeconds = 21600) {
  if (!context.media?.id || context.media.processing_status !== "READY") {
    throw new Error("MEDIA_NOT_READY");
  }

  const ttl = Math.max(60, Math.min(ttlSeconds, 86400));

  // Preview deployments can be protected by Vercel Authentication. External
  // providers such as Instagram cannot pass that login challenge, so give the
  // provider a short-lived R2 presigned URL directly in Preview instead of the
  // app delivery gateway. Production keeps the revocable gateway path.
  if (process.env.VERCEL_ENV === "preview" && context.media.object_key) {
    const storage = getObjectStorageConfig();
    if (!storage) throw new Error("OBJECT_STORAGE_NOT_CONFIGURED");

    return getSignedUrl(
      storage.client,
      new GetObjectCommand({
        Bucket: storage.bucket,
        Key: context.media.object_key,
        ResponseContentType: context.media.mime_type,
        ResponseContentDisposition: `inline; filename="${context.media.filename.replace(/["\\]/g, "_")}"`,
      }),
      { expiresIn: ttl },
    );
  }

  const publicUrl = process.env.APP_PUBLIC_URL;
  if (!publicUrl) throw new Error("APP_PUBLIC_URL_NOT_CONFIGURED");

  const admin = createUntypedSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");

  const result = await admin.rpc("server_issue_media_delivery_token", {
    p_post_target_id: context.target.id,
    p_media_asset_id: context.media.id,
    p_ttl_seconds: ttl,
  });

  if (result.error || !result.data) {
    throw new Error(result.error?.message || "MEDIA_DELIVERY_TOKEN_FAILED");
  }

  return new URL(`/d/${result.data}`, publicUrl).toString();
}

export async function revokeMediaDeliveryUrls(postTargetId: string) {
  const admin = createUntypedSupabaseAdminClient();
  if (!admin) return;

  await admin.rpc("server_revoke_media_delivery_tokens", {
    p_post_target_id: postTargetId,
  });
}
