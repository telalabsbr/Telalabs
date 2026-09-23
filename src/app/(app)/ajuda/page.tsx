"use client";

import { useState } from "react";
import { BookOpen, Bug, CircleHelp, CreditCard, Link2, Send, Sparkles } from "lucide-react";
import { useTenantData } from "@/components/tenant-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const topics = [
  { title: "Contas e conexões", text: "Conectar, reconectar ou remover uma rede social.", Icon: Link2 },
  { title: "Publicação", text: "Erros, agendamento, status e comportamento por destino.", Icon: Send },
  { title: "Plano e cobrança", text: "Assinatura, pagamentos, cupons e faturas.", Icon: CreditCard },
  { title: "Problemas técnicos", text: "Tela travada, comportamento inesperado ou bug.", Icon: Bug },
];

export default function HelpPage() {
  const tenant = useTenantData();
  const [category, setCategory] = useState("OTHER");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    if (tenant.source !== "supabase" || !tenant.user) {
      setMessage("Modo demonstração: o chamado não foi enviado.");
      setSaving(false);
      return;
    }

    const client = createSupabaseBrowserClient();
    if (!client) {
      setMessage("Não foi possível acessar o suporte agora.");
      setSaving(false);
      return;
    }

    const result = await client.from("support_tickets").insert({
      user_id: tenant.user.id,
      organization_id: tenant.organization?.id ?? null,
      category,
      subject: subject.trim(),
      description: description.trim(),
      metadata: { route: window.location.pathname, user_agent: navigator.userAgent },
    });

    if (result.error) {
      setMessage(result.error.message);
    } else {
      setMessage("Solicitação enviada. Ela já ficou registrada no Tela Social.");
      setSubject("");
      setDescription("");
    }
    setSaving(false);
  }

  return <div className="mx-auto w-full max-w-5xl space-y-5">
    <section>
      <p className="eyebrow">Suporte</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Ajuda e suporte</h1>
      <p className="mt-1 text-sm leading-6 text-slate-500">Primeiro, respostas rápidas. Quando isso não resolver, envie uma solicitação assíncrona com o contexto do problema.</p>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {topics.map(({title,text,Icon}) => <article key={title} className="card p-4">
        <Icon className="text-indigo-500" size={19}/>
        <h2 className="mt-3 text-sm font-black text-slate-950">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
      </article>)}
    </section>

    <section className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
      <article className="card p-4 sm:p-5">
        <div className="flex items-center gap-3"><BookOpen className="text-indigo-500" size={19}/><h2 className="font-black text-slate-950">Respostas rápidas</h2></div>
        <div className="mt-4 space-y-3 text-sm">
          {[
            ["Por que uma rede pede reconexão?", "Tokens podem expirar ou permissões podem mudar. O alerta aparece em Contas."],
            ["Uma falha cancela as outras redes?", "Não. Cada destino é tratado separadamente."],
            ["Posso instalar como aplicativo?", "Sim. Abra Preferências e use a área de instalação."],
            ["Onde vejo meus pagamentos?", "Em Plano e cobrança, acessível pela sua foto no topo."],
          ].map(([q,a]) => <details key={q} className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer font-bold text-slate-800">{q}</summary><p className="mt-2 leading-6 text-slate-600">{a}</p></details>)}
        </div>
        <div className="mt-4 flex gap-2 rounded-xl bg-indigo-50 p-3 text-xs leading-5 text-indigo-800"><Sparkles size={16} className="mt-0.5 shrink-0"/><p>No futuro, a busca de ajuda poderá sugerir respostas e diagnósticos antes de abrir um chamado.</p></div>
      </article>

      <article className="card p-4 sm:p-5">
        <div className="flex items-center gap-3"><CircleHelp className="text-indigo-500" size={19}/><h2 className="font-black text-slate-950">Enviar solicitação</h2></div>
        <p className="mt-1 text-sm leading-6 text-slate-500">Sem chat ao vivo obrigatório: o chamado fica registrado para ser respondido com contexto.</p>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block text-sm font-bold text-slate-700">Assunto
            <input required minLength={3} maxLength={160} value={subject} onChange={event => setSubject(event.target.value)} className="field mt-2 px-3 text-base sm:text-sm"/>
          </label>
          <label className="block text-sm font-bold text-slate-700">Categoria
            <select value={category} onChange={event => setCategory(event.target.value)} className="field mt-2 px-3 text-base sm:text-sm">
              <option value="ACCOUNT">Conta</option><option value="BILLING">Cobrança</option><option value="PUBLISHING">Publicação</option><option value="INTEGRATIONS">Integrações</option><option value="BUG">Problema técnico</option><option value="SUGGESTION">Sugestão</option><option value="OTHER">Outro</option>
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-700">Descreva o que aconteceu
            <textarea required minLength={10} maxLength={5000} value={description} onChange={event => setDescription(event.target.value)} className="field mt-2 min-h-36 resize-y p-3 text-base sm:text-sm" placeholder="O que você estava fazendo, o que esperava e o que aconteceu?"/>
          </label>
          <button disabled={saving} className="btn-primary disabled:opacity-50"><Send size={16}/>{saving ? "Enviando..." : "Enviar solicitação"}</button>
          {message && <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{message}</p>}
        </form>
      </article>
    </section>
  </div>;
}
