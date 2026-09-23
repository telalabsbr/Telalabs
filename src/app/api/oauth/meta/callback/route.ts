import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/oauth/token-crypto";
import { getMetaOAuthConfig, isMetaPlatform, type MetaPlatform } from "@/lib/oauth/meta";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type MetaTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message?: string };
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
  error?: { message?: string };
};

type InstagramProfile = {
  id?: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  error?: { message?: string };
};

function cleanup(response: NextResponse) {
  for (const name of ["tela_meta_state", "tela_meta_brand", "tela_meta_platform", "tela_meta_return"]) {
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
  if (!response.ok || body.error) throw new Error("meta_account_discovery_failed");
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

async function persistConnection(args: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  organizationId: string;
  brandId: string;
  platform: MetaPlatform;
  providerAccountId: string;
  displayName: string;
  username?: string | null;
  scopes: string[];
  token: string;
  tokenExpiresAt?: string | null;
  metadata: Record<string, unknown>;
}) {
  const { admin } = args;
  if (!admin) throw new Error("admin_not_configured");

  const encrypted = await encryptToken(args.token);
  const result = await admin.rpc("server_upsert_oauth_connection", {
    p_organization_id: args.organizationId,
    p_brand_id: args.brandId,
    p_provider: args.platform,
    p_provider_account_id: args.providerAccountId,
    p_display_name: args.displayName,
    p_username: args.username ?? "",
    p_scopes: args.scopes,
    // O parâmetro SQL aceita NULL, apesar do gerador de tipos de RPC expor string.
    p_token_expires_at: args.tokenExpiresAt as string,
    p_metadata: args.metadata as Json,
    p_access_token_ciphertext: encrypted,
    p_key_version: "aes-gcm-v1",
  });

  if (result.error) throw new Error("credential_persist_failed");
}

export async function GET(request: NextRequest) {
  const config = getMetaOAuthConfig();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("tela_meta_state")?.value;
  const brandId = request.cookies.get("tela_meta_brand")?.value;
  const platformRaw = request.cookies.get("tela_meta_platform")?.value ?? null;
  const returnTo = request.cookies.get("tela_meta_return")?.value || "/conexoes";

  if (!config) return redirectResult(request, returnTo, "meta_not_configured");
  if (!code || !state || !expectedState || state !== expectedState || !brandId || !isMetaPlatform(platformRaw)) {
    return redirectResult(request, returnTo, "meta_state_invalid");
  }

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
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

  try {
    const tokenUrl = new URL(config.tokenUrl);
    tokenUrl.searchParams.set("client_id", config.clientId);
    tokenUrl.searchParams.set("client_secret", config.clientSecret);
    tokenUrl.searchParams.set("redirect_uri", config.redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const tokenBody = await tokenResponse.json() as MetaTokenResponse;

    if (!tokenResponse.ok || tokenBody.error || !tokenBody.access_token) {
      return redirectResult(request, returnTo, "meta_token_failed");
    }

    const expiresAt = tokenBody.expires_in
      ? new Date(Date.now() + tokenBody.expires_in * 1000).toISOString()
      : null;

    const pages = await discoverAccounts(config.graphBaseUrl, tokenBody.access_token);
    let connected = 0;

    for (const page of pages) {
      if (!page.id || !page.access_token) continue;

      if (platformRaw === "facebook") {
        await persistConnection({
          admin,
          organizationId: brand.organization_id,
          brandId: brand.id,
          platform: "facebook",
          providerAccountId: page.id,
          displayName: page.name || "Página do Facebook",
          scopes: config.scopes,
          token: page.access_token,
          tokenExpiresAt: expiresAt,
          metadata: {
            source: "meta_oauth",
            page_tasks: page.tasks ?? [],
          },
        });
        connected += 1;
        continue;
      }

      const igId = page.instagram_business_account?.id;
      if (!igId) continue;

      const profile = await instagramProfile(config.graphBaseUrl, igId, page.access_token);
      await persistConnection({
        admin,
        organizationId: brand.organization_id,
        brandId: brand.id,
        platform: "instagram",
        providerAccountId: igId,
        displayName: profile?.name || profile?.username || page.name || "Instagram profissional",
        username: profile?.username ?? null,
        scopes: config.scopes,
        token: page.access_token,
        tokenExpiresAt: expiresAt,
        metadata: {
          source: "meta_oauth",
          linked_page_id: page.id,
          linked_page_name: page.name ?? null,
          profile_picture_url: profile?.profile_picture_url ?? null,
        },
      });
      connected += 1;
    }

    return redirectResult(
      request,
      returnTo,
      connected > 0 ? "meta_connected" : "meta_no_eligible_accounts",
      connected,
    );
  } catch {
    return redirectResult(request, returnTo, "meta_callback_failed");
  }
}
