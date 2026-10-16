import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getObjectStorageConfig } from "@/lib/storage/r2";

export const runtime = "nodejs";

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
    part_numbers?: number[];
  };

  const mediaId = body?.media_id ?? "";
  const uploadId = body?.upload_id ?? "";
  const partNumbers = Array.isArray(body?.part_numbers) ? body!.part_numbers : [];

  if (!mediaId || !uploadId || !partNumbers.length || partNumbers.length > 20) {
    return NextResponse.json({ error: "invalid_part_request" }, { status: 400 });
  }

  if (partNumbers.some(value => !Number.isInteger(value) || value < 1 || value > 10000)) {
    return NextResponse.json({ error: "invalid_part_number" }, { status: 400 });
  }

  const asset = await supabase
    .from("media_assets")
    .select("id,object_key,processing_status")
    .eq("id", mediaId)
    .is("deleted_at", null)
    .single();

  if (asset.error || !asset.data?.object_key) {
    return NextResponse.json({ error: "media_not_accessible" }, { status: 404 });
  }
  if (asset.data.processing_status !== "PENDING_UPLOAD") {
    return NextResponse.json({ error: "media_not_uploading" }, { status: 409 });
  }

  const parts = await Promise.all(partNumbers.map(async partNumber => ({
    part_number: partNumber,
    url: await getSignedUrl(
      storage.client,
      new UploadPartCommand({
        Bucket: storage.bucket,
        Key: asset.data.object_key!,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn: 60 * 60 },
    ),
  })));

  return NextResponse.json({ parts });
}
