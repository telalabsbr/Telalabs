"use client";

import { useState } from "react";
import { useTenantData } from "@/components/tenant-provider";
import { uploadMediaFile } from "@/lib/media/upload";
import { supabaseConfig } from "@/lib/supabase/config";

export default function StorageDiagnosticPage() {
  const tenant = useTenantData();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const hasSupabaseUrl = Boolean(supabaseConfig.url);
  const hasSupabasePublicKey = Boolean(supabaseConfig.publicKey);
  const canUpload = tenant.source === "supabase" && tenant.activeBrand.id !== "unconfigured" && Boolean(file) && !busy;

  async function runUpload() {
    if (!file || !canUpload) return;
    setBusy(true);
    setError("");
    setMessage("Iniciando upload real para o object storage...");
    setProgress(0);

    try {
      const result = await uploadMediaFile({
        file,
        brandId: tenant.activeBrand.id,
        retention: "library",
        onProgress: state => {
          setProgress(state.percent);
          setMessage(`Upload real: ${state.percent}%`);
        },
      });
      setProgress(100);
      setMessage(`R2 validado. media_id: ${result.mediaId}`);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "upload_failed";
      setError(`Falha no teste: ${code}`);
      setMessage("");
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  return <div className="mx-auto max-w-2xl space-y-5">
    <section>
      <p className="eyebrow">Diagnóstico temporário</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Teste real do Cloudflare R2</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Esta página usa exatamente o mesmo pipeline multipart do Composer, mas não exige nenhuma rede social conectada e nunca publica conteúdo externo.</p>
    </section>

    <section className="card space-y-3 p-5">
      <h2 className="font-black text-slate-950">Configuração pública</h2>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">Supabase URL</span><strong>{hasSupabaseUrl ? "Presente" : "AUSENTE"}</strong></div>
        <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">Chave pública</span><strong>{hasSupabasePublicKey ? "Presente" : "AUSENTE"}</strong></div>
        <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">Tenant</span><strong>{tenant.source}</strong></div>
      </div>
      {!hasSupabaseUrl || !hasSupabasePublicKey ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">O Preview não recebeu toda a configuração pública do Supabase. Corrija as variáveis do ambiente antes do teste de storage.</p> : null}
      {tenant.error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{tenant.error}</p> : null}
    </section>

    <section className="card space-y-4 p-5">
      <div>
        <h2 className="font-black text-slate-950">Upload de smoke test</h2>
        <p className="mt-1 text-sm text-slate-500">Escolha uma imagem pequena. O arquivo será mantido na biblioteca apenas para confirmar o upload.</p>
      </div>

      <input
        type="file"
        accept="image/*,video/*"
        onChange={event => {
          setFile(event.target.files?.[0] ?? null);
          setProgress(null);
          setMessage("");
          setError("");
        }}
        className="field"
      />

      {file ? <p className="text-sm text-slate-600">Arquivo: <strong>{file.name}</strong> · {(file.size / 1024 / 1024).toFixed(2)} MB</p> : null}

      {progress !== null ? <div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-indigo-600" style={{ width: `${progress}%` }}/></div>
        <p className="mt-2 text-xs font-bold text-slate-500">{progress}%</p>
      </div> : null}

      {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <button disabled={!canUpload} onClick={() => void runUpload()} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? "Testando..." : "Executar upload real"}
      </button>

      {tenant.source !== "supabase" ? <p className="text-xs leading-5 text-slate-500">O botão só é habilitado com sessão real do Supabase e marca ativa.</p> : null}
    </section>
  </div>;
}
