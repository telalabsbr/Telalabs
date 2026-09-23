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
}

export interface ReconcileAdapterResult {
  outcome: ReconcileOutcome;
  providerRequestId?: string | null;
  httpStatus?: number | null;
  errorCode?: string | null;
  errorMessageSafe?: string | null;
  retryAfterSeconds?: number | null;
}

export interface PublishAdapter {
  provider: string;
  publish(job: PublicationWorkerJob): Promise<PublishAdapterResult>;
  reconcile?(job: PublicationWorkerJob): Promise<ReconcileAdapterResult>;
}

/**
 * Um provider só entra no registry depois que o adapter existe E uma flag
 * explícita do ambiente o habilita. Isso impede que o worker consuma jobs de
 * integrações ainda não validadas com credenciais reais.
 */
export function getEnabledPublishAdapters(): Map<string, PublishAdapter> {
  const adapters = new Map<string, PublishAdapter>();

  if (
    process.env.INSTAGRAM_PUBLISHING_ADAPTER_ENABLED === "true" &&
    process.env.META_GRAPH_BASE_URL &&
    process.env.APP_PUBLIC_URL &&
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY
  ) {
    adapters.set(instagramPublishAdapter.provider, instagramPublishAdapter);
  }

  return adapters;
}
