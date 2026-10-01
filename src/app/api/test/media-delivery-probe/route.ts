import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createUntypedSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeHost(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "preview_only" }, { status: 404 });
  }

  const targetId = request.nextUrl.searchParams.get("target_id");
  if (!targetId) {
    return NextResponse.json({ error: "target_id_required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createUntypedSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_admin_not_configured" }, { status: 503 });

  const target = await admin
    .from("post_targets")
    .select("id,organization_id")
    .eq("id", targetId)
    .maybeSingle();

  if (target.error || !target.data) {
    return NextResponse.json({ error: "target_not_found" }, { status: 404 });
  }

  const membership = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("organization_id", target.data.organization_id)
    .eq("user_id", authData.user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (membership.error || !membership.data) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const link = await admin
    .from("post_target_media")
    .select("media_asset_id")
    .eq("post_target_id", targetId)
    .eq("position", 0)
    .maybeSingle();

  if (link.error || !link.data?.media_asset_id) {
    return NextResponse.json({ error: "media_not_attached" }, { status: 404 });
  }

  const issue = await admin.rpc("server_issue_media_delivery_token", {
    p_post_target_id: targetId,
    p_media_asset_id: link.data.media_asset_id,
    p_ttl_seconds: 900,
  });

  if (issue.error || !issue.data) {
    return NextResponse.json({ error: "delivery_token_failed", message: issue.error?.message ?? null }, { status: 500 });
  }

  const appPublicUrl = process.env.APP_PUBLIC_URL;
  if (!appPublicUrl) {
    return NextResponse.json({ error: "app_public_url_missing" }, { status: 503 });
  }

  const deliveryUrl = new URL(`/d/${issue.data}`, appPublicUrl).toString();

  let first: Response;
  try {
    first = await fetch(deliveryUrl, { redirect: "manual", cache: "no-store" });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      stage: "delivery_route_fetch",
      error: error instanceof Error ? error.message : "fetch_failed",
    });
  }

  const firstLocation = first.headers.get("location");
  const firstInfo = {
    status: first.status,
    contentType: first.headers.get("content-type"),
    locationHost: safeHost(firstLocation),
    server: first.headers.get("server"),
  };

  if (!firstLocation || first.status < 300 || first.status >= 400) {
    const text = await first.text().catch(() => "");
    return NextResponse.json({
      ok: false,
      stage: "delivery_route",
      deliveryRoute: firstInfo,
      bodyLooksHtml: /<html|<!doctype/i.test(text),
      bodyPreview: text.slice(0, 120),
    });
  }

  let storageResponse: Response;
  try {
    storageResponse = await fetch(firstLocation, {
      redirect: "manual",
      cache: "no-store",
      headers: { Range: "bytes=0-15" },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      stage: "storage_fetch",
      deliveryRoute: firstInfo,
      error: error instanceof Error ? error.message : "fetch_failed",
    });
  }

  const bytes = new Uint8Array(await storageResponse.arrayBuffer().catch(() => new ArrayBuffer(0)));
  const hexPrefix = Array.from(bytes.slice(0, 8)).map(value => value.toString(16).padStart(2, "0")).join("");

  return NextResponse.json({
    ok: storageResponse.ok || storageResponse.status === 206,
    stage: "storage_response",
    deliveryRoute: firstInfo,
    storage: {
      status: storageResponse.status,
      contentType: storageResponse.headers.get("content-type"),
      contentLength: storageResponse.headers.get("content-length"),
      contentRange: storageResponse.headers.get("content-range"),
      jpegMagic: hexPrefix.startsWith("ffd8ff"),
      hexPrefix,
    },
  });
}
