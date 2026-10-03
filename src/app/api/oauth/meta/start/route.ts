import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getMetaOAuthConfig,
  getMetaOAuthReadiness,
  isMetaPurpose,
  type MetaPurpose,
} from "@/lib/oauth/meta";

export const runtime = "nodejs";

function safeReturn(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/conexoes";
  return value;
}

function redirectWithError(request: NextRequest, code: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/conexoes";
  url.search = "";
  url.searchParams.set("oauth", code);
  return NextResponse.redirect(url);
}

function resolvePurpose(request: NextRequest): MetaPurpose | "instagram_direct" | null {
  const explicit = request.nextUrl.searchParams.get("purpose");
  if (isMetaPurpose(explicit)) return explicit;

  const platform = request.nextUrl.searchParams.get("platform");
  if (platform === "facebook") return "facebook";
  if (platform === "instagram") return "instagram_direct";
  return null;
}

export async function GET(request: NextRequest) {
  const purpose = resolvePurpose(request);
  const brandId = request.nextUrl.searchParams.get("brand_id");
  const connectionId = request.nextUrl.searchParams.get("connection_id");
  const returnTo = safeReturn(request.nextUrl.searchParams.get("return_to"));

  if (!purpose || !brandId) return redirectWithError(request, "meta_invalid_request");

  if (purpose === "instagram_direct") {
    const instagram = request.nextUrl.clone();
    instagram.pathname = "/api/oauth/instagram/start";
    instagram.search = "";
    instagram.searchParams.set("brand_id", brandId);
    instagram.searchParams.set("return_to", returnTo);
    return NextResponse.redirect(instagram);
  }

  if (purpose === "instagram_advanced" && !connectionId) {
    return redirectWithError(request, "meta_invalid_request");
  }

  const readiness = getMetaOAuthReadiness(purpose);
  const config = getMetaOAuthConfig(purpose);
  if (!config) {
    console.warn("meta_oauth_not_configured", { purpose, ...readiness });
    if (!readiness.clientIdValid) return redirectWithError(request, "meta_client_id_invalid");
    if (!readiness.clientSecretPresent) return redirectWithError(request, "meta_client_secret_missing");
    if (!readiness.loginConfigIdValid) return redirectWithError(request, "meta_login_config_missing");
    if (!readiness.redirectUriPresent) return redirectWithError(request, "meta_redirect_missing");
    return redirectWithError(request, "meta_not_configured");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return redirectWithError(request, "auth_not_configured");

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id,organization_id")
    .eq("id", brandId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .single();

  if (brandError || !brand) return redirectWithError(request, "brand_not_accessible");

  if (purpose === "instagram_advanced") {
    const { data: connection, error: connectionError } = await supabase
      .from("social_connections")
      .select("id,brand_id,organization_id,provider,connection_status")
      .eq("id", connectionId as string)
      .eq("brand_id", brand.id)
      .eq("organization_id", brand.organization_id)
      .eq("provider", "instagram")
      .single();

    if (connectionError || !connection || connection.connection_status === "REVOKED") {
      return redirectWithError(request, "instagram_advanced_invalid_connection");
    }
  }

  const state = randomBytes(32).toString("base64url");
  const authorization = new URL(config.authorizeUrl);
  authorization.searchParams.set("client_id", config.clientId);
  authorization.searchParams.set("redirect_uri", config.redirectUri);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("config_id", config.loginConfigId);
  authorization.searchParams.set("state", state);

  const response = NextResponse.redirect(authorization);
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api/oauth/meta",
    maxAge: 10 * 60,
  };

  response.cookies.set("tela_meta_state", state, cookieOptions);
  response.cookies.set("tela_meta_brand", brand.id, cookieOptions);
  response.cookies.set("tela_meta_purpose", purpose, cookieOptions);
  response.cookies.set("tela_meta_return", returnTo, cookieOptions);
  if (connectionId) response.cookies.set("tela_meta_connection", connectionId, cookieOptions);

  return response;
}
