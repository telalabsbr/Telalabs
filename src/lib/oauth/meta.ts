import "server-only";

export type MetaPurpose = "facebook" | "instagram_advanced";

// App ID é público. Fixamos o app oficial de Facebook Login for Business do Tela Social
// para impedir que uma variável antiga da Vercel volte a abrir o app Meta legado.
export const TELA_SOCIAL_META_APP_ID = "1572136891356481";

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

function validNumericId(value: string | undefined) {
  return Boolean(value && /^\d+$/.test(value.trim()));
}

export function getMetaOAuthReadiness(purpose: MetaPurpose) {
  const clientSecret = process.env.META_CLIENT_SECRET?.trim();
  const loginConfigId = process.env.META_LOGIN_CONFIG_ID?.trim();
  const redirectUri = getMetaRedirectUri();
  const scopes = scopesForMetaPurpose(purpose);

  return {
    clientIdValid: validNumericId(TELA_SOCIAL_META_APP_ID),
    clientSecretPresent: Boolean(clientSecret),
    loginConfigIdValid: validNumericId(loginConfigId),
    redirectUriPresent: Boolean(redirectUri),
    scopesPresent: scopes.length > 0,
  };
}

export function getMetaOAuthConfig(purpose: MetaPurpose) {
  // Facebook Login for Business: permissões vêm do config_id da Meta.
  // O App ID público fica fixo no código; somente o App Secret permanece no ambiente.
  const clientId = TELA_SOCIAL_META_APP_ID;
  const clientSecret = process.env.META_CLIENT_SECRET?.trim();
  const loginConfigId = process.env.META_LOGIN_CONFIG_ID?.trim();
  const graphBaseUrl = getMetaGraphBaseUrl();
  const authorizeUrl = process.env.META_OAUTH_AUTHORIZE_URL || DEFAULT_AUTHORIZE_URL;
  const tokenUrl = process.env.META_OAUTH_TOKEN_URL || `${graphBaseUrl}/oauth/access_token`;
  const redirectUri = getMetaRedirectUri();
  const scopes = scopesForMetaPurpose(purpose);
  const readiness = getMetaOAuthReadiness(purpose);

  if (
    !readiness.clientIdValid ||
    !readiness.clientSecretPresent ||
    !readiness.loginConfigIdValid ||
    !readiness.redirectUriPresent ||
    !clientSecret ||
    !loginConfigId ||
    !redirectUri
  ) return null;

  return {
    clientId,
    clientSecret,
    loginConfigId,
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
