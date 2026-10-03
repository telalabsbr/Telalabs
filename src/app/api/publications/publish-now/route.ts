import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createUntypedSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import {
  getEnabledPublishAdapters,
  type PublicationWorkerJob,
  type PublishAdapter,
  type PublishAdapterResult,
} from "@/integrations/social/provider-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

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

function wait(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function publishWithProviderProcessingWait(
  adapter: PublishAdapter,
  job: PublicationWorkerJob,
  deadline: number,
): Promise<PublishAdapterResult> {
  let result = await adapter.publish(job);

  while (
    result.outcome === "TRANSIENT_FAILURE" &&
    result.errorCode === "INSTAGRAM_CONTAINER_PROCESSING" &&
    Date.now() + 3_500 < deadline
  ) {
    await wait(3_000);
    result = await adapter.publish(job);
  }

  return result;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { post_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const postId = body.post_id?.trim();
  if (!postId) return NextResponse.json({ error: "post_id_required" }, { status: 400 });

  const post = await supabase
    .from("posts")
    .select("id,organization_id,deleted_at")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();

  if (post.error || !post.data) {
    return NextResponse.json({ error: "post_not_found" }, { status: 404 });
  }

  const membership = await supabase
    .from("memberships")
    .select("role,status")
    .eq("organization_id", post.data.organization_id)
    .eq("user_id", authData.user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (
    membership.error ||
    !membership.data ||
    !["OWNER", "ADMIN", "MANAGER", "CREATOR"].includes(membership.data.role)
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const adapters = getEnabledPublishAdapters();
  const providers = Array.from(adapters.keys());
  if (!providers.length) {
    return NextResponse.json({
      error: "no_enabled_provider_adapters",
      message: "Nenhum publicador externo está configurado neste ambiente.",
    }, { status: 503 });
  }

  const admin = createUntypedSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_admin_not_configured" }, { status: 503 });

  const claim = await admin.rpc("worker_claim_publication_jobs_for_post", {
    p_post_id: postId,
    p_providers: providers,
    p_limit: 10,
    p_lock_seconds: 180,
  });

  if (claim.error) {
    return NextResponse.json({ error: "claim_failed", message: claim.error.message }, { status: 500 });
  }

  const jobs = ((claim.data ?? []) as ClaimedJobRow[]).map(toWorkerJob);
  const results: Array<{
    jobId: string;
    provider: string;
    outcome: string;
    finalizedAs?: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    providerRequestId?: string | null;
    publicUrl?: string | null;
  }> = [];
  // One shared deadline prevents Reel + Story from each consuming the full
  // function budget. Anything still processing is safely left for the cron worker.
  const providerWaitDeadline = Date.now() + 160_000;

  for (const job of jobs) {
    const adapter = adapters.get(job.provider);
    if (!adapter) continue;

    let providerResult: PublishAdapterResult;
    try {
      providerResult = await publishWithProviderProcessingWait(adapter, job, providerWaitDeadline);
    } catch {
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
        errorCode: providerResult.errorCode ?? null,
        errorMessage: finish.error.message,
        providerRequestId: providerResult.providerRequestId ?? null,
        publicUrl: providerResult.publicUrl ?? null,
      });
      continue;
    }

    results.push({
      jobId: job.jobId,
      provider: job.provider,
      outcome: providerResult.outcome,
      finalizedAs: typeof finish.data === "string" ? finish.data : undefined,
      errorCode: providerResult.errorCode ?? null,
      errorMessage: providerResult.errorMessageSafe ?? null,
      providerRequestId: providerResult.providerRequestId ?? null,
      publicUrl: providerResult.publicUrl ?? null,
    });
  }

  const succeeded = results.filter(result => result.outcome === "SUCCEEDED").length;
  const needsRetry = results.filter(result => ["TRANSIENT_FAILURE", "RATE_LIMIT", "UNKNOWN"].includes(result.outcome)).length;
  const failed = results.length - succeeded - needsRetry;

  return NextResponse.json({
    claimed: jobs.length,
    processed: results.length,
    succeeded,
    needsRetry,
    failed,
    providers,
    results,
  });
}