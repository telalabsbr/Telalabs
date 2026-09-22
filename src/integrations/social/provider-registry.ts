import "server-only";
import type { Json } from "@/lib/supabase/database.types";

export type WorkerOutcome =
  | "SUCCEEDED"
  | "TRANSIENT_FAILURE"
  | "RATE_LIMIT"
  | "AUTH_REQUIRED"
  | "INVALID_CONTENT"
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

export interface PublishAdapter {
  provider: string;
  publish(job: PublicationWorkerJob): Promise<PublishAdapterResult>;
}

/**
 * O registry começa vazio de propósito.
 *
 * Um provider só entra aqui depois que o adapter real estiver implementado,
 * revisado contra a documentação oficial atual e testado com credenciais reais.
 * Isso impede que o worker consuma jobs de uma rede ainda não suportada.
 */
export function getEnabledPublishAdapters(): Map<string, PublishAdapter> {
  return new Map<string, PublishAdapter>();
}
