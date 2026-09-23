import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createUntypedSupabaseAdminClient } from "@/lib/supabase/admin";
import { getObjectStorageConfig } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORAGE_REDIRECT_TTL_SECONDS = 15 * 60;

type DeliveryRecord = {
  media_asset_id: string;
  post_target_id: string;
  object_key: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_class: string;
  processing_status: string;
};

async function resolveDelivery(token: string) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;

  const admin = createUntypedSupabaseAdminClient();
  if (!admin) return null;

  const result = await admin.rpc("server_consume_media_delivery_token", {
    p_token: token,
  });

  if (result.error || !result.data) return null;
  return result.data as DeliveryRecord;
}

async function paramsToken(context: { params: Promise<{ token: string }> }) {
  const params = await context.params;
  return params.token;
}

function redirectToStorage(url: string) {
  return new Response(null, {
    status: 307,
    headers: {
      Location: url,
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const token = await paramsToken(context);
  const record = await resolveDelivery(token);
  const storage = getObjectStorageConfig();

  if (!record || !storage || !record.object_key) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const url = await getSignedUrl(
      storage.client,
      new GetObjectCommand({
        Bucket: storage.bucket,
        Key: record.object_key,
        ResponseContentType: record.mime_type || "application/octet-stream",
        ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(record.filename || "media")}`,
      }),
      { expiresIn: STORAGE_REDIRECT_TTL_SECONDS },
    );

    return redirectToStorage(url);
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function HEAD(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const token = await paramsToken(context);
  const record = await resolveDelivery(token);
  const storage = getObjectStorageConfig();

  if (!record || !storage || !record.object_key) {
    return new Response(null, { status: 404 });
  }

  try {
    const url = await getSignedUrl(
      storage.client,
      new HeadObjectCommand({
        Bucket: storage.bucket,
        Key: record.object_key,
      }),
      { expiresIn: STORAGE_REDIRECT_TTL_SECONDS },
    );

    return redirectToStorage(url);
  } catch {
    return new Response(null, { status: 404 });
  }
}
