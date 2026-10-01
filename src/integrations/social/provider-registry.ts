import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import { instagramPublishAdapter } from "./instagram-adapter";

export type WorkerOutcome =
  | "SUCCEEDED"
  | "TRANSIENT_FAILURE"
  | "RATE_LIMIT"
  | "AUTH_REQUIRED"
  | "INVALID_CONTENT"
  | "UNKNOWN"
  | "FAILED_FINAL";

export type ReconcileOutcome =
  | "SUCCEEDED"
  | "SAFE_TO_RETRY"
  | "TRANSIENT_FAILURE"
  | "RATE_LIMIT"
  | "AUTH_REQUIRED"
  | "UNKNOWN"
  | "FAILED_FINAL";

export interface PublicationWorkerJob {
  jobId: string;
  organizationId: string;
  postTargetId: string;
  provider: string;
  contentIntent: string;
  scheduledAt: string;
  attemptNo: number;
  payload: Json;
}

export interface PublishAdapterResult {
  outcome: WorkerOutcome;
  providerRequestId?: string | null;
  httpStatus?: number | null;
  errorCode?: string | null;
  errorMessageSafe?: string | null;
  retryAfterSeconds?: number | null;
  publicUrl?: string | null;
}

export interface ReconcileAdapterResult {
  outcome: ReconcileOutcome;
  providerRequestId?: string | null;
  httpStatus?: number | null;
  errorCode?: string | null;
  errorMessageSafe?: string | null;
  retryAfterSeconds?: number | null;
  publicUrl?: string | null;
}

export interface PublishAdapter {
  provider: string;
  publish(job: PublicationWorkerJob): Promise<PublishAdapterResult>;
  reconcile?(job: PublicationWorkerJob): Promise<ReconcileAdapterResult>;
}

/**
 * O Instagram já passou por teste real ponta a ponta. A partir daqui o adapter
 * entra no registry quando a configuração mínima de runtime está presente.
 * Providers futuros continuam fora até terem adapter e validação equivalentes.
 */
export function getEnabledPublishAdapters(): Map<string, PublishAdapter> {
  const adapters = new Map<string, PublishAdapter>();

  const hasTokenCrypto = Boolean(process.env.OAUTH_TOKEN_ENCRYPTION_KEY);
  const hasStorage = Boolean(
    process.env.OBJECT_STORAGE_ENDPOINT &&
    process.env.OBJECT_STORAGE_BUCKET &&
    process.env.OBJECT_STORAGE_ACCESS_KEY_ID &&
    process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  );
  const hasDeliveryOrigin = process.env.VERCEL_ENV === "preview" || Boolean(process.env.APP_PUBLIC_URL);

  if (hasTokenCrypto && hasStorage && hasDeliveryOrigin) {
    adapters.set(instagramPublishAdapter.provider, instagramPublishAdapter);
  }

  return adapters;
}
