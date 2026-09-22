import "server-only";
import { getMetaGraphBaseUrl } from "@/lib/oauth/meta";
import type { PublishAdapterResult } from "./provider-registry";

type MetaGraphError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  is_transient?: boolean;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id?: string;
};

type MetaEnvelope<T> = T & { error?: MetaGraphError };

export type MetaResponse<T> = {
  ok: boolean;
  status: number;
  data: MetaEnvelope<T> | null;
  requestId: string | null;
  retryAfterSeconds: number | null;
};

function retryAfterSeconds(response: Response) {
  const header = response.headers.get("retry-after");
  if (!header) return null;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);

  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return null;
}

export async function metaGraphRequest<T>(args: {
  path: string;
  method?: "GET" | "POST";
  accessToken: string;
  params?: Record<string, string | number | boolean | null | undefined>;
}) {
  const baseUrl = getMetaGraphBaseUrl();
  if (!baseUrl) throw new Error("META_GRAPH_BASE_URL_NOT_CONFIGURED");

  const method = args.method ?? "GET";
  const url = new URL(baseUrl + (args.path.startsWith("/") ? args.path : "/" + args.path));
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(args.params ?? {})) {
    if (value === undefined || value === null) continue;
    if (method === "GET") url.searchParams.set(key, String(value));
    else body.set(key, String(value));
  }

  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });

  const data = await response.json().catch(() => null) as MetaEnvelope<T> | null;

  return {
    ok: response.ok && !data?.error,
    status: response.status,
    data,
    requestId: response.headers.get("x-fb-request-id") ?? data?.error?.fbtrace_id ?? null,
    retryAfterSeconds: retryAfterSeconds(response),
  } satisfies MetaResponse<T>;
}

export function classifyMetaFailure(response: MetaResponse<unknown>): PublishAdapterResult {
  const error = response.data?.error;
  const safeMessage = error?.error_user_msg || error?.error_user_title || error?.message || "A Meta recusou a publicação.";
  const code = error?.code ? `META_${error.code}` : `META_HTTP_${response.status}`;

  if (response.status === 401 || response.status === 403 || error?.code === 190) {
    return {
      outcome: "AUTH_REQUIRED",
      httpStatus: response.status,
      errorCode: code,
      errorMessageSafe: "A autorização da conta precisa ser renovada.",
      providerRequestId: response.requestId,
    };
  }

  if (response.status === 429) {
    return {
      outcome: "RATE_LIMIT",
      httpStatus: response.status,
      errorCode: code,
      errorMessageSafe: "A Meta limitou temporariamente novas solicitações.",
      providerRequestId: response.requestId,
      retryAfterSeconds: response.retryAfterSeconds,
    };
  }

  if (error?.is_transient || response.status >= 500) {
    return {
      outcome: "TRANSIENT_FAILURE",
      httpStatus: response.status,
      errorCode: code,
      errorMessageSafe: "A Meta apresentou uma falha temporária. O Tela Social tentará novamente.",
      providerRequestId: response.requestId,
      retryAfterSeconds: response.retryAfterSeconds,
    };
  }

  if (response.status === 400 || response.status === 422) {
    return {
      outcome: "INVALID_CONTENT",
      httpStatus: response.status,
      errorCode: code,
      errorMessageSafe: safeMessage,
      providerRequestId: response.requestId,
    };
  }

  return {
    outcome: "FAILED_FINAL",
    httpStatus: response.status,
    errorCode: code,
    errorMessageSafe: safeMessage,
    providerRequestId: response.requestId,
  };
}
