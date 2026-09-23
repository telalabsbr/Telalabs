import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createUntypedSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import {
  getEnabledPublishAdapters,
  type PublicationWorkerJob,
  type PublishAdapterResult,
  type ReconcileAdapterResult,
} from "@/integrations/social/provider-registry";

export const runtime = "nodejs";

const WORKER_BATCH_LIMIT = 10;
const RECONCILE_BATCH_LIMIT = 4;

type ClaimedJobRow = {
  job_id: string;
  organization_id: string;
  post_target_id: string;
  provider: string;
  content_intent: string;
  scheduled_at: string;
  attempt_no: number;
  payload: Json;
};

type WorkerResult = {
  jobId: string;
  jobType: "PUBLISH_TARGET" | "RECONCILE_TARGET";
  provider: string;
  outcome: string;
  finalizedAs?: string;
  error?: string;
};

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function authorized(request: NextRequest) {
  const expected = process.env.WORKER_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;

  return secureEquals(header.slice(prefix.length), expected);
}

function normalizeResult(result: PublishAdapterResult | ReconcileAdapterResult) {
  return {
    p_outcome: result.outcome,
    ...(result.errorCode ? { p_error_code: result.errorCode } : {}),
    ...(result.errorMessageSafe ? { p_error_message_safe: result.errorMessageSafe } : {}),
    ...(typeof result.httpStatus === "number" ? { p_http_status: result.httpStatus } : {}),
    ...(result.providerRequestId ? { p_provider_request_id: result.providerRequestId } : {}),
    ...(typeof result.retryAfterSeconds === "number" ? { p_retry_after_seconds: result.retryAfterSeconds } : {}),
  };
}

function toWorkerJob(row: ClaimedJobRow): PublicationWorkerJob {
  return {
    jobId: row.job_id,
    organizationId: row.organization_id,
    postTargetId: row.post_target_id,
    provider: row.provider,
    contentIntent: row.content_intent,
    scheduledAt: row.scheduled_at,
    attemptNo: row.attempt_no,
    payload: row.payload,
  };
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (process.env.PUBLISHING_WORKER_ENABLED !== "true") {
    return NextResponse.json({
      error: "worker_disabled",
      message: "O executor está preparado, mas continua desligado por segurança.",
    }, { status: 503 });
  }

  const adapters = getEnabledPublishAdapters();
  const providers = Array.from(adapters.keys());

  if (!providers.length) {
    return NextResponse.json({
      error: "no_enabled_provider_adapters",
      message: "Nenhum provider real foi habilitado; nenhum job foi consumido.",
    }, { status: 503 });
  }

  const admin = createUntypedSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_admin_not_configured" }, { status: 503 });
  }

  const results: WorkerResult[] = [];
  const reconcileProviders = providers.filter(provider => Boolean(adapters.get(provider)?.reconcile));
  let reconcileJobs: PublicationWorkerJob[] = [];

  if (reconcileProviders.length) {
    const reconcileClaim = await admin.rpc("worker_claim_reconcile_jobs_for_providers", {
      p_providers: reconcileProviders,
      p_limit: RECONCILE_BATCH_LIMIT,
      p_lock_seconds: 120,
    });

    if (reconcileClaim.error) {
      return NextResponse.json({
        error: "reconcile_claim_failed",
        message: reconcileClaim.error.message,
      }, { status: 500 });
    }

    reconcileJobs = ((reconcileClaim.data ?? []) as ClaimedJobRow[]).map(toWorkerJob);

    for (const job of reconcileJobs) {
      const adapter = adapters.get(job.provider);

      if (!adapter?.reconcile) {
        results.push({
          jobId: job.jobId,
          jobType: "RECONCILE_TARGET",
          provider: job.provider,
          outcome: "SKIPPED",
          error: "reconcile_adapter_not_found",
        });
        continue;
      }

      let providerResult: ReconcileAdapterResult;
      try {
        providerResult = await adapter.reconcile(job);
      } catch {
        providerResult = {
          outcome: "UNKNOWN",
          errorCode: "ADAPTER_RECONCILE_UNCLASSIFIED_EXCEPTION",
          errorMessageSafe: "O estado da publicação ainda não pôde ser confirmado com segurança.",
        };
      }

      const finish = await admin.rpc("worker_finish_reconcile_job", {
        p_job_id: job.jobId,
        ...normalizeResult(providerResult),
      });

      if (finish.error) {
        results.push({
          jobId: job.jobId,
          jobType: "RECONCILE_TARGET",
          provider: job.provider,
          outcome: providerResult.outcome,
          error: finish.error.message,
        });
        continue;
      }

      results.push({
        jobId: job.jobId,
        jobType: "RECONCILE_TARGET",
        provider: job.provider,
        outcome: providerResult.outcome,
        finalizedAs: typeof finish.data === "string" ? finish.data : undefined,
      });
    }
  }

  const publishLimit = Math.max(0, WORKER_BATCH_LIMIT - reconcileJobs.length);
  let publicationJobs: PublicationWorkerJob[] = [];

  if (publishLimit > 0) {
    const claim = await admin.rpc("worker_claim_publication_jobs_for_providers", {
      p_providers: providers,
      p_limit: publishLimit,
      p_lock_seconds: 120,
    });

    if (claim.error) {
      return NextResponse.json({
        error: "claim_failed",
        message: claim.error.message,
        reconcile_claimed: reconcileJobs.length,
        reconcile_processed: results.length,
      }, { status: 500 });
    }

    publicationJobs = ((claim.data ?? []) as ClaimedJobRow[]).map(toWorkerJob);

    for (const job of publicationJobs) {
      const adapter = adapters.get(job.provider);

      if (!adapter) {
        results.push({
          jobId: job.jobId,
          jobType: "PUBLISH_TARGET",
          provider: job.provider,
          outcome: "SKIPPED",
          error: "adapter_not_found",
        });
        continue;
      }

      let providerResult: PublishAdapterResult;
      try {
        providerResult = await adapter.publish(job);
      } catch {
        // Exceção sem classificação é UNKNOWN para impedir republicação cega.
        providerResult = {
          outcome: "UNKNOWN",
          errorCode: "ADAPTER_UNCLASSIFIED_EXCEPTION",
          errorMessageSafe: "O resultado da tentativa não pôde ser confirmado.",
        };
      }

      const finish = await admin.rpc("worker_finish_publication_job", {
        p_job_id: job.jobId,
        ...normalizeResult(providerResult),
      });

      if (finish.error) {
        results.push({
          jobId: job.jobId,
          jobType: "PUBLISH_TARGET",
          provider: job.provider,
          outcome: providerResult.outcome,
          error: finish.error.message,
        });
        continue;
      }

      results.push({
        jobId: job.jobId,
        jobType: "PUBLISH_TARGET",
        provider: job.provider,
        outcome: providerResult.outcome,
        finalizedAs: typeof finish.data === "string" ? finish.data : undefined,
      });
    }
  }

  return NextResponse.json({
    claimed: reconcileJobs.length + publicationJobs.length,
    processed: results.length,
    reconcile_claimed: reconcileJobs.length,
    publication_claimed: publicationJobs.length,
    providers,
    results,
  });
}
