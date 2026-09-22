import { Readable } from "node:stream";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest } from "next/server";
import { createUntypedSupabaseAdminClient } from "@/lib/supabase/admin";
import { getObjectStorageConfig } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function deliveryHeaders(record: DeliveryRecord) {
  const headers = new Headers();
  headers.set("Content-Type", record.mime_type || "application/octet-stream");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(record.filename || "media")}`,
  );
  return headers;
}

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const token = await paramsToken(context);
  const record = await resolveDelivery(token);
  const storage = getObjectStorageConfig();

  if (!record || !storage || !record.object_key) {
    return new Response("Not found", { status: 404 });
  }

  const range = request.headers.get("range") ?? undefined;

  try {
    const object = await storage.client.send(new GetObjectCommand({
      Bucket: storage.bucket,
      Key: record.object_key,
      Range: range,
    }));

    if (!object.Body) return new Response("Not found", { status: 404 });

    const headers = deliveryHeaders(record);
    if (typeof object.ContentLength === "number") {
      headers.set("Content-Length", String(object.ContentLength));
    }
    if (object.ContentRange) headers.set("Content-Range", object.ContentRange);
    if (object.ETag) headers.set("ETag", object.ETag);
    if (object.LastModified) headers.set("Last-Modified", object.LastModified.toUTCString());

    const body = object.Body as unknown as {
      transformToWebStream?: () => ReadableStream;
    } & Readable;

    const stream = typeof body.transformToWebStream === "function"
      ? body.transformToWebStream()
      : Readable.toWeb(body);

    return new Response(stream as BodyInit, {
      status: object.ContentRange ? 206 : 200,
      headers,
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function HEAD(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const token = await paramsToken(context);
  const record = await resolveDelivery(token);
  const storage = getObjectStorageConfig();

  if (!record || !storage || !record.object_key) {
    return new Response(null, { status: 404 });
  }

  try {
    const object = await storage.client.send(new HeadObjectCommand({
      Bucket: storage.bucket,
      Key: record.object_key,
    }));

    const headers = deliveryHeaders(record);
    if (typeof object.ContentLength === "number") {
      headers.set("Content-Length", String(object.ContentLength));
    }
    if (object.ETag) headers.set("ETag", object.ETag);
    if (object.LastModified) headers.set("Last-Modified", object.LastModified.toUTCString());

    return new Response(null, { status: 200, headers });
  } catch {
    return new Response(null, { status: 404 });
  }
}
