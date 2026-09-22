"use client";

import { useState } from "react";
import { BarChart3, Clock3, Eye, Heart, TrendingUp } from "lucide-react";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { platformLabels, socialPlatforms, type SocialPlatform } from "@/domain/social";

type AnalyticsScope = "all" | SocialPlatform;

const demoMultiplier: Record<SocialPlatform, number> = {
  instagram: 1,
  facebook: .72,
  tiktok: 1.35,
  youtube: 1.12,
  linkedin: .45,
  x: .38,
  kwai: .64,
};

export default function AnalyticsPage() {
  const [scope, setScope] = useState<AnalyticsScope>("all");
  const multiplier = scope === "all" ? 1 : demoMultiplier[scope];

  const metrics = [
    { label: "Visualizações", value: Math.round(125600 * multiplier).toLocaleString("pt-BR"), note: "+18%", Icon: Eye },
    { label: "Engajamento", value: Math.round(8400 * multiplier).toLocaleString("pt-BR"), note: "+22%", Icon: Heart },
    { label: "Publicações", value: Math.max(1, Math.round(42 * multiplier)).toString(), note: "30 dias", Icon: BarChart3 },
  ];

  return <div className="w-full max-w-full space-y-5 overflow-x-hidden">
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">Desempenho</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Visão geral ou por rede social, usando apenas métricas que cada API realmente disponibilizar.</p>
      </div>
      <label className="min-w-0 sm:min-w-56">
        <span className="mb-1 block text-xs font-bold text-slate-500">Analisar</span>
        <select value={scope} onChange={event => setScope(event.target.value as AnalyticsScope)} className="field px-3 text-base sm:text-sm">
          <option value="all">Todas as redes</option>
          {socialPlatforms.map(platform => <option key={platform} value={platform}>{platformLabels[platform]}</option>)}
        </select>
      </label>
    </section>

    <section className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-800">
      {scope === "all" ? <BarChart3 size={18} className="shrink-0"/> : <PlatformIcon platform={scope} small/>}
      <span className="font-semibold">{scope === "all" ? "Visão geral de todas as redes" : "Analisando " + platformLabels[scope]}</span>
      <span className="ml-auto text-xs font-medium text-indigo-600">Dados demonstrativos</span>
    </section>

    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
      {metrics.map(({label,value,note,Icon}, index) => <article key={label} className={`card p-3 sm:p-4 ${index === 2 ? "col-span-2 sm:col-span-1" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <Icon size={17} className="shrink-0 text-indigo-500"/>
          <span className="text-xs font-bold text-emerald-600">{note}</span>
        </div>
        <p className="mt-2 text-xl font-black leading-none text-slate-950 sm:text-2xl">{value}</p>
        <p className="mt-1 text-xs font-bold text-slate-600 sm:text-sm">{label}</p>
      </article>)}
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
      <article className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-bold text-slate-950">Desempenho no período</h2><p className="mt-1 text-xs text-slate-500">{scope === "all" ? "Todas as redes" : platformLabels[scope]} · últimos 30 dias</p></div>
          <TrendingUp className="shrink-0 text-indigo-500" size={18}/>
        </div>
        <div className="mt-5 flex h-44 items-end gap-2 rounded-xl bg-slate-50 p-3 sm:h-52 sm:gap-3 sm:p-4">
          {[32,48,40,68,56,82,72,92,76,100,88,110].map((height,index) => <div key={index} className="min-w-0 flex-1 rounded-t-md bg-indigo-200" style={{height: Math.round(height * Math.min(multiplier,1.15))}}/>)}
        </div>
      </article>
      <article className="card p-4 sm:p-5">
        <Clock3 className="text-indigo-500" size={18}/>
        <h2 className="mt-3 font-bold text-slate-950">Melhores horários</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Quando houver histórico suficiente, esta área poderá mostrar horários com base na conta selecionada.</p>
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm font-semibold text-indigo-800">Sem dados reais suficientes para recomendar ainda.</div>
      </article>
    </section>
  </div>;
}
