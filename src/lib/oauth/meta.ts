import "server-only";

export type MetaPlatform = "instagram" | "facebook";

export function getMetaGraphBaseUrl() {
  const graphBaseUrl = process.env.META_GRAPH_BASE_URL;
  return graphBaseUrl ? graphBaseUrl.replace(/\/$/, "") : null;
}

function getMetaRedirectUri() {
  const appPublicUrl = process.env.APP_PUBLIC_URL;
  if (!appPublicUrl) return null;

  try {
    return new URL("/api/oauth/meta/callback", appPublicUrl).toString();
  } catch {
    return null;
  }
}

export function getMetaOAuthConfig() {
  const clientId = process.env.META_CLIENT_ID;
  const clientSecret = process.env.META_CLIENT_SECRET;
  const authorizeUrl = process.env.META_OAUTH_AUTHORIZE_URL;
  const tokenUrl = process.env.META_OAUTH_TOKEN_URL;
  const graphBaseUrl = getMetaGraphBaseUrl();
  const redirectUri = getMetaRedirectUri();
  const scopes = (process.env.META_OAUTH_SCOPES ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  if (!clientId || !clientSecret || !authorizeUrl || !tokenUrl || !graphBaseUrl || !redirectUri || !scopes.length) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    authorizeUrl,
    tokenUrl,
    graphBaseUrl,
    redirectUri,
    scopes,
  };
}

export function isMetaPlatform(value: string | null): value is MetaPlatform {
  return value === "instagram" || value === "facebook";
}
