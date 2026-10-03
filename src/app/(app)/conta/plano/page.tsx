"use client";

import { useState } from "react";
import { BadgeDollarSign, CreditCard, FileText, ReceiptText, Tag } from "lucide-react";
import { useTenantData } from "@/components/tenant-provider";

export default function BillingPage() {
  const { organization, connections } = useTenantData();
  const [personType, setPersonType] = useState<"PF" | "PJ">("PF");

  return <div className="mx-auto w-full max-w-5xl space-y-5">
    <section>
      <p className="eyebrow">Financeiro</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Plano e cobrança</h1>
      <p className="mt-1 text-sm leading-6 text-slate-500">Plano, uso, dados de cobrança, método de pagamento, faturas e cupons em uma área única.</p>
    </section>

    <section className="grid gap-4 md:grid-cols-3">
      <article className="card p-4">
        <BadgeDollarSign className="text-indigo-500" size={19}/>
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Plano atual</p>
        <p className="mt-1 text-xl font-black text-slate-950">{organization?.planCode ?? "Demonstração"}</p>
      </article>
      <article className="card p-4">
        <CreditCard className="text-indigo-500" size={19}/>
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Contas conectadas</p>
        <p className="mt-1 text-xl font-black text-slate-950">{connections.length}</p>
      </article>
      <article className="card p-4">
        <ReceiptText className="text-indigo-500" size={19}/>
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Cobrança</p>
        <p className="mt-1 text-sm font-black text-slate-950">Ainda não ativada</p>
      </article>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <article className="card p-4 sm:p-5">
        <h2 className="font-black text-slate-950">Dados de cobrança</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">Esses dados pertencem à assinatura e não ao perfil pessoal.</p>
        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            {(["PF","PJ"] as const).map(value => <button key={value} onClick={() => setPersonType(value)} className={`rounded-lg border px-4 py-2 text-sm font-bold ${personType === value ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}>{value === "PF" ? "Pessoa física" : "Empresa"}</button>)}
          </div>
          <label className="block text-sm font-bold text-slate-700">{personType === "PF" ? "Nome completo" : "Razão social"}<input className="field mt-2 px-3 text-base sm:text-sm"/></label>
          <label className="block text-sm font-bold text-slate-700">{personType === "PF" ? "CPF" : "CNPJ"}<input className="field mt-2 px-3 text-base sm:text-sm"/></label>
          <label className="block text-sm font-bold text-slate-700">CEP e endereço de cobrança<input className="field mt-2 px-3 text-base sm:text-sm" placeholder="Será integrado ao provedor de pagamentos"/></label>
          <button disabled className="btn-secondary opacity-60">Salvar dados de cobrança</button>
          <p className="text-xs leading-5 text-slate-500">A persistência desses dados será ligada ao gateway escolhido. Não vamos armazenar número completo de cartão no Tela Social.</p>
        </div>
      </article>

      <div className="space-y-4">
        <article className="card p-4 sm:p-5">
          <div className="flex items-center gap-3"><CreditCard className="text-indigo-500" size={19}/><h2 className="font-black text-slate-950">Método de pagamento</h2></div>
          <p className="mt-3 text-sm leading-6 text-slate-600">Cartão, Pix e demais opções dependerão do gateway definido para o Brasil.</p>
          <button disabled className="btn-secondary mt-4 opacity-60">Adicionar método</button>
        </article>

        <article className="card p-4 sm:p-5">
          <div className="flex items-center gap-3"><FileText className="text-indigo-500" size={19}/><h2 className="font-black text-slate-950">Faturas e comprovantes</h2></div>
          <p className="mt-3 text-sm leading-6 text-slate-600">Histórico de cobranças, status, vencimentos e comprovantes ficará aqui.</p>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Nenhuma fatura gerada.</div>
        </article>

        <article className="card p-4 sm:p-5">
          <div className="flex items-center gap-3"><Tag className="text-indigo-500" size={19}/><h2 className="font-black text-slate-950">Cupom</h2></div>
          <div className="mt-4 flex gap-2"><input className="field px-3 text-base sm:text-sm" placeholder="Digite um cupom"/><button disabled className="btn-primary shrink-0 opacity-60">Aplicar</button></div>
        </article>
      </div>
    </section>
  </div>;
}
