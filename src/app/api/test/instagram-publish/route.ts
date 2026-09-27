import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createUntypedSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { instagramPublishAdapter } from "@/integrations/social/instagram-adapter";
import type { PublicationWorkerJob, PublishAdapterResult } from "@/integrations/social/provider-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "preview_only" }, { status: 404 });
  }

  if (request.nextUrl.searchParams.get("confirm") !== "publish") {
    return NextResponse.json({
      ready: true,
      message: "Adicione ?confirm=publish somente depois de criar uma publicação de teste para o Instagram.",
    });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const memberships = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", authData.user.id)
    .eq("status", "ACTIVE");

  if (memberships.error || !memberships.data?.length) {
    return NextResponse.json({ error: "no_active_membership" }, { status: 403 });
  }

  const allowedOrganizations = new Set(memberships.data.map(item => item.organization_id));
  const admin = createUntypedSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_admin_not_configured" }, { status: 503 });

  const claim = await admin.rpc("worker_claim_publication_jobs_for_providers", {
    p_providers: ["instagram"],
    p_limit: 1,
    p_lock_seconds: 120,
  });

  if (claim.error) {
    return NextResponse.json({ error: "claim_failed", message: claim.error.message }, { status: 500 });
  }

  const row = ((claim.data ?? []) as ClaimedJobRow[])[0];
  if (!row) {
    return NextResponse.json({
      claimed: 0,
      message: "Nenhuma publicação do Instagram está aguardando envio agora.",
    });
  }

  if (!allowedOrganizations.has(row.organization_id)) {
    return NextResponse.json({
      error: "claimed_job_not_owned_by_current_user",
      message: "O teste não executou um job de outra organização. Tente novamente depois que o lock expirar.",
    }, { status: 409 });
  }

  const job = toWorkerJob(row);
  let providerResult: PublishAdapterResult;

  try {
    providerResult = await instagramPublishAdapter.publish(job);
  } catch {
    providerResult = {
      outcome: "UNKNOWN",
      errorCode: "TEST_ADAPTER_UNCLASSIFIED_EXCEPTION",
      errorMessageSafe: "O teste encontrou uma exceção não classificada antes de confirmar o resultado.",
    };
  }

  const finish = await admin.rpc("worker_finish_publication_job", {
    p_job_id: job.jobId,
    ...normalizeResult(providerResult),
  });

  if (finish.error) {
    return NextResponse.json({
      claimed: 1,
      provider: "instagram",
      outcome: providerResult.outcome,
      errorCode: providerResult.errorCode ?? null,
      errorMessage: providerResult.errorMessageSafe ?? null,
      finalizeError: finish.error.message,
    }, { status: 500 });
  }

  return NextResponse.json({
    claimed: 1,
    provider: "instagram",
    outcome: providerResult.outcome,
    errorCode: providerResult.errorCode ?? null,
    errorMessage: providerResult.errorMessageSafe ?? null,
    providerRequestId: providerResult.providerRequestId ?? null,
    finalizedAs: typeof finish.data === "string" ? finish.data : null,
  });
}
