import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createUntypedSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/oauth/token-crypto";
import { getMetaOAuthConfig, isMetaPurpose } from "@/lib/oauth/meta";

export const runtime = "nodejs";

type MetaTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message?: string; code?: number; type?: string };
};

type MetaPage = {
  id: string;
  name?: string;
  access_token?: string;
  tasks?: string[];
  instagram_business_account?: { id?: string };
};

type MetaAccountsResponse = {
  data?: MetaPage[];
  error?: { message?: string; code?: number; type?: string };
};

type InstagramProfile = {
  id?: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  error?: { message?: string };
};

function normalizeUsername(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^@+/, "").toLowerCase();
}

function safeReturn(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/conexoes";
  return value;
}

function cleanup(response: NextResponse) {
  for (const name of [
    "tela_meta_state",
    "tela_meta_brand",
    "tela_meta_purpose",
    "tela_meta_platform",
    "tela_meta_connection",
    "tela_meta_return",
  ]) {
    response.cookies.set(name, "", { path: "/api/oauth/meta", maxAge: 0 });
  }
  return response;
}

function redirectResult(request: NextRequest, returnTo: string, code: string, count?: number) {
  const url = new URL(returnTo, request.nextUrl.origin);
  url.searchParams.set("oauth", code);
  if (typeof count === "number") url.searchParams.set("count", String(count));
  return cleanup(NextResponse.redirect(url));
}

async function exchangeAuthorizationCode(config: NonNullable<ReturnType<typeof getMetaOAuthConfig>>, code: string) {
  const form = new URLSearchParams();
  form.set("client_id", config.clientId);
  form.set("client_secret", config.clientSecret);
  form.set("redirect_uri", config.redirectUri);
  form.set("code", code);

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    cache: "no-store",
  });
  const body = await response.json() as MetaTokenResponse;
  if (!response.ok || body.error || !body.access_token) {
    console.warn("meta_oauth_token_exchange_failed", {
      status: response.status,
      code: body.error?.code ?? null,
      type: body.error?.type ?? null,
      message: body.error?.message ?? null,
      clientId: config.clientId,
    });
    throw new Error("meta_token_failed");
  }
  return body.access_token;
}

async function exchangeLongLivedToken(config: NonNullable<ReturnType<typeof getMetaOAuthConfig>>, shortToken: string) {
  const form = new URLSearchParams();
  form.set("grant_type", "fb_exchange_token");
  form.set("client_id", config.clientId);
  form.set("client_secret", config.clientSecret);
  form.set("fb_exchange_token", shortToken);

  const response = await fetch(config.graphBaseUrl + "/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    cache: "no-store",
  });
  const body = await response.json() as MetaTokenResponse;
  if (!response.ok || body.error || !body.access_token) {
    console.warn("meta_oauth_long_token_exchange_failed", {
      status: response.status,
      code: body.error?.code ?? null,
      type: body.error?.type ?? null,
      message: body.error?.message ?? null,
      clientId: config.clientId,
    });
    throw new Error("meta_long_token_failed");
  }
  return body;
}

async function discoverAccounts(graphBaseUrl: string, userAccessToken: string) {
  const url = new URL(graphBaseUrl + "/me/accounts");
  url.searchParams.set("fields", "id,name,access_token,tasks,instagram_business_account");
  url.searchParams.set("access_token", userAccessToken);

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const body = await response.json() as MetaAccountsResponse;
  if (!response.ok || body.error) {
    console.warn("meta_oauth_account_discovery_failed", {
      status: response.status,
      code: body.error?.code ?? null,
      type: body.error?.type ?? null,
      message: body.error?.message ?? null,
    });
    throw new Error("meta_account_discovery_failed");
  }
  return body.data ?? [];
}

async function instagramProfile(graphBaseUrl: string, igId: string, pageAccessToken: string) {
  const url = new URL(graphBaseUrl + "/" + encodeURIComponent(igId));
  url.searchParams.set("fields", "id,username,name,profile_picture_url");
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const body = await response.json() as InstagramProfile;
  if (!response.ok || body.error) return null;
  return body;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");
  const oauthErrorReason = request.nextUrl.searchParams.get("error_reason");
  const oauthErrorDescription = request.nextUrl.searchParams.get("error_description");
  const oauthErrorCode = request.nextUrl.searchParams.get("error_code");
  const expectedState = request.cookies.get("tela_meta_state")?.value;
  const brandId = request.cookies.get("tela_meta_brand")?.value;
  const purposeRaw = request.cookies.get("tela_meta_purpose")?.value ?? null;
  const connectionId = request.cookies.get("tela_meta_connection")?.value;
  const returnTo = safeReturn(request.cookies.get("tela_meta_return")?.value);

  if (!isMetaPurpose(purposeRaw)) return redirectResult(request, returnTo, "meta_state_invalid");
  const config = getMetaOAuthConfig(purposeRaw);
  if (!config) return redirectResult(request, returnTo, "meta_not_configured");

  if (oauthError) {
    console.warn("meta_oauth_provider_error", {
      error: oauthError,
      reason: oauthErrorReason,
      description: oauthErrorDescription,
      code: oauthErrorCode,
      purpose: purposeRaw,
      clientId: config.clientId,
    });
    return redirectResult(request, returnTo, "meta_token_failed");
  }

  if (!code || !state || !expectedState || state !== expectedState || !brandId) {
    return redirectResult(request, returnTo, "meta_state_invalid");
  }

  const supabase = await createSupabaseServerClient();
  const admin = createUntypedSupabaseAdminClient();
  if (!supabase || !admin) return redirectResult(request, returnTo, "server_not_configured");

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return redirectResult(request, returnTo, "session_expired");

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id,organization_id")
    .eq("id", brandId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .single();

  if (brandError || !brand) return redirectResult(request, returnTo, "brand_not_accessible");

  let targetInstagramId: string | null = null;
  let targetInstagramUsername: string | null = null;
  if (purposeRaw === "instagram_advanced") {
    if (!connectionId) return redirectResult(request, returnTo, "instagram_advanced_invalid_connection");
    const { data: connection, error: connectionError } = await supabase
      .from("social_connections")
      .select("id,provider_account_id,username,provider,brand_id,organization_id")
      .eq("id", connectionId)
      .eq("provider", "instagram")
      .eq("brand_id", brand.id)
      .eq("organization_id", brand.organization_id)
      .single();
    if (connectionError || !connection) {
      return redirectResult(request, returnTo, "instagram_advanced_invalid_connection");
    }
    targetInstagramId = connection.provider_account_id;
    targetInstagramUsername = normalizeUsername(connection.username);
  }

  try {
    const shortToken = await exchangeAuthorizationCode(config, code);
    const longToken = await exchangeLongLivedToken(config, shortToken);
    const pages = await discoverAccounts(config.graphBaseUrl, longToken.access_token as string);

    let discovered = 0;
    let matchingAssetId: string | null = null;

    for (const page of pages) {
      if (!page.id || !page.access_token) continue;

      const igId = page.instagram_business_account?.id ?? null;
      const profile = igId
        ? await instagramProfile(config.graphBaseUrl, igId, page.access_token)
        : null;
      const encryptedPageToken = await encryptToken(page.access_token);

      const result = await admin.rpc("server_upsert_meta_asset", {
        p_organization_id: brand.organization_id,
        p_brand_id: brand.id,
        p_page_id: page.id,
        p_page_name: page.name || "Página do Facebook",
        p_page_tasks: page.tasks ?? [],
        p_instagram_business_account_id: igId ?? "",
        p_instagram_username: profile?.username ?? "",
        p_instagram_name: profile?.name ?? "",
        p_scopes: config.scopes,
        p_access_token_ciphertext: encryptedPageToken,
        p_expires_at: null,
        p_key_version: "aes-gcm-v1",
      });

      if (result.error || !result.data) {
        console.warn("meta_oauth_asset_persist_failed", { code: result.error?.code ?? null });
        throw new Error("meta_asset_persist_failed");
      }
      discovered += 1;

      const idMatches = Boolean(targetInstagramId && igId === targetInstagramId);
      const usernameMatches = Boolean(
        targetInstagramUsername
        && profile?.username
        && normalizeUsername(profile.username) === targetInstagramUsername
      );
      if (idMatches || usernameMatches) matchingAssetId = String(result.data);
    }

    if (purposeRaw === "instagram_advanced") {
      if (!connectionId) {
        return redirectResult(request, returnTo, "instagram_advanced_invalid_connection", discovered);
      }

      if (!matchingAssetId) {
        return redirectResult(request, returnTo, "instagram_advanced_not_linked", discovered);
      }

      const enable = await admin.rpc("server_enable_instagram_advanced", {
        p_connection_id: connectionId,
        p_meta_asset_id: matchingAssetId,
      });
      if (enable.error) {
        console.warn("meta_oauth_instagram_advanced_persist_failed", { code: enable.error.code ?? null });
        throw new Error("instagram_advanced_persist_failed");
      }
      return redirectResult(request, returnTo, "instagram_advanced_enabled", discovered);
    }

    return redirectResult(
      request,
      returnTo,
      discovered > 0 ? "meta_assets_ready" : "meta_no_eligible_accounts",
      discovered,
    );
  } catch (error) {
    const codeValue = error instanceof Error ? error.message : "meta_callback_failed";
    if (codeValue === "meta_token_failed" || codeValue === "meta_long_token_failed") {
      return redirectResult(request, returnTo, codeValue);
    }
    if (codeValue === "meta_account_discovery_failed") {
      return redirectResult(request, returnTo, "meta_account_discovery_failed");
    }
    return redirectResult(request, returnTo, "meta_callback_failed");
  }
}
