import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type MetaAssetAction = "facebook" | "instagram_advanced";

async function contextForBrand(brandId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "server_not_configured" as const };

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "session_expired" as const };

  const { data: brand, error } = await supabase
    .from("brands")
    .select("id,organization_id")
    .eq("id", brandId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .single();

  if (error || !brand) return { error: "brand_not_accessible" as const };
  return { supabase, brand };
}

export async function GET(request: NextRequest) {
  const brandId = request.nextUrl.searchParams.get("brand_id");
  if (!brandId) return NextResponse.json({ error: "brand_id_required" }, { status: 400 });

  const context = await contextForBrand(brandId);
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.error === "session_expired" ? 401 : 403 });
  }

  const { supabase, brand } = context;
  const result = await (supabase as any)
    .from("meta_assets")
    .select("id,page_id,page_name,page_tasks,instagram_business_account_id,instagram_username,instagram_name,status,discovered_at")
    .eq("brand_id", brand.id)
    .eq("organization_id", brand.organization_id)
    .eq("status", "ACTIVE")
    .order("page_name");

  if (result.error) return NextResponse.json({ error: "meta_assets_read_failed" }, { status: 500 });
  return NextResponse.json({ assets: result.data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    brand_id?: string;
    asset_id?: string;
    action?: MetaAssetAction;
    connection_id?: string;
  } | null;

  if (!body?.brand_id || !body.asset_id || !body.action) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const context = await contextForBrand(body.brand_id);
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.error === "session_expired" ? 401 : 403 });
  }

  const { supabase, brand } = context;
  const assetResult = await (supabase as any)
    .from("meta_assets")
    .select("id,page_id,instagram_business_account_id")
    .eq("id", body.asset_id)
    .eq("brand_id", brand.id)
    .eq("organization_id", brand.organization_id)
    .eq("status", "ACTIVE")
    .single();

  if (assetResult.error || !assetResult.data) {
    return NextResponse.json({ error: "meta_asset_not_accessible" }, { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "server_not_configured" }, { status: 500 });

  if (body.action === "facebook") {
    const result = await (admin as any).rpc("server_connect_facebook_meta_asset", {
      p_meta_asset_id: body.asset_id,
    });
    if (result.error) return NextResponse.json({ error: "facebook_connect_failed" }, { status: 500 });
    return NextResponse.json({ ok: true, connection_id: result.data });
  }

  if (!body.connection_id) return NextResponse.json({ error: "connection_id_required" }, { status: 400 });

  const connectionResult = await supabase
    .from("social_connections")
    .select("id,provider_account_id,provider,brand_id,organization_id")
    .eq("id", body.connection_id)
    .eq("provider", "instagram")
    .eq("brand_id", brand.id)
    .eq("organization_id", brand.organization_id)
    .single();

  if (connectionResult.error || !connectionResult.data) {
    return NextResponse.json({ error: "instagram_connection_not_accessible" }, { status: 404 });
  }

  if (assetResult.data.instagram_business_account_id !== connectionResult.data.provider_account_id) {
    return NextResponse.json({ error: "instagram_not_linked_to_meta_asset" }, { status: 409 });
  }

  const result = await (admin as any).rpc("server_enable_instagram_advanced", {
    p_connection_id: body.connection_id,
    p_meta_asset_id: body.asset_id,
  });
  if (result.error) return NextResponse.json({ error: "instagram_advanced_enable_failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
