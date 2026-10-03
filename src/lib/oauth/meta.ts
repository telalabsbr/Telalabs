import "server-only";

export type MetaPurpose = "facebook" | "instagram_advanced";

const DEFAULT_GRAPH_BASE_URL = "https://graph.facebook.com/v26.0";
const DEFAULT_AUTHORIZE_URL = "https://www.facebook.com/v26.0/dialog/oauth";

const PURPOSE_SCOPES: Record<MetaPurpose, string[]> = {
  facebook: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
  instagram_advanced: [
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
  ],
};

export function getMetaGraphBaseUrl() {
  return (process.env.META_GRAPH_BASE_URL || DEFAULT_GRAPH_BASE_URL).replace(/\/$/, "");
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

function extraScopes() {
  return (process.env.META_OAUTH_SCOPES ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
}

export function scopesForMetaPurpose(purpose: MetaPurpose) {
  return Array.from(new Set([...PURPOSE_SCOPES[purpose], ...extraScopes()]));
}

function validMetaAppId(value: string | undefined) {
  return Boolean(value && /^\d+$/.test(value.trim()));
}

export function getMetaOAuthConfig(purpose: MetaPurpose) {
  // Facebook Login usa explicitamente as credenciais do app Meta/Facebook.
  // Não reutilize INSTAGRAM_CLIENT_ID/SECRET como fallback: o Instagram Login
  // direto pode usar credenciais próprias que o diálogo OAuth do Facebook rejeita.
  const clientId = process.env.META_CLIENT_ID?.trim();
  const clientSecret = process.env.META_CLIENT_SECRET?.trim();
  const graphBaseUrl = getMetaGraphBaseUrl();
  const authorizeUrl = process.env.META_OAUTH_AUTHORIZE_URL || DEFAULT_AUTHORIZE_URL;
  const tokenUrl = process.env.META_OAUTH_TOKEN_URL || `${graphBaseUrl}/oauth/access_token`;
  const redirectUri = getMetaRedirectUri();
  const scopes = scopesForMetaPurpose(purpose);

  if (!validMetaAppId(clientId) || !clientSecret || !redirectUri || !scopes.length) return null;

  return {
    clientId: clientId as string,
    clientSecret,
    authorizeUrl,
    tokenUrl,
    graphBaseUrl,
    redirectUri,
    scopes,
  };
}

export function isMetaPurpose(value: string | null): value is MetaPurpose {
  return value === "facebook" || value === "instagram_advanced";
}
