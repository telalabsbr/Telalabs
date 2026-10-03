import { NextResponse } from "next/server";
import { getMetaOAuthConfig, getMetaOAuthReadiness } from "@/lib/oauth/meta";

export const runtime = "nodejs";

export async function GET() {
  const readiness = getMetaOAuthReadiness("instagram_advanced");
  const config = getMetaOAuthConfig("instagram_advanced");

  return NextResponse.json({
    clientId: config?.clientId ?? process.env.META_CLIENT_ID?.trim() ?? null,
    loginConfigId: config?.loginConfigId ?? process.env.META_LOGIN_CONFIG_ID?.trim() ?? null,
    redirectUri: config?.redirectUri ?? null,
    clientSecretPresent: readiness.clientSecretPresent,
    clientIdValid: readiness.clientIdValid,
    loginConfigIdValid: readiness.loginConfigIdValid,
    redirectUriPresent: readiness.redirectUriPresent,
  });
}
