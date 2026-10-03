import "server-only";

const DEFAULT_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const DEFAULT_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const DEFAULT_GRAPH_BASE_URL = "https://graph.instagram.com";
const DEFAULT_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
];

function getRedirectUri() {
  const appPublicUrl = process.env.APP_PUBLIC_URL;
  if (!appPublicUrl) return null;

  try {
    return new URL("/api/oauth/instagram/callback", appPublicUrl).toString();
  } catch {
    return null;
  }
}

export function getInstagramOAuthConfig() {
  const clientId = process.env.INSTAGRAM_CLIENT_ID;
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
  const redirectUri = getRedirectUri();
  const scopes = (process.env.INSTAGRAM_OAUTH_SCOPES ?? DEFAULT_SCOPES.join(","))
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  if (!clientId || !clientSecret || !redirectUri || !scopes.length) return null;

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes,
    authorizeUrl: process.env.INSTAGRAM_OAUTH_AUTHORIZE_URL || DEFAULT_AUTHORIZE_URL,
    tokenUrl: process.env.INSTAGRAM_OAUTH_TOKEN_URL || DEFAULT_TOKEN_URL,
    graphBaseUrl: (process.env.INSTAGRAM_GRAPH_BASE_URL || DEFAULT_GRAPH_BASE_URL).replace(/\/$/, ""),
  };
}
