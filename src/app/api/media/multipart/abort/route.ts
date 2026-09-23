import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
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
  };

  const mediaId = body?.media_id ?? "";
  const uploadId = body?.upload_id ?? "";

  if (!mediaId || !uploadId) {
    return NextResponse.json({ error: "invalid_abort_request" }, { status: 400 });
  }

  const asset = await supabase
    .from("media_assets")
    .select("id,object_key,organization_id")
    .eq("id", mediaId)
    .is("deleted_at", null)
    .single();

  if (asset.error || !asset.data?.object_key) {
    return NextResponse.json({ error: "media_not_accessible" }, { status: 404 });
  }

  try {
    await storage.client.send(new AbortMultipartUploadCommand({
      Bucket: storage.bucket,
      Key: asset.data.object_key,
      UploadId: uploadId,
    }));
  } catch {
    // Mesmo se o multipart já tiver expirado ou sido abortado, encerramos o registro local.
  }

  await supabase
    .from("media_assets")
    .update({
      processing_status: "DELETED",
      deleted_at: new Date().toISOString(),
    })
    .eq("id", mediaId)
    .eq("organization_id", asset.data.organization_id);

  return NextResponse.json({ media_id: mediaId, status: "ABORTED" });
}
