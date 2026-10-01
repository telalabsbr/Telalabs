import { NextResponse } from "next/server";
import { createUntypedSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import {
  getEnabledPublishAdapters,
  type PublicationWorkerJob,
  type PublishAdapterResult,
} from "@/integrations/social/provider-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEST_POST_ID = "3103d3f9-f464-4d1b-9aa8-b0e6ac7c2b11";

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

function wait(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
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

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 });
  }

  const admin = createUntypedSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "admin_not_configured" }, { status: 503 });

  const adapters = getEnabledPublishAdapters();
  const adapter = adapters.get("instagram");
  if (!adapter) return NextResponse.json({ error: "instagram_adapter_not_enabled" }, { status: 503 });

  const claim = await admin.rpc("worker_claim_publication_jobs_for_post", {
    p_post_id: TEST_POST_ID,
    p_providers: ["instagram"],
    p_limit: 1,
    p_lock_seconds: 120,
  });

  if (claim.error) {
    return NextResponse.json({ error: "claim_failed", message: claim.error.message }, { status: 500 });
  }

  const row = ((claim.data ?? []) as ClaimedJobRow[])[0];
  if (!row) return NextResponse.json({ claimed: 0, message: "no_due_job" });

  const job: PublicationWorkerJob = {
    jobId: row.job_id,
    organizationId: row.organization_id,
    postTargetId: row.post_target_id,
    provider: row.provider,
    contentIntent: row.content_intent,
    scheduledAt: row.scheduled_at,
    attemptNo: row.attempt_no,
    payload: row.payload,
  };

  let result: PublishAdapterResult;
  try {
    const deadline = Date.now() + 42_000;
    result = await adapter.publish(job);
    while (
      result.outcome === "TRANSIENT_FAILURE" &&
      result.errorCode === "INSTAGRAM_CONTAINER_PROCESSING" &&
      Date.now() < deadline
    ) {
      await wait(2_500);
      result = await adapter.publish(job);
    }
  } catch {
    result = {
      outcome: "UNKNOWN",
      errorCode: "TEMP_RESUME_UNCLASSIFIED_EXCEPTION",
      errorMessageSafe: "Não foi possível confirmar o resultado da retomada.",
    };
  }

  const finish = await admin.rpc("worker_finish_publication_job", {
    p_job_id: job.jobId,
    ...normalizeResult(result),
  });

  if (finish.error) {
    return NextResponse.json({
      claimed: 1,
      outcome: result.outcome,
      errorCode: result.errorCode ?? null,
      finishError: finish.error.message,
    }, { status: 500 });
  }

  return NextResponse.json({
    claimed: 1,
    outcome: result.outcome,
    errorCode: result.errorCode ?? null,
    providerRequestId: result.providerRequestId ?? null,
    finalizedAs: finish.data,
  });
}
