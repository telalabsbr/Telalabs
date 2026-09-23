import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getObjectStorageConfig } from "@/lib/storage/r2";

export const runtime = "nodejs";

type UploadedPart = { part_number?: number; etag?: string };

export async function POST(request: NextRequest) {
  const storage = getObjectStorageConfig();
  if (!storage) return NextResponse.json({ error: "object_storage_not_configured" }, { status: 503 });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const body = await request.json().catch(() => null) as null | {
    media_id?: string;
    upload_id?: string;
    parts?: UploadedPart[];
  };

  const mediaId = body?.media_id ?? "";
  const uploadId = body?.upload_id ?? "";
  const parts = Array.isArray(body?.parts) ? body!.parts : [];

  if (!mediaId || !uploadId || !parts.length || parts.length > 10000) {
    return NextResponse.json({ error: "invalid_complete_request" }, { status: 400 });
  }

  const normalized = parts
    .map(part => ({
      PartNumber: Number(part.part_number),
      ETag: String(part.etag ?? "").trim(),
    }))
    .sort((a, b) => a.PartNumber - b.PartNumber);

  if (normalized.some(part => !Number.isInteger(part.PartNumber) || part.PartNumber < 1 || part.PartNumber > 10000 || !part.ETag)) {
    return NextResponse.json({ error: "invalid_complete_parts" }, { status: 400 });
  }

  const asset = await supabase
    .from("media_assets")
    .select("id,object_key,organization_id,processing_status")
    .eq("id", mediaId)
    .is("deleted_at", null)
    .single();

  if (asset.error || !asset.data?.object_key) {
    return NextResponse.json({ error: "media_not_accessible" }, { status: 404 });
  }
  if (asset.data.processing_status !== "PENDING_UPLOAD") {
    return NextResponse.json({ error: "media_not_uploading" }, { status: 409 });
  }

  try {
    const result = await storage.client.send(new CompleteMultipartUploadCommand({
      Bucket: storage.bucket,
      Key: asset.data.object_key,
      UploadId: uploadId,
      MultipartUpload: { Parts: normalized },
    }));

    const update = await supabase
      .from("media_assets")
      .update({ processing_status: "READY" })
      .eq("id", mediaId)
      .eq("organization_id", asset.data.organization_id);

    if (update.error) {
      return NextResponse.json({ error: "media_finalize_record_failed" }, { status: 500 });
    }

    return NextResponse.json({
      media_id: mediaId,
      status: "READY",
      etag: result.ETag ?? null,
    });
  } catch {
    await supabase
      .from("media_assets")
      .update({ processing_status: "FAILED" })
      .eq("id", mediaId)
      .eq("organization_id", asset.data.organization_id);

    return NextResponse.json({ error: "multipart_complete_failed" }, { status: 502 });
  }
}
