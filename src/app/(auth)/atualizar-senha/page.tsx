"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    const client = createSupabaseBrowserClient();
    if (!client) {
      setError("Supabase não está configurado neste ambiente.");
      return;
    }

    setSaving(true);
    const result = await client.auth.updateUser({ password });
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    window.location.href = "/publicacoes/nova";
  }

  return <main className="grid min-h-screen place-items-center bg-[#f7f8fb] p-5">
    <section className="card w-full max-w-md p-6 sm:p-8">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><KeyRound size={22}/></div>
      <p className="eyebrow mt-6">Segurança</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Crie uma nova senha</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Use uma senha nova com pelo menos 8 caracteres.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-bold text-slate-700">
          Nova senha
          <input
            autoComplete="new-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            type="password"
            minLength={8}
            required
            className="field mt-2 px-3 text-base sm:text-sm"
          />
        </label>
        <label className="block text-sm font-bold text-slate-700">
          Confirmar nova senha
          <input
            autoComplete="new-password"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            type="password"
            minLength={8}
            required
            className="field mt-2 px-3 text-base sm:text-sm"
          />
        </label>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <button disabled={saving} className="btn-primary w-full disabled:opacity-50">
          {saving ? "Salvando..." : "Salvar nova senha"} <ArrowRight size={16}/>
        </button>
      </form>

      <Link href="/login" className="mt-5 block text-center text-sm font-bold text-indigo-600">Voltar para entrar</Link>
    </section>
  </main>;
}
