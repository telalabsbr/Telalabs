import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getEnabledPublishAdapters,
  type PublicationWorkerJob,
  type PublishAdapterResult,
} from "@/integrations/social/provider-registry";

export const runtime = "nodejs";

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

function normalizeResult(result: PublishAdapterResult) {
  return {
    p_outcome: result.outcome,
    ...(result.errorCode ? { p_error_code: result.errorCode } : {}),
    ...(result.errorMessageSafe ? { p_error_message_safe: result.errorMessageSafe } : {}),
    ...(typeof result.httpStatus === "number" ? { p_http_status: result.httpStatus } : {}),
    ...(result.providerRequestId ? { p_provider_request_id: result.providerRequestId } : {}),
    ...(typeof result.retryAfterSeconds === "number" ? { p_retry_after_seconds: result.retryAfterSeconds } : {}),
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

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_admin_not_configured" }, { status: 503 });
  }

  const claim = await admin.rpc("worker_claim_publication_jobs_for_providers", {
    p_providers: providers,
    p_limit: 10,
    p_lock_seconds: 120,
  });

  if (claim.error) {
    return NextResponse.json({
      error: "claim_failed",
      message: claim.error.message,
    }, { status: 500 });
  }

  const jobs = (claim.data ?? []).map(row => ({
    jobId: row.job_id,
    organizationId: row.organization_id,
    postTargetId: row.post_target_id,
    provider: row.provider,
    contentIntent: row.content_intent,
    scheduledAt: row.scheduled_at,
    attemptNo: row.attempt_no,
    payload: row.payload,
  } satisfies PublicationWorkerJob));

  const results: Array<{
    jobId: string;
    provider: string;
    outcome: string;
    finalizedAs?: string;
    error?: string;
  }> = [];

  for (const job of jobs) {
    const adapter = adapters.get(job.provider);

    if (!adapter) {
      // O claim já filtra pelos providers habilitados. Este caso é defensivo.
      results.push({
        jobId: job.jobId,
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
      // Exceção sem classificação é tratada como UNKNOWN para evitar
      // republicação cega e possível conteúdo duplicado.
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
        provider: job.provider,
        outcome: providerResult.outcome,
        error: finish.error.message,
      });
      continue;
    }

    results.push({
      jobId: job.jobId,
      provider: job.provider,
      outcome: providerResult.outcome,
      finalizedAs: finish.data,
    });
  }

  return NextResponse.json({
    claimed: jobs.length,
    processed: results.length,
    providers,
    results,
  });
}
