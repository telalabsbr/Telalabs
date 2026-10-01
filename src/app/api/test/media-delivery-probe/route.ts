import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadRuntimePublicationContext, issueMediaDeliveryUrl } from "@/integrations/social/runtime-context";

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

  let context;
  try {
    context = await loadRuntimePublicationContext(targetId);
  } catch (error) {
    return NextResponse.json({
      error: "target_context_failed",
      message: error instanceof Error ? error.message : "context_failed",
    }, { status: 404 });
  }

  const membership = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("organization_id", context.target.organization_id)
    .eq("user_id", authData.user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (membership.error || !membership.data) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let deliveryUrl: string;
  try {
    deliveryUrl = await issueMediaDeliveryUrl(context, 900);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      stage: "issue_delivery_url",
      error: error instanceof Error ? error.message : "issue_failed",
    }, { status: 500 });
  }

  let response: Response;
  try {
    response = await fetch(deliveryUrl, {
      redirect: "follow",
      cache: "no-store",
      headers: { Range: "bytes=0-15" },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      stage: "provider_url_fetch",
      deliveryHost: safeHost(deliveryUrl),
      error: error instanceof Error ? error.message : "fetch_failed",
    });
  }

  const bytes = new Uint8Array(await response.arrayBuffer().catch(() => new ArrayBuffer(0)));
  const hexPrefix = Array.from(bytes.slice(0, 8)).map(value => value.toString(16).padStart(2, "0")).join("");

  return NextResponse.json({
    ok: response.ok || response.status === 206,
    stage: "provider_url_response",
    deliveryHost: safeHost(deliveryUrl),
    finalHost: safeHost(response.url),
    response: {
      status: response.status,
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
      contentRange: response.headers.get("content-range"),
      jpegMagic: hexPrefix.startsWith("ffd8ff"),
      hexPrefix,
    },
  });
}
