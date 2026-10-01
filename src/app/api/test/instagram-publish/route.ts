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

async function requireUserContext() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: NextResponse.json({ error: "supabase_not_configured" }, { status: 503 }) } as const;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  }

  const memberships = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", authData.user.id)
    .eq("status", "ACTIVE");

  if (memberships.error || !memberships.data?.length) {
    return { error: NextResponse.json({ error: "no_active_membership" }, { status: 403 }) } as const;
  }

  return {
    allowedOrganizations: new Set(memberships.data.map(item => item.organization_id)),
  } as const;
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "preview_only" }, { status: 404 });
  }

  const auth = await requireUserContext();
  if ("error" in auth) return auth.error;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Teste Instagram — Tela Social</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:32px}
main{max-width:560px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:28px;box-shadow:0 12px 32px rgba(15,23,42,.08)}
h1{font-size:24px;margin:0 0 10px}p{line-height:1.55;color:#475569}.warn{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px;color:#9a3412}button{margin-top:18px;width:100%;border:0;border-radius:12px;padding:14px 18px;font-size:16px;font-weight:800;background:#4f46e5;color:white;cursor:pointer}small{display:block;margin-top:12px;color:#64748b}
</style>
</head>
<body><main>
<h1>Confirmar publicação de teste</h1>
<p>Este botão executa uma única tentativa real da próxima publicação do Instagram que estiver pronta na fila.</p>
<div class="warn"><strong>Atenção:</strong> ao clicar, o conteúdo será enviado de verdade para a conta Instagram conectada.</div>
<form method="post"><input type="hidden" name="confirm" value="publish" /><button type="submit">Publicar teste agora</button></form>
<small>A simples abertura desta página não publica nada.</small>
</main></body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "preview_only" }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  if (form?.get("confirm") !== "publish") {
    return NextResponse.json({ error: "explicit_confirmation_required" }, { status: 400 });
  }

  const auth = await requireUserContext();
  if ("error" in auth) return auth.error;

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

  if (!auth.allowedOrganizations.has(row.organization_id)) {
    return NextResponse.json({
      error: "claimed_job_not_owned_by_current_user",
      message: "O teste não executou um job de outra organização. Aguarde o lock expirar antes de tentar novamente.",
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
