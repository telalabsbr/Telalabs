"use client";

import { useState } from "react";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { useTenantData } from "@/components/tenant-provider";

export function InitialSetup() {
  const { bootstrapAccount } = useTenantData();
  const [name, setName] = useState("Minha marca");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const result = await bootstrapAccount(name);
    if (result.error) setError(result.error);
    setSaving(false);
  }

  return <div className="mx-auto grid min-h-[calc(100vh-9rem)] max-w-2xl place-items-center">
    <section className="card w-full p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Building2 size={21}/></span>
        <div>
          <p className="eyebrow">Primeira configuração</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Crie sua primeira marca</h1>
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-slate-600">Sua conta já está autenticada. Agora criamos, de forma segura, a organização interna e a primeira marca que vai concentrar contas sociais, publicações e biblioteca.</p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block text-sm font-bold text-slate-700">
          Nome da marca ou perfil
          <input value={name} onChange={event => setName(event.target.value)} className="field mt-2 px-3 text-base sm:text-sm" placeholder="Ex.: Estética Prisma" required/>
        </label>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <button disabled={saving} className="btn-primary w-full disabled:opacity-50">
          {saving ? "Criando..." : "Continuar"} <ArrowRight size={16}/>
        </button>
      </form>

      <div className="mt-5 flex gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600"/>
        <p>Esse processo usa sua sessão autenticada. O aplicativo não cria ou armazena senhas de redes sociais.</p>
      </div>
    </section>
  </div>;
}
