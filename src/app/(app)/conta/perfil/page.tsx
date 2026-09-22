"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useTenantData } from "@/components/tenant-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const { user } = useTenantData();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(String(user?.user_metadata?.full_name ?? ""));
    setPhone(String(user?.user_metadata?.contact_phone ?? ""));
  }, [user]);

  async function save() {
    setSaving(true);
    setMessage("");
    const client = createSupabaseBrowserClient();
    if (!client || !user) {
      setMessage("Modo demonstração: alterações não foram persistidas.");
      setSaving(false);
      return;
    }
    const result = await client.auth.updateUser({
      data: { full_name: name.trim(), contact_phone: phone.trim() },
    });
    setMessage(result.error ? result.error.message : "Perfil atualizado.");
    setSaving(false);
  }

  return <div className="mx-auto w-full max-w-4xl space-y-5">
    <section>
      <p className="eyebrow">Conta</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Meu perfil</h1>
      <p className="mt-1 text-sm leading-6 text-slate-500">Dados pessoais usados para identificação, contato e segurança da sua conta.</p>
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <article className="card p-4 sm:p-5">
        <div className="flex items-center gap-3"><UserRound className="text-indigo-500" size={20}/><h2 className="font-black text-slate-950">Dados pessoais</h2></div>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-bold text-slate-700">
            Nome
            <input value={name} onChange={event => setName(event.target.value)} className="field mt-2 px-3 text-base sm:text-sm" placeholder="Seu nome"/>
          </label>
          <label className="block text-sm font-bold text-slate-700">
            E-mail
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input value={user?.email ?? ""} readOnly className="field bg-slate-50 pl-9 pr-3 text-base text-slate-500 sm:text-sm"/>
            </div>
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Telefone de contato
            <div className="relative mt-2">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input value={phone} onChange={event => setPhone(event.target.value)} className="field pl-9 pr-3 text-base sm:text-sm" placeholder="(31) 99999-9999"/>
            </div>
          </label>
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Salvando..." : "Salvar perfil"}</button>
          {message && <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16}/>{message}</p>}
        </div>
      </article>

      <article className="card h-fit p-4 sm:p-5">
        <div className="flex items-center gap-3"><ShieldCheck className="text-emerald-600" size={20}/><h2 className="font-black text-slate-950">Segurança</h2></div>
        <p className="mt-3 text-sm leading-6 text-slate-600">Senha, recuperação de acesso e futuras opções de autenticação em duas etapas ficam ligadas à sua conta, não à marca.</p>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Dados fiscais, CPF/CNPJ, endereço de cobrança e método de pagamento ficam em <strong>Plano e cobrança</strong>, separados do perfil pessoal.</div>
      </article>
    </section>
  </div>;
}
