import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function classify(code: string | null | undefined, message: string | null | undefined) {
  if (code === "23503") return "service_role_ok_rpc_reached";
  if (code === "42501") return "service_role_rejected";
  if (code?.startsWith("PGRST")) return "postgrest_rpc_resolution_error";

  const text = (message ?? "").toLowerCase();
  if (text.includes("invalid api key") || text.includes("api key")) return "invalid_api_key";
  if (text.includes("permission denied")) return "permission_denied";
  if (text.includes("could not find the function")) return "postgrest_rpc_resolution_error";
  return code ? `other_${code}` : "other_error";
}

function keyDiagnostics() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  let projectRef: string | null = null;
  try {
    projectRef = new URL(url).hostname.split(".")[0] || null;
  } catch {
    projectRef = null;
  }

  return {
    projectRef,
    keyPresent: Boolean(key),
    keyKind: key.startsWith("sb_secret_")
      ? "sb_secret"
      : key.startsWith("eyJ")
        ? "legacy_jwt"
        : key
          ? "other"
          : "missing",
    keyLength: key.length,
    keyFingerprint: key
      ? createHash("sha256").update(key).digest("hex").slice(0, 12)
      : null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  };
}

export async function GET() {
  const admin = createSupabaseAdminClient();
  const diagnostics = keyDiagnostics();

  if (!admin) {
    return NextResponse.json(
      { safe: true, adminClient: false, diagnostics },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const brandProbe = await admin.from("brands").select("id").limit(1);

  const rpcProbe = await admin.rpc("server_upsert_oauth_connection", {
    p_organization_id: "00000000-0000-0000-0000-000000000001",
    p_brand_id: "00000000-0000-0000-0000-000000000002",
    p_provider: "instagram",
    p_provider_account_id: "diagnostic-probe",
    p_display_name: "Diagnostic Probe",
    p_username: "diagnostic",
    p_scopes: ["instagram_business_basic"],
    p_token_expires_at: new Date(Date.now() + 60_000).toISOString(),
    p_metadata: { source: "diagnostic_probe" },
    p_access_token_ciphertext: "diagnostic",
    p_key_version: "aes-gcm-v1",
  });

  return NextResponse.json(
    {
      safe: true,
      adminClient: true,
      diagnostics,
      brandQuery: {
        ok: !brandProbe.error,
        code: brandProbe.error?.code ?? null,
        classification: brandProbe.error
          ? classify(brandProbe.error.code, brandProbe.error.message)
          : "ok",
      },
      rpcProbe: {
        ok: !rpcProbe.error,
        code: rpcProbe.error?.code ?? null,
        classification: rpcProbe.error
          ? classify(rpcProbe.error.code, rpcProbe.error.message)
          : "unexpected_success",
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
