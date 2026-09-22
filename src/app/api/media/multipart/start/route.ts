import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getObjectStorageConfig } from "@/lib/storage/r2";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024 * 1024;
const LARGE_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const CHUNK_BYTES = 32 * 1024 * 1024;

function safeFilename(value: string) {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned.slice(-180) || "media.bin";
}

export async function POST(request: NextRequest) {
  const storage = getObjectStorageConfig();
  if (!storage) return NextResponse.json({ error: "object_storage_not_configured" }, { status: 503 });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const body = await request.json().catch(() => null) as null | {
    brand_id?: string;
    filename?: string;
    mime_type?: string;
    size_bytes?: number;
    retention?: "delete" | "library";
  };

  const brandId = body?.brand_id ?? "";
  const filename = safeFilename(body?.filename ?? "");
  const mimeType = body?.mime_type ?? "";
  const sizeBytes = Number(body?.size_bytes ?? -1);
  const retention = body?.retention === "library" ? "library" : "delete";

  if (!brandId || !mimeType || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: "invalid_media_request" }, { status: 400 });
  }
  if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }
  if (sizeBytes > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large", max_bytes: MAX_BYTES }, { status: 413 });
  }

  const brandResult = await supabase
    .from("brands")
    .select("id,organization_id")
    .eq("id", brandId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .single();

  if (brandResult.error || !brandResult.data) {
    return NextResponse.json({ error: "brand_not_accessible" }, { status: 403 });
  }

  const mediaId = crypto.randomUUID();
  const objectKey = [
    brandResult.data.organization_id,
    brandResult.data.id,
    mediaId,
    filename,
  ].join("/");

  const insert = await supabase.from("media_assets").insert({
    id: mediaId,
    organization_id: brandResult.data.organization_id,
    brand_id: brandResult.data.id,
    storage_class: retention === "library" ? "PERMANENT" : "TEMPORARY",
    origin: "INTERNAL_UPLOAD",
    object_key: objectKey,
    filename,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    processing_status: "PENDING_UPLOAD",
    created_by: user.id,
    metadata: {
      retention,
      upload_protocol: "s3_multipart",
      media_pipeline: sizeBytes > LARGE_FILE_BYTES ? "LARGE_FILE_TEMP" : "STANDARD",
    },
  });

  if (insert.error) {
    return NextResponse.json({ error: "media_record_failed" }, { status: 500 });
  }

  try {
    const result = await storage.client.send(new CreateMultipartUploadCommand({
      Bucket: storage.bucket,
      Key: objectKey,
      ContentType: mimeType,
      Metadata: {
        "media-id": mediaId,
        "organization-id": brandResult.data.organization_id,
      },
    }));

    if (!result.UploadId) throw new Error("missing_upload_id");

    return NextResponse.json({
      media_id: mediaId,
      upload_id: result.UploadId,
      chunk_size: CHUNK_BYTES,
      size_bytes: sizeBytes,
      pipeline: sizeBytes > LARGE_FILE_BYTES ? "LARGE_FILE_TEMP" : "STANDARD",
    });
  } catch {
    await supabase
      .from("media_assets")
      .update({ processing_status: "FAILED" })
      .eq("id", mediaId)
      .eq("organization_id", brandResult.data.organization_id);

    return NextResponse.json({ error: "multipart_start_failed" }, { status: 502 });
  }
}
