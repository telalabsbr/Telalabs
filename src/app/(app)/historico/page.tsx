"use client";

import { useMemo, useState } from "react";
import { Copy, Edit3, Filter, MoreHorizontal, Search, X } from "lucide-react";
import { publications } from "@/data/mock";
import { platformLabels, socialPlatforms, type SocialPlatform } from "@/domain/social";
import { publicationStatuses, type Publication, type PublicationStatus } from "@/domain/publication";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { StatusBadge } from "@/components/ui/status-badge";

export default function HistoryPage() {
  const [network, setNetwork] = useState<"all" | SocialPlatform>("all");
  const [status, setStatus] = useState<"all" | PublicationStatus>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Publication | null>(publications[1] ?? publications[0] ?? null);

  const filtered = useMemo(() => publications.filter(publication => {
    const byStatus = status === "all" || publication.status === status;
    const byNetwork = network === "all" || publication.destinations.some(destination => destination.platform === network);
    const byQuery = publication.baseText.toLowerCase().includes(query.toLowerCase());
    return byStatus && byNetwork && byQuery;
  }), [network, status, query]);

  return <div className="space-y-4">
    <section>
      <p className="eyebrow">Operação</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Histórico</h1>
      <p className="mt-1 text-sm text-slate-500">Veja o que aconteceu em cada publicação e em cada destino.</p>
    </section>

    <section className="card overflow-hidden">
      <div className="border-b border-slate-200 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15}/>
            <input value={query} onChange={event => setQuery(event.target.value)} className="field pl-9 pr-3 text-sm" placeholder="Buscar publicações..."/>
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500"><Filter size={14}/>
            <select value={network} onChange={event => setNetwork(event.target.value as "all" | SocialPlatform)} className="field !min-h-10 px-3 text-xs">
              <option value="all">Todas as redes</option>
              {socialPlatforms.map(platform => <option key={platform} value={platform}>{platformLabels[platform]}</option>)}
            </select>
          </label>
          <select value={status} onChange={event => setStatus(event.target.value as "all" | PublicationStatus)} className="field !min-h-10 px-3 text-xs">
            <option value="all">Todos os status</option>
            {publicationStatuses.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          <select className="field !min-h-10 px-3 text-xs"><option>Últimos 30 dias</option></select>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {filtered.map(publication => <button key={publication.id} id={publication.id} onClick={() => setSelected(publication)} className={`grid w-full grid-cols-[48px_1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 md:grid-cols-[52px_1.2fr_.8fr_.8fr_auto] ${selected?.id === publication.id ? "bg-indigo-50/45" : ""}`}>
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-rose-50 via-amber-50 to-indigo-50 text-slate-500">{publication.mediaType === "video" ? "▶" : "✦"}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{publication.baseText}</p>
            <p className="mt-1 text-[11px] text-slate-500">{publication.mediaType === "video" ? "Vídeo" : "Imagem"} · {publication.destinations.length} destinos</p>
          </div>
          <div className="hidden items-center gap-1 md:flex">{publication.destinations.map(destination => <PlatformIcon key={destination.id} platform={destination.platform} small/>)}</div>
          <div className="hidden text-xs text-slate-500 md:block">{new Date(publication.createdAt).toLocaleDateString("pt-BR")}</div>
          <div className="flex items-center gap-2"><StatusBadge status={publication.status}/><MoreHorizontal size={16} className="text-slate-400"/></div>
        </button>)}
        {!filtered.length && <div className="p-10 text-center text-sm text-slate-500">Nenhuma publicação corresponde aos filtros.</div>}
      </div>
    </section>

    {selected && <aside className="fixed inset-y-16 right-0 z-30 hidden w-[380px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl xl:block">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div><p className="text-sm font-black text-slate-950">Detalhes da publicação</p><p className="mt-0.5 text-xs text-slate-500">{new Date(selected.createdAt).toLocaleDateString("pt-BR")}</p></div>
        <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button>
      </div>
      <div className="space-y-5 p-4">
        <div className="aspect-[4/5] rounded-2xl bg-gradient-to-br from-rose-100 via-amber-50 to-indigo-100 p-5">
          <div className="flex h-full items-end rounded-xl border border-white/70 bg-white/35 p-4 backdrop-blur-sm"><p className="text-xl font-black leading-tight text-slate-900">{selected.baseText}</p></div>
        </div>

        <div>
          <StatusBadge status={selected.status}/>
          <p className="mt-3 text-sm leading-6 text-slate-700">{selected.baseText}</p>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Resultado por destino</p>
          <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {selected.destinations.map(destination => <div key={destination.id} className="flex items-center gap-3 p-3">
              <PlatformIcon platform={destination.platform} small/>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900">{platformLabels[destination.platform]}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{destination.lastError ?? (destination.attempts + " tentativa" + (destination.attempts === 1 ? "" : "s"))}</p>
              </div>
              <StatusBadge status={destination.status}/>
            </div>)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary"><Edit3 size={15}/> Editar</button>
          <button className="btn-secondary"><Copy size={15}/> Duplicar</button>
        </div>
      </div>
    </aside>}
  </div>;
}
