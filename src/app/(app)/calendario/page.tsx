"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  MoreHorizontal,
  Pause,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { platformLabels, socialPlatforms, type SocialPlatform } from "@/domain/social";
import type { Publication, PublicationStatus } from "@/domain/publication";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { usePublicationsData } from "@/hooks/use-publications-data";

type PeriodMode = "today" | "month" | "week";
type FilterMenu = "network" | "status" | null;

const statusOptions: Array<{ value: PublicationStatus; label: string }> = [
  { value: "draft", label: "Rascunho" },
  { value: "scheduled", label: "Agendado" },
  { value: "processing", label: "Processando" },
  { value: "published", label: "Publicado" },
  { value: "failed", label: "Erro" },
  { value: "cancelled", label: "Cancelado" },
];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function endOfWeek(date: Date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  return endOfDay(next);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function publicationDate(publication: Publication) {
  return new Date(publication.scheduledAt ?? publication.createdAt);
}

function periodRange(mode: PeriodMode, cursor: Date) {
  if (mode === "today") return [startOfDay(cursor), endOfDay(cursor)] as const;
  if (mode === "month") return [startOfMonth(cursor), endOfMonth(cursor)] as const;
  return [startOfWeek(cursor), endOfWeek(cursor)] as const;
}

function shiftPeriod(mode: PeriodMode, cursor: Date, direction: -1 | 1) {
  const next = new Date(cursor);
  if (mode === "today") next.setDate(next.getDate() + direction);
  if (mode === "week") next.setDate(next.getDate() + direction * 7);
  if (mode === "month") next.setMonth(next.getMonth() + direction);
  return next;
}

function periodLabel(mode: PeriodMode, cursor: Date) {
  if (mode === "today") {
    return cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  }
  if (mode === "month") {
    const text = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  const start = startOfWeek(cursor);
  const end = endOfWeek(cursor);
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()} – ${end.getDate()} de ${end.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
  }
  return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
}

function matchesText(publication: Publication, query: string) {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  if (!normalized) return true;
  const text = [
    publication.baseText,
    ...publication.destinations.map(destination => platformLabels[destination.platform]),
  ].join(" ").toLocaleLowerCase("pt-BR");
  return text.includes(normalized);
}

function isAuthError(publication: Publication) {
  return publication.destinations.some(destination =>
    destination.status === "failed" &&
    /auth|token|permission|scope|login|credential|oauth/i.test((destination.lastErrorCode ?? "") + " " + (destination.lastError ?? ""))
  );
}

export default function CalendarPage() {
  const { publications, loading, error, source, retryPost, cancelPost, deletePost } = usePublicationsData();
  const [period, setPeriod] = useState<PeriodMode>("week");
  const [listMode, setListMode] = useState(false);
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [networks, setNetworks] = useState<SocialPlatform[]>([]);
  const [statuses, setStatuses] = useState<PublicationStatus[]>([]);
  const [filterMenu, setFilterMenu] = useState<FilterMenu>(null);
  const [selected, setSelected] = useState<Publication | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  const [rangeStart, rangeEnd] = periodRange(period, cursorDate);

  const periodPublications = useMemo(() => publications.filter(publication => {
    const date = publicationDate(publication);
    return date >= rangeStart && date <= rangeEnd;
  }), [publications, rangeStart.getTime(), rangeEnd.getTime()]);

  const filtered = useMemo(() => periodPublications.filter(publication => {
    const byQuery = matchesText(publication, query);
    const byNetwork = !networks.length || publication.destinations.some(destination => networks.includes(destination.platform));
    const byStatus = !statuses.length || statuses.includes(publication.status);
    return byQuery && byNetwork && byStatus;
  }), [periodPublications, query, networks, statuses]);

  const counts = useMemo(() => ({
    total: periodPublications.length,
    scheduled: periodPublications.filter(item => item.status === "scheduled" || item.status === "processing").length,
    failed: periodPublications.filter(item => item.status === "failed").length,
  }), [periodPublications]);

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
      : "Nenhum destino com falha final está elegível para retentativa. Erros de autorização precisam de reconexão e resultados incertos precisam de reconciliação.");
    if (result.count > 0) setSelected(null);
  }

  async function handleCancelSelected() {
    if (!selected) return;
    if (source !== "supabase") {
      setActionMessage("Cancelamento simulado no modo demonstração.");
      return;
    }
    setActionMessage("Cancelando agendamento...");
    const result = await cancelPost(selected.id);
    if (result.error) {
      setActionMessage(result.error);
      return;
    }
    setActionMessage(result.count > 0 ? "Agendamento cancelado." : "Nenhum destino pendente pôde ser cancelado.");
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

  function choosePeriod(next: PeriodMode) {
    setPeriod(next);
    setListMode(false);
    setFilterMenu(null);
    if (next === "today") setCursorDate(new Date());
  }

  function toggleNetwork(platform: SocialPlatform) {
    setNetworks(current => current.includes(platform) ? current.filter(item => item !== platform) : [...current, platform]);
  }

  function toggleStatus(status: PublicationStatus) {
    setStatuses(current => current.includes(status) ? current.filter(item => item !== status) : [...current, status]);
  }

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursorDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const items = filtered.filter(publication => publicationDate(publication).toDateString() === date.toDateString());
      return { date, items };
    });
  }, [cursorDate, filtered]);

  const monthCells = useMemo(() => {
    const first = startOfMonth(cursorDate);
    const mondayIndex = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - mondayIndex);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const items = filtered.filter(publication => publicationDate(publication).toDateString() === date.toDateString());
      return { date, items, currentMonth: date.getMonth() === cursorDate.getMonth() };
    });
  }, [cursorDate, filtered]);

  const details = selected && <div className="space-y-5">
    <div>
      <StatusBadge status={selected.status}/>
      <h2 className="mt-3 text-lg font-black text-slate-950">{selected.baseText || "Publicação"}</h2>
      <p className="mt-1 text-sm text-slate-500">{publicationDate(selected).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1">{selected.destinations.map(destination => <PlatformIcon key={destination.id} platform={destination.platform} small/>)}</div>
    </div>

    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">Status por destino</p>
      <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {selected.destinations.map(destination => <div key={destination.id} className="flex min-w-0 items-center gap-3 p-3">
          <PlatformIcon platform={destination.platform} small/>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{platformLabels[destination.platform]}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{destination.lastError ?? (destination.scheduledAt ? new Date(destination.scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Sem horário")}</p>
          </div>
          <StatusBadge status={destination.status}/>
        </div>)}
      </div>
    </div>

    {selected.status === "failed" && <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-red-600" size={18}/>
        <div className="min-w-0 flex-1">
          <p className="font-black text-red-900">Esta publicação precisa de ação</p>
          <p className="mt-1 text-sm leading-6 text-red-800">
            {isAuthError(selected)
              ? "O erro parece estar ligado à autorização da conta. Reconectar é mais seguro do que insistir na mesma tentativa."
              : "Erros temporários devem ser tentados automaticamente pelo worker. Quando a falha é final, a ação principal é tentar novamente manualmente."}
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
      <Link href="/publicacoes/nova" className="btn-secondary"><Edit3 size={15}/> Editar</Link>
      <button className="btn-secondary"><Copy size={15}/> Duplicar</button>
      {selected.status === "scheduled" && <button onClick={() => void handleCancelSelected()} className="btn-secondary"><Pause size={15}/> Cancelar agendamento</button>}
      <button className="btn-secondary"><MoreHorizontal size={15}/> Mais</button>
    </div>
  </div>;

  return <div className="w-full max-w-full space-y-4 overflow-x-hidden">
    <section>
      <p className="eyebrow">Planejamento</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Calendário</h1>
      <p className="mt-1 text-sm text-slate-500">Agenda, resumo operacional e publicações recentes em um só lugar.</p>
      {source === "supabase" && <p className="mt-2 text-xs font-semibold text-emerald-700">Lendo publicações reais do Supabase.</p>}
    </section>

    <section className="grid grid-cols-3 gap-2 sm:gap-3">
      <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm sm:p-4">
        <p className="text-xl font-black text-emerald-950 sm:text-2xl">{counts.total}</p>
        <p className="mt-1 text-xs font-bold text-emerald-700 sm:text-sm">Publicações</p>
      </article>
      <article className="rounded-2xl border border-blue-200 bg-blue-50 p-3 shadow-sm sm:p-4">
        <p className="text-xl font-black text-blue-950 sm:text-2xl">{counts.scheduled}</p>
        <p className="mt-1 text-xs font-bold text-blue-700 sm:text-sm">Agendadas</p>
      </article>
      <article className="rounded-2xl border border-red-200 bg-red-50 p-3 shadow-sm sm:p-4">
        <p className="text-xl font-black text-red-950 sm:text-2xl">{counts.failed}</p>
        <p className="mt-1 text-xs font-bold text-red-700 sm:text-sm">Falha</p>
      </article>
    </section>

    <section className="card min-w-0 overflow-visible">
      <div className="border-b border-slate-200 p-3 sm:p-4">
        <div className="space-y-3">
          <div className="flex justify-center sm:justify-start">
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button onClick={() => choosePeriod("today")} className={`rounded-lg px-3 py-2 text-sm font-bold ${period === "today" && !listMode ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>Hoje</button>
              <button onClick={() => choosePeriod("month")} className={`rounded-lg px-3 py-2 text-sm font-bold ${period === "month" && !listMode ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>Mês</button>
              <button onClick={() => choosePeriod("week")} className={`rounded-lg px-3 py-2 text-sm font-bold ${period === "week" && !listMode ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>Semana</button>
            </div>
          </div>

          <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
            <button onClick={() => setCursorDate(current => shiftPeriod(period, current, -1))} className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-50" aria-label="Período anterior"><ChevronLeft size={18}/></button>
            <div className="min-w-0 text-center text-sm font-black leading-5 text-slate-900 sm:text-base">{periodLabel(period, cursorDate)}</div>
            <button onClick={() => setCursorDate(current => shiftPeriod(period, current, 1))} className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-50" aria-label="Próximo período"><ChevronRight size={18}/></button>
          </div>

          <div className="relative flex min-w-0 flex-wrap items-center gap-2">
            <button onClick={() => setListMode(value => !value)} className={`btn-secondary !min-h-10 ${listMode ? "!border-indigo-300 !bg-indigo-50 !text-indigo-700" : ""}`}>Lista</button>

            <div className="relative">
              <button onClick={() => setFilterMenu(filterMenu === "network" ? null : "network")} className={`btn-secondary !min-h-10 ${networks.length ? "!border-indigo-300 !bg-indigo-50 !text-indigo-700" : ""}`}><SlidersHorizontal size={15}/> Redes{networks.length ? ` (${networks.length})` : ""}</button>
              {filterMenu === "network" && <div className="absolute left-0 top-12 z-30 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="max-h-72 overflow-y-auto">
                  {socialPlatforms.map(platform => <button key={platform} onClick={() => toggleNetwork(platform)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-slate-50">
                    <span className={`grid h-5 w-5 place-items-center rounded-md border ${networks.includes(platform) ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>{networks.includes(platform) && <Check size={12}/>}</span>
                    <PlatformIcon platform={platform} small/>
                    <span className="text-sm font-semibold text-slate-700">{platformLabels[platform]}</span>
                  </button>)}
                </div>
                {!!networks.length && <button onClick={() => setNetworks([])} className="mt-1 w-full rounded-lg px-2 py-2 text-left text-xs font-bold text-indigo-600 hover:bg-indigo-50">Limpar filtro</button>}
              </div>}
            </div>

            <div className="relative">
              <button onClick={() => setFilterMenu(filterMenu === "status" ? null : "status")} className={`btn-secondary !min-h-10 ${statuses.length ? "!border-indigo-300 !bg-indigo-50 !text-indigo-700" : ""}`}>Status{statuses.length ? ` (${statuses.length})` : ""}</button>
              {filterMenu === "status" && <div className="absolute left-0 top-12 z-30 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {statusOptions.map(option => <button key={option.value} onClick={() => toggleStatus(option.value)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-slate-50">
                  <span className={`grid h-5 w-5 place-items-center rounded-md border ${statuses.includes(option.value) ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>{statuses.includes(option.value) && <Check size={12}/>}</span>
                  <span className="text-sm font-semibold text-slate-700">{option.label}</span>
                </button>)}
                {!!statuses.length && <button onClick={() => setStatuses([])} className="mt-1 w-full rounded-lg px-2 py-2 text-left text-xs font-bold text-indigo-600 hover:bg-indigo-50">Limpar filtro</button>}
              </div>}
            </div>

            <label className="relative min-w-0 flex-1 sm:min-w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15}/>
              <input value={query} onChange={event => setQuery(event.target.value)} className="field !min-h-10 pl-9 pr-3 text-base sm:text-sm" placeholder="Buscar..."/>
            </label>
          </div>
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm text-slate-500">Carregando publicações...</div>}
      {error && <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!loading && !filtered.length && <div className="p-10 text-center">
        <CalendarDays className="mx-auto text-slate-300" size={30}/>
        <p className="mt-3 font-black text-slate-900">
          {period === "today" ? "Não há publicações para hoje" : "Nenhuma publicação neste período"}
        </p>
        <p className="mt-1 text-sm text-slate-500">{query || networks.length || statuses.length ? "Tente remover algum filtro ou alterar a busca." : "Quando houver conteúdo agendado, ele aparecerá aqui."}</p>
        <Link href="/publicacoes/nova" className="btn-primary mt-4">Criar publicação</Link>
      </div>}

      {!loading && !!filtered.length && listMode && <div className="divide-y divide-slate-100">
        {filtered.map(publication => <button key={publication.id} onClick={() => { setSelected(publication); setActionMessage(""); }} className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
          <div className="w-14 shrink-0 text-center">
            <p className="text-sm font-black text-slate-900">{publicationDate(publication).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
            <p className="text-xs text-slate-500">{publicationDate(publication).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</p>
          </div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{publication.baseText}</p><div className="mt-1 flex flex-wrap items-center gap-1">{publication.destinations.map(destination => <PlatformIcon key={destination.id} platform={destination.platform} small/>)}</div></div>
          <StatusBadge status={publication.status}/>
        </button>)}
      </div>}

      {!loading && !!filtered.length && !listMode && period === "today" && <div className="divide-y divide-slate-100">
        {filtered.map(publication => <button key={publication.id} onClick={() => { setSelected(publication); setActionMessage(""); }} className="flex w-full min-w-0 items-center gap-3 px-4 py-4 text-left hover:bg-slate-50">
          <div className="w-16 shrink-0 text-center"><p className="text-base font-black text-slate-900">{publicationDate(publication).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p></div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{publication.baseText}</p><div className="mt-1 flex items-center gap-1">{publication.destinations.map(destination => <PlatformIcon key={destination.id} platform={destination.platform} small/>)}</div></div>
          <StatusBadge status={publication.status}/>
        </button>)}
      </div>}

      {!loading && !!filtered.length && !listMode && period === "week" && <>
        <div className="divide-y divide-slate-100 md:hidden">
          {filtered.sort((a,b) => publicationDate(a).getTime() - publicationDate(b).getTime()).map(publication => <button key={publication.id} onClick={() => { setSelected(publication); setActionMessage(""); }} className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
            <div className="w-14 shrink-0 text-center"><p className="text-sm font-black text-slate-900">{publicationDate(publication).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p><p className="text-xs text-slate-500">{publicationDate(publication).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })}</p></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{publication.baseText}</p><div className="mt-1 flex items-center gap-1">{publication.destinations.map(destination => <PlatformIcon key={destination.id} platform={destination.platform} small/>)}</div></div>
            <StatusBadge status={publication.status}/>
          </button>)}
        </div>
        <div className="hidden grid-cols-7 divide-x divide-slate-100 md:grid">
          {weekDays.map(day => <div key={day.date.toISOString()} className="min-h-72">
            <div className="border-b border-slate-100 bg-slate-50 p-3 text-center"><p className="text-xs font-bold text-slate-500">{day.date.toLocaleDateString("pt-BR", { weekday: "short" })}</p><p className="mt-1 font-black text-slate-900">{day.date.getDate()}</p></div>
            <div className="space-y-2 p-2">{day.items.map(publication => <button key={publication.id} onClick={() => { setSelected(publication); setActionMessage(""); }} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-left shadow-sm hover:border-indigo-300">
              <p className="text-[11px] font-bold text-slate-500">{publicationDate(publication).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
              <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-900">{publication.baseText}</p>
              <div className="mt-2 flex flex-wrap gap-1">{publication.destinations.slice(0,3).map(destination => <PlatformIcon key={destination.id} platform={destination.platform} small/>)}</div>
            </button>)}</div>
          </div>)}
        </div>
      </>}

      {!loading && !!filtered.length && !listMode && period === "month" && <div>
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(day => <div key={day} className="p-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:p-3">{day}</div>)}</div>
        <div className="grid grid-cols-7">{monthCells.map(cell => <div key={cell.date.toISOString()} className={`min-h-16 border-b border-r border-slate-100 p-1.5 sm:min-h-28 sm:p-2 ${cell.currentMonth ? "bg-white" : "bg-slate-50/60"}`}>
          <span className={`text-xs font-bold ${cell.currentMonth ? "text-slate-700" : "text-slate-300"}`}>{cell.date.getDate()}</span>
          {!!cell.items.length && <button onClick={() => { setCursorDate(cell.date); setPeriod("today"); }} className="mt-1 flex w-full items-center justify-center rounded-md bg-indigo-50 p-1 text-[10px] font-bold text-indigo-800 sm:mt-2 sm:justify-start sm:p-2">
            <span className="sm:hidden">{cell.items.length}</span><span className="hidden sm:inline">{cell.items.length} publicação{cell.items.length === 1 ? "" : "ões"}</span>
          </button>}
        </div>)}</div>
      </div>}
    </section>

    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
        <div><h2 className="font-bold text-slate-950">Publicações recentes</h2><p className="mt-0.5 text-xs text-slate-500">Últimas publicações registradas no sistema.</p></div>
        <Link href="/historico" className="text-xs font-bold text-indigo-600">Ver todas</Link>
      </div>
      <div className="divide-y divide-slate-100">
        {publications.slice(0,3).map(publication => <button key={publication.id} onClick={() => { setSelected(publication); setActionMessage(""); }} className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:px-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm">{publication.mediaType === "video" ? "▶" : "✦"}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{publication.baseText}</p><div className="mt-1 flex items-center gap-1">{publication.destinations.slice(0,4).map(destination => <PlatformIcon key={destination.id} platform={destination.platform} small/>)}</div></div>
          <StatusBadge status={publication.status}/>
        </button>)}
        {!publications.length && !loading && <div className="p-5 text-center text-sm text-slate-500">Nenhuma publicação registrada ainda.</div>}
      </div>
    </section>

    {selected && <>
      <button aria-label="Fechar detalhes" className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px]" onClick={() => setSelected(null)}/>
      <aside className="fixed inset-x-0 bottom-[72px] top-16 z-50 overflow-y-auto rounded-t-2xl bg-white shadow-2xl xl:inset-y-16 xl:left-auto xl:right-0 xl:w-[390px] xl:rounded-none xl:border-l xl:border-slate-200">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-4"><p className="font-black text-slate-950">Detalhes da publicação</p><button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div>
        <div className="p-4">{details}</div>
      </aside>
    </>}
  </div>;
}
