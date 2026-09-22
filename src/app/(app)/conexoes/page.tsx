"use client";

import { useState } from "react";
import { CircleAlert, Link2, MoreHorizontal, Plus, ShieldCheck } from "lucide-react";
import { connections as initialConnections } from "@/data/mock";
import { platformLabels, socialPlatforms, type SocialPlatform } from "@/domain/social";
import { PlatformIcon } from "@/components/ui/platform-icon";

const statusLabel = {
  connected: "Conectado",
  disconnected: "Não conectado",
  expired: "Reconectar",
  error: "Com erro",
};

export default function ConnectionsPage() {
  const [notice, setNotice] = useState("");

  function mockAction(platform: SocialPlatform) {
    setNotice(platformLabels[platform] + " ainda está em modo demonstração. Nenhuma credencial real foi alterada.");
  }

  return <div className="space-y-4">
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">Integrações</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Contas conectadas</h1>
        <p className="mt-1 text-sm text-slate-500">Conecte e gerencie as contas que receberão suas publicações.</p>
      </div>
      <button className="btn-primary self-start"><Plus size={16}/> Conectar conta</button>
    </section>

    {notice && <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <CircleAlert size={18} className="mt-0.5 shrink-0"/>
      <span className="flex-1">{notice}</span>
      <button className="text-xs font-black" onClick={() => setNotice("")}>Fechar</button>
    </div>}

    <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {initialConnections.map(connection => {
          const connected = connection.status === "connected";
          const attention = connection.status === "expired" || connection.status === "error";
          return <article key={connection.platform} className="card p-4">
            <div className="flex items-start gap-3">
              <PlatformIcon platform={connection.platform}/>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-950">{platformLabels[connection.platform]}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{connection.handle ?? "Nenhuma conta vinculada"}</p>
              </div>
              <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><MoreHorizontal size={16}/></button>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${connected ? "bg-emerald-50 text-emerald-700" : attention ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{statusLabel[connection.status]}</span>
              <button onClick={() => mockAction(connection.platform)} className="text-xs font-bold text-indigo-600">{connected ? "Gerenciar" : attention ? "Reconectar" : "Conectar"}</button>
            </div>
          </article>;
        })}
      </div>

      <aside className="card h-fit p-4">
        <div className="flex items-center gap-2"><Link2 className="text-indigo-500" size={18}/><h2 className="font-black text-slate-950">Adicionar conta</h2></div>
        <p className="mt-1 text-xs leading-5 text-slate-500">Escolha uma rede. As integrações reais entram por OAuth, nunca por senha social.</p>
        <div className="mt-4 space-y-2">
          {socialPlatforms.map(platform => <button key={platform} onClick={() => mockAction(platform)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 text-left hover:bg-slate-50">
            <PlatformIcon platform={platform} small/>
            <span className="flex-1 text-xs font-bold text-slate-800">{platformLabels[platform]}</span>
            <span className="text-[11px] font-bold text-indigo-600">Conectar</span>
          </button>)}
        </div>
      </aside>
    </section>

    <section className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      <ShieldCheck className="shrink-0" size={20}/>
      <div><p className="font-bold">Credenciais protegidas.</p><p className="mt-1 text-xs leading-5 text-emerald-800">Tokens permanecem no backend. A interface mostra apenas o estado e as capacidades da conexão.</p></div>
    </section>
  </div>;
}
