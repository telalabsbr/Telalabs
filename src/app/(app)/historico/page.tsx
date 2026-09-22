"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Copy, Edit3, Filter, MoreHorizontal, RefreshCw, Search, Trash2, X } from "lucide-react";
import { platformLabels, socialPlatforms, type SocialPlatform } from "@/domain/social";
import { publicationStatuses, type Publication, type PublicationStatus } from "@/domain/publication";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { usePublicationsData } from "@/hooks/use-publications-data";

const statusLabels: Record<PublicationStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  processing: "Processando",
  published: "Publicado",
  failed: "Erro",
  cancelled: "Cancelado",
};

function isAuthError(publication: Publication) {
  return publication.destinations.some(destination =>
    destination.status === "failed" &&
    /auth|token|permission|scope|login|credential|oauth/i.test((destination.lastErrorCode ?? "") + " " + (destination.lastError ?? ""))
  );
}

export default function HistoryPage() {
  const { publications, loading, error, source, retryPost, deletePost } = usePublicationsData();
  const [network, setNetwork] = useState<"all" | SocialPlatform>("all");
  const [status, setStatus] = useState<"all" | PublicationStatus>("all");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<"7" | "30" | "90" | "all">("30");
  const [selected, setSelected] = useState<Publication | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  const filtered = useMemo(() => publications.filter(publication => {
    const byStatus = status === "all" || publication.status === status;
    const byNetwork = network === "all" || publication.destinations.some(destination => destination.platform === network);
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    const byQuery = !normalized || [
      publication.baseText,
      ...publication.destinations.map(destination => platformLabels[destination.platform]),
    ].join(" ").toLocaleLowerCase("pt-BR").includes(normalized);

    const createdAt = new Date(publication.createdAt).getTime();
    const cutoff = period === "all"
      ? 0
      : Date.now() - Number(period) * 24 * 60 * 60 * 1000;
    const byPeriod = createdAt >= cutoff;

    return byStatus && byNetwork && byQuery && byPeriod;
  }), [publications, network, status, query, period]);

  async function handleRetrySelected() {
    if (!selected) return;
    if (source !== "supabase") {
      setActionMessage("Retentativa simulada no modo demonstração.");
      return;
    }

    setActionMessage("Preparando retentativa...");
    const result = await retryPost(selected.id);
    if (result.error) {
      setActionMessage(result.error);
      return;
    }

    setActionMessage(result.count > 0
      ? `${result.count} destino(s) com falha final foram recolocados na fila.`
      : "Nenhum destino com falha final está elegível para retentativa. Reconexão e reconciliação continuam separadas para evitar duplicidade.");
    if (result.count > 0) setSelected(null);
  }

  async function handleDeleteSelected() {
    if (!selected) return;
    if (source !== "supabase") {
      setActionMessage("Exclusão simulada no modo demonstração.");
      setSelected(null);
      return;
    }

    setActionMessage("Excluindo publicação...");
    const result = await deletePost(selected.id);
    if (result.error) {
      setActionMessage(result.error);
      return;
    }

    if (result.deleted) {
      setSelected(null);
      setActionMessage("");
    }
  }

  const detail = selected && <div className="space-y-5">
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
        {selected.destinations.map(destination => <div key={destination.id} className="flex min-w-0 items-center gap-3 p-3">
          <PlatformIcon platform={destination.platform} small/>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{platformLabels[destination.platform]}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{destination.lastError ?? (destination.attempts + " tentativa" + (destination.attempts === 1 ? "" : "s"))}</p>
          </div>
          <StatusBadge status={destination.status}/>
        </div>)}
      </div>
    </div>

    {selected.status === "failed" && <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-red-600" size={18}/>
        <div className="min-w-0 flex-1">
          <p className="font-black text-red-900">Como resolver</p>
          <p className="mt-1 text-sm leading-6 text-red-800">
            {isAuthError(selected)
              ? "A autorização da conta precisa ser corrigida. Nesse caso, repetir a publicação sem reconectar provavelmente falharia de novo."
              : "Quando o worker estiver ativo, falhas temporárias terão retentativas automáticas. Depois da falha final, a opção principal será tentar novamente manualmente."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isAuthError(selected)
              ? <Link href="/conexoes" className="btn-primary">Reconectar conta</Link>
              : <button onClick={() => void handleRetrySelected()} className="btn-primary"><RefreshCw size={15}/> Tentar novamente</button>}
            <button onClick={() => void handleDeleteSelected()} className="btn-secondary !text-red-600"><Trash2 size={15}/> Excluir</button>
          </div>
        </div>
      </div>
    </div>}

    {actionMessage && <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{actionMessage}</p>}

    <div className="grid grid-cols-2 gap-2">
      <Link href={"/publicacoes/nova?edit=" + selected.id} className="btn-secondary"><Edit3 size={15}/> Editar</Link>
      <button className="btn-secondary"><Copy size={15}/> Duplicar</button>
    </div>
  </div>;

  return <div className="w-full max-w-full space-y-4 overflow-x-hidden">
    <section>
      <p className="eyebrow">Operação</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Histórico</h1>
      <p className="mt-1 text-sm text-slate-500">Veja o que aconteceu em cada publicação e em cada destino.</p>
      {source === "supabase" && <p className="mt-2 text-xs font-semibold text-emerald-700">Lendo histórico real do Supabase.</p>}
    </section>

    <section className="card min-w-0 overflow-hidden">
      <div className="border-b border-slate-200 p-3 sm:p-4">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15}/>
            <input value={query} onChange={event => setQuery(event.target.value)} className="field pl-9 pr-3 text-base sm:text-sm" placeholder="Buscar publicações..."/>
          </label>

          <label className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-500 sm:text-xs"><Filter size={14}/>
            <select value={network} onChange={event => setNetwork(event.target.value as "all" | SocialPlatform)} className="field !min-h-10 min-w-0 px-3 text-base sm:text-sm">
              <option value="all">Todas as redes</option>
              {socialPlatforms.map(platform => <option key={platform} value={platform}>{platformLabels[platform]}</option>)}
            </select>
          </label>

          <select value={status} onChange={event => setStatus(event.target.value as "all" | PublicationStatus)} className="field !min-h-10 min-w-0 px-3 text-base sm:text-sm">
            <option value="all">Todos os status</option>
            {publicationStatuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
          </select>

          <select value={period} onChange={event => setPeriod(event.target.value as "7" | "30" | "90" | "all")} className="field !min-h-10 min-w-0 px-3 text-base sm:text-sm">
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="all">Todo o período</option>
          </select>
        </div>
      </div>

      {loading && <div className="p-10 text-center text-sm text-slate-500">Carregando histórico...</div>}
      {error && <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!loading && <div className="divide-y divide-slate-100">
        {filtered.map(publication => <button key={publication.id} id={publication.id} onClick={() => { setSelected(publication); setActionMessage(""); }} className="grid w-full min-w-0 grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 sm:px-4 md:grid-cols-[52px_1.2fr_.8fr_.8fr_auto]">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-rose-50 via-amber-50 to-indigo-50 text-slate-500">{publication.mediaType === "video" ? "▶" : "✦"}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{publication.baseText}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{publication.mediaType === "video" ? "Vídeo" : "Imagem"} · {publication.destinations.length} destinos</p>
          </div>
          <div className="hidden items-center gap-1 md:flex">{publication.destinations.map(destination => <PlatformIcon key={destination.id} platform={destination.platform} small/>)}</div>
          <div className="hidden text-xs text-slate-500 md:block">{new Date(publication.createdAt).toLocaleDateString("pt-BR")}</div>
          <div className="flex min-w-0 items-center gap-2"><StatusBadge status={publication.status}/><MoreHorizontal size={16} className="hidden shrink-0 text-slate-400 sm:block"/></div>
        </button>)}
        {!filtered.length && <div className="p-10 text-center text-sm text-slate-500">Nenhuma publicação corresponde aos filtros.</div>}
      </div>}
    </section>

    {selected && <>
      <button aria-label="Fechar detalhes" className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px]" onClick={() => setSelected(null)}/>
      <aside className="fixed inset-x-0 bottom-[72px] top-16 z-50 overflow-y-auto rounded-t-2xl bg-white shadow-2xl xl:inset-y-16 xl:left-auto xl:right-0 xl:w-[390px] xl:rounded-none xl:border-l xl:border-slate-200">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-4">
          <div className="min-w-0"><p className="truncate font-black text-slate-950">Detalhes da publicação</p><p className="mt-0.5 text-xs text-slate-500">{new Date(selected.createdAt).toLocaleDateString("pt-BR")}</p></div>
          <button onClick={() => setSelected(null)} className="shrink-0 rounded-lg p-2 text-slate-500"><X size={18}/></button>
        </div>
        <div className="p-4">{detail}</div>
      </aside>
    </>}
  </div>;
}
