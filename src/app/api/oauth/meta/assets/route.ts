import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createUntypedSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/oauth/token-crypto";
import { getMetaGraphBaseUrl } from "@/lib/oauth/meta";

export const runtime = "nodejs";

type MetaAssetAction = "facebook" | "instagram_advanced" | "verify_instagram_link";

type MetaAssetRow = {
  id: string;
  page_id: string;
  page_name: string;
  instagram_business_account_id: string | null;
  instagram_username: string | null;
};

type InstagramProfile = {
  id?: string;
  username?: string;
  name?: string;
  error?: { message?: string };
};

function normalizeUsername(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^@+/, "").toLowerCase();
}

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

async function refreshMetaAssetInstagram(
  admin: NonNullable<ReturnType<typeof createUntypedSupabaseAdminClient>>,
  asset: MetaAssetRow,
) {
  const credential = await admin.rpc("server_get_meta_asset_credential", {
    p_meta_asset_id: asset.id,
  });
  const row = Array.isArray(credential.data) ? credential.data[0] : credential.data;
  if (credential.error || !row?.access_token_ciphertext) return asset;

  const pageAccessToken = await decryptToken(String(row.access_token_ciphertext));
  const pageUrl = new URL(`${getMetaGraphBaseUrl()}/${encodeURIComponent(asset.page_id)}`);
  pageUrl.searchParams.set("fields", "instagram_business_account");
  pageUrl.searchParams.set("access_token", pageAccessToken);

  const pageResponse = await fetch(pageUrl, { cache: "no-store" });
  const pageBody = await pageResponse.json() as {
    instagram_business_account?: { id?: string };
    error?: { message?: string };
  };
  if (!pageResponse.ok || pageBody.error || !pageBody.instagram_business_account?.id) return asset;

  const igId = pageBody.instagram_business_account.id;
  const profileUrl = new URL(`${getMetaGraphBaseUrl()}/${encodeURIComponent(igId)}`);
  profileUrl.searchParams.set("fields", "id,username,name");
  profileUrl.searchParams.set("access_token", pageAccessToken);
  const profileResponse = await fetch(profileUrl, { cache: "no-store" });
  const profile = await profileResponse.json() as InstagramProfile;
  if (!profileResponse.ok || profile.error) return asset;

  await admin
    .from("meta_assets")
    .update({
      instagram_business_account_id: igId,
      instagram_username: profile.username ?? null,
      instagram_name: profile.name ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", asset.id);

  return {
    ...asset,
    instagram_business_account_id: igId,
    instagram_username: profile.username ?? null,
  };
}

export async function GET(request: NextRequest) {
  const brandId = request.nextUrl.searchParams.get("brand_id");
  if (!brandId) return NextResponse.json({ error: "brand_id_required" }, { status: 400 });

  const context = await contextForBrand(brandId);
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.error === "session_expired" ? 401 : 403 });
  }

  const admin = createUntypedSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "server_not_configured" }, { status: 500 });

  const { brand } = context;
  const result = await admin
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

  if (!body?.brand_id || !body.action) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const context = await contextForBrand(body.brand_id);
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.error === "session_expired" ? 401 : 403 });
  }

  const admin = createUntypedSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "server_not_configured" }, { status: 500 });

  const { supabase, brand } = context;

  if (body.action === "verify_instagram_link") {
    if (!body.connection_id) return NextResponse.json({ error: "connection_id_required" }, { status: 400 });

    const connectionResult = await supabase
      .from("social_connections")
      .select("id,provider_account_id,username,provider,brand_id,organization_id")
      .eq("id", body.connection_id)
      .eq("provider", "instagram")
      .eq("brand_id", brand.id)
      .eq("organization_id", brand.organization_id)
      .single();

    if (connectionResult.error || !connectionResult.data) {
      return NextResponse.json({ error: "instagram_connection_not_accessible" }, { status: 404 });
    }

    const targetId = connectionResult.data.provider_account_id;
    const targetUsername = normalizeUsername(connectionResult.data.username);
    const assetsResult = await admin
      .from("meta_assets")
      .select("id,page_id,page_name,instagram_business_account_id,instagram_username")
      .eq("brand_id", brand.id)
      .eq("organization_id", brand.organization_id)
      .eq("status", "ACTIVE");

    if (assetsResult.error) return NextResponse.json({ error: "meta_assets_read_failed" }, { status: 500 });

    let matching: MetaAssetRow | null = null;
    for (const original of (assetsResult.data ?? []) as MetaAssetRow[]) {
      const asset = await refreshMetaAssetInstagram(admin, original);
      const idMatches = Boolean(targetId && asset.instagram_business_account_id === targetId);
      const usernameMatches = Boolean(
        targetUsername
        && normalizeUsername(asset.instagram_username) === targetUsername
      );
      if (idMatches || usernameMatches) {
        matching = asset;
        break;
      }
    }

    if (!matching) {
      await admin.rpc("server_mark_instagram_meta_authorized", {
        p_connection_id: body.connection_id,
        p_link_required: true,
      });
      return NextResponse.json({ ok: true, linked: false });
    }

    const enable = await admin.rpc("server_enable_instagram_advanced", {
      p_connection_id: body.connection_id,
      p_meta_asset_id: matching.id,
    });
    if (enable.error) return NextResponse.json({ error: "instagram_advanced_enable_failed" }, { status: 500 });
    return NextResponse.json({ ok: true, linked: true });
  }

  if (!body.asset_id) return NextResponse.json({ error: "asset_id_required" }, { status: 400 });

  const assetResult = await admin
    .from("meta_assets")
    .select("id,page_id,instagram_business_account_id,instagram_username")
    .eq("id", body.asset_id)
    .eq("brand_id", brand.id)
    .eq("organization_id", brand.organization_id)
    .eq("status", "ACTIVE")
    .single();

  if (assetResult.error || !assetResult.data) {
    return NextResponse.json({ error: "meta_asset_not_accessible" }, { status: 404 });
  }

  if (body.action === "facebook") {
    const result = await admin.rpc("server_connect_facebook_meta_asset", {
      p_meta_asset_id: body.asset_id,
    });
    if (result.error) return NextResponse.json({ error: "facebook_connect_failed" }, { status: 500 });
    return NextResponse.json({ ok: true, connection_id: result.data });
  }

  if (!body.connection_id) return NextResponse.json({ error: "connection_id_required" }, { status: 400 });

  const connectionResult = await supabase
    .from("social_connections")
    .select("id,provider_account_id,username,provider,brand_id,organization_id")
    .eq("id", body.connection_id)
    .eq("provider", "instagram")
    .eq("brand_id", brand.id)
    .eq("organization_id", brand.organization_id)
    .single();

  if (connectionResult.error || !connectionResult.data) {
    return NextResponse.json({ error: "instagram_connection_not_accessible" }, { status: 404 });
  }

  const idMatches = assetResult.data.instagram_business_account_id === connectionResult.data.provider_account_id;
  const usernameMatches = Boolean(
    normalizeUsername(assetResult.data.instagram_username)
    && normalizeUsername(assetResult.data.instagram_username) === normalizeUsername(connectionResult.data.username)
  );
  if (!idMatches && !usernameMatches) {
    return NextResponse.json({ error: "instagram_not_linked_to_meta_asset" }, { status: 409 });
  }

  const result = await admin.rpc("server_enable_instagram_advanced", {
    p_connection_id: body.connection_id,
    p_meta_asset_id: body.asset_id,
  });
  if (result.error) return NextResponse.json({ error: "instagram_advanced_enable_failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
