import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMetaOAuthConfig, isMetaPlatform } from "@/lib/oauth/meta";

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

export async function GET(request: NextRequest) {
  const config = getMetaOAuthConfig();
  if (!config) return redirectWithError(request, "meta_not_configured");

  const platform = request.nextUrl.searchParams.get("platform");
  const brandId = request.nextUrl.searchParams.get("brand_id");
  const returnTo = safeReturn(request.nextUrl.searchParams.get("return_to"));

  if (!isMetaPlatform(platform) || !brandId) {
    return redirectWithError(request, "meta_invalid_request");
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

  const state = randomBytes(32).toString("base64url");
  const authorization = new URL(config.authorizeUrl);
  authorization.searchParams.set("client_id", config.clientId);
  authorization.searchParams.set("redirect_uri", config.redirectUri);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", config.scopes.join(","));
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
  response.cookies.set("tela_meta_platform", platform, cookieOptions);
  response.cookies.set("tela_meta_return", returnTo, cookieOptions);

  return response;
}
