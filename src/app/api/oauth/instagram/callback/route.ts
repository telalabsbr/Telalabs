import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/oauth/token-crypto";
import { getInstagramOAuthConfig } from "@/lib/oauth/instagram";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type ShortTokenResponse = {
  access_token?: string;
  user_id?: number | string;
  permissions?: string;
  error_type?: string;
  code?: number;
  error_message?: string;
};

type LongTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

type InstagramProfile = {
  id?: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  account_type?: string;
  error?: { message?: string; type?: string; code?: number };
};

function safeReturn(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/conexoes";
  return value;
}

function cleanup(response: NextResponse) {
  for (const name of ["tela_instagram_state", "tela_instagram_brand", "tela_instagram_return", "tela_instagram_redirect"]) {
    response.cookies.set(name, "", { path: "/api/oauth/instagram", maxAge: 0 });
  }
  return response;
}

function cleanTracePart(value: string | number | undefined) {
  return String(value ?? "na").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "na";
}

function classifyOAuthError(message: string | undefined) {
  const value = (message ?? "").toLowerCase();
  if (!value) return "unknown";
  if (value.includes("invalid platform app")) return "invalid_platform_app";
  if (value.includes("redirect_uri") || value.includes("redirect uri") || value.includes("redirect")) return "redirect_uri";
  if (value.includes("client_secret") || value.includes("client secret") || value.includes("app secret")) return "client_secret";
  if (value.includes("client_id") || value.includes("client id") || value.includes("app id")) return "client_id";
  if (value.includes("authorization code") || value.includes("auth code") || value.includes("code has been used") || value.includes("invalid code")) return "authorization_code";
  return "oauth_error";
}

function redirectResult(request: NextRequest, returnTo: string, code: string, trace = code) {
  const url = new URL(returnTo, request.nextUrl.origin);
  url.searchParams.set("oauth", code);
  url.searchParams.set("oauth_trace", `igcb_v5_${trace}`);
  return cleanup(NextResponse.redirect(url));
}

export async function GET(request: NextRequest) {
  const config = getInstagramOAuthConfig();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("tela_instagram_state")?.value;
  const brandId = request.cookies.get("tela_instagram_brand")?.value;
  const returnTo = safeReturn(request.cookies.get("tela_instagram_return")?.value);
  const redirectUri = request.cookies.get("tela_instagram_redirect")?.value;

  if (!config) return redirectResult(request, returnTo, "meta_not_configured");
  if (!code || !state || !expectedState || state !== expectedState || !brandId || !redirectUri) {
    return redirectResult(request, returnTo, "meta_state_invalid", "state_or_redirect_missing");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return redirectResult(request, returnTo, "server_not_configured", "server_supabase_missing");

  const admin = createSupabaseAdminClient();
  if (!admin) return redirectResult(request, returnTo, "server_not_configured", "server_admin_missing");

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

  try {
    const tokenForm = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });

    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenForm.toString(),
      cache: "no-store",
    });
    const shortToken = await tokenResponse.json() as ShortTokenResponse;

    if (!tokenResponse.ok || !shortToken.access_token) {
      const reason = classifyOAuthError(shortToken.error_message);
      const trace = [
        "short_token_failed",
        `s${cleanTracePart(tokenResponse.status)}`,
        `c${cleanTracePart(shortToken.code)}`,
        `t${cleanTracePart(shortToken.error_type)}`,
        `r${reason}`,
      ].join("_");
      console.warn("instagram_oauth_short_token_failed", {
        status: tokenResponse.status,
        code: shortToken.code ?? null,
        errorType: shortToken.error_type ?? null,
        reason,
        redirectMatchesConfig: redirectUri === config.redirectUri,
      });
      return redirectResult(request, returnTo, "meta_token_failed", trace);
    }

    const exchangeUrl = new URL(config.graphBaseUrl + "/access_token");
    exchangeUrl.searchParams.set("grant_type", "ig_exchange_token");
    exchangeUrl.searchParams.set("client_secret", config.clientSecret);
    exchangeUrl.searchParams.set("access_token", shortToken.access_token);

    const exchangeResponse = await fetch(exchangeUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const longToken = await exchangeResponse.json() as LongTokenResponse;

    if (!exchangeResponse.ok || longToken.error || !longToken.access_token) {
      const reason = classifyOAuthError(longToken.error?.message);
      const trace = [
        "long_token_failed",
        `s${cleanTracePart(exchangeResponse.status)}`,
        `c${cleanTracePart(longToken.error?.code)}`,
        `t${cleanTracePart(longToken.error?.type)}`,
        `r${reason}`,
      ].join("_");
      console.warn("instagram_oauth_long_token_failed", {
        status: exchangeResponse.status,
        code: longToken.error?.code ?? null,
        errorType: longToken.error?.type ?? null,
        reason,
      });
      return redirectResult(request, returnTo, "meta_token_failed", trace);
    }

    const profileUrl = new URL(config.graphBaseUrl + "/me");
    profileUrl.searchParams.set("fields", "id,username,name,profile_picture_url,account_type");
    profileUrl.searchParams.set("access_token", longToken.access_token);

    const profileResponse = await fetch(profileUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const profile = await profileResponse.json() as InstagramProfile;

    if (!profileResponse.ok || profile.error || (!profile.id && !shortToken.user_id)) {
      const trace = [
        "profile_failed",
        `s${cleanTracePart(profileResponse.status)}`,
        `c${cleanTracePart(profile.error?.code)}`,
        `t${cleanTracePart(profile.error?.type)}`,
      ].join("_");
      return redirectResult(request, returnTo, "meta_callback_failed", trace);
    }

    const providerAccountId = profile.id || String(shortToken.user_id);
    const expiresAt = longToken.expires_in
      ? new Date(Date.now() + longToken.expires_in * 1000).toISOString()
      : null;
    const encrypted = await encryptToken(longToken.access_token);

    const result = await admin.rpc("server_upsert_oauth_connection", {
      p_organization_id: brand.organization_id,
      p_brand_id: brand.id,
      p_provider: "instagram",
      p_provider_account_id: providerAccountId,
      p_display_name: profile.name || profile.username || "Instagram profissional",
      p_username: profile.username ?? "",
      p_scopes: config.scopes,
      p_token_expires_at: expiresAt as string,
      p_metadata: {
        source: "instagram_business_login",
        account_type: profile.account_type ?? null,
        profile_picture_url: profile.profile_picture_url ?? null,
      } as Json,
      p_access_token_ciphertext: encrypted,
      p_key_version: "aes-gcm-v1",
    });

    if (result.error) {
      console.warn("instagram_oauth_persist_failed", { code: result.error.code ?? null });
      return redirectResult(request, returnTo, "meta_callback_failed", `persist_failed_c${cleanTracePart(result.error.code)}`);
    }

    return redirectResult(request, returnTo, "meta_connected", "meta_connected");
  } catch (error) {
    console.warn("instagram_oauth_callback_exception", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return redirectResult(request, returnTo, "meta_callback_failed", "callback_exception");
  }
}
