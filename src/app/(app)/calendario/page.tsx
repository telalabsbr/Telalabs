"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  MoreHorizontal,
  Pause,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { publications } from "@/data/mock";
import { platformLabels } from "@/domain/social";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { StatusBadge } from "@/components/ui/status-badge";

type ViewMode = "month" | "week" | "list";

const weekDays = [
  { label: "Seg", day: 22, count: 3 },
  { label: "Ter", day: 23, count: 5 },
  { label: "Qua", day: 24, count: 7 },
  { label: "Qui", day: 25, count: 4 },
  { label: "Sex", day: 26, count: 6 },
  { label: "Sáb", day: 27, count: 2 },
  { label: "Dom", day: 28, count: 1 },
];

const weekSlots = [
  { day: 0, time: "09:00", title: "Rotina de cuidados", networks: ["instagram","facebook"] as const },
  { day: 1, time: "11:00", title: "Novo procedimento", networks: ["tiktok","instagram"] as const },
  { day: 2, time: "09:30", title: "Skin care matinal", networks: ["instagram","tiktok","linkedin"] as const },
  { day: 2, time: "12:00", title: "Reels: Resultado real", networks: ["instagram","facebook","youtube"] as const, selected: true },
  { day: 2, time: "16:30", title: "Antes e depois", networks: ["instagram","youtube"] as const },
  { day: 3, time: "13:00", title: "Perguntas frequentes", networks: ["tiktok","linkedin"] as const },
  { day: 4, time: "12:30", title: "Promoção do mês", networks: ["instagram","facebook"] as const },
  { day: 4, time: "18:00", title: "Depoimento em vídeo", networks: ["youtube","instagram"] as const },
  { day: 5, time: "16:00", title: "Estética e autoestima", networks: ["linkedin"] as const },
  { day: 6, time: "11:00", title: "Domingo relax", networks: ["instagram"] as const },
];

const monthDays = Array.from({ length: 35 }, (_, index) => index < 1 ? 31 : index > 30 ? index - 30 : index);

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>("week");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const selectedPublication = publications[0];

  const details = <div className="space-y-5">
    <div>
      <StatusBadge status={selectedPublication.status}/>
      <h2 className="mt-3 text-lg font-black text-slate-950">Reels: Resultado real</h2>
      <p className="mt-1 text-sm text-slate-500">Quarta, 24 set · 12:00</p>
      <div className="mt-2 flex items-center gap-1">{selectedPublication.destinations.map(destination => <PlatformIcon key={destination.id} platform={destination.platform} small/>)}</div>
    </div>
    <div className="aspect-[4/5] rounded-2xl bg-gradient-to-br from-rose-100 via-orange-50 to-indigo-100 p-5">
      <div className="flex h-full items-end rounded-xl border border-white/70 bg-white/30 p-4 backdrop-blur-sm">
        <p className="text-2xl font-black leading-tight text-slate-900">Resultados<br/>que você sente ✨</p>
      </div>
    </div>
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">Descrição</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{selectedPublication.baseText}</p>
    </div>
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">Status por rede</p>
      <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {selectedPublication.destinations.map(destination => <div key={destination.id} className="flex items-center gap-3 p-3">
          <PlatformIcon platform={destination.platform} small/>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900">{platformLabels[destination.platform]}</p><p className="text-xs text-slate-500">24/09 · 12:00</p></div>
          <StatusBadge status={destination.status}/>
          <MoreHorizontal size={16} className="shrink-0 text-slate-400"/>
        </div>)}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <Link href="/publicacoes/nova" className="btn-secondary"><Edit3 size={15}/> Editar</Link>
      <button className="btn-secondary"><Copy size={15}/> Duplicar</button>
      <button className="btn-secondary"><Pause size={15}/> Pausar</button>
      <button className="btn-secondary !text-red-600"><Trash2 size={15}/> Excluir</button>
    </div>
  </div>;

  return <div className="w-full max-w-full space-y-4 overflow-x-hidden">
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">Planejamento</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Calendário</h1>
        <p className="mt-1 text-sm text-slate-500">Agenda, resumo operacional e publicações recentes em um só lugar.</p>
      </div>
      <Link href="/publicacoes/nova" className="btn-primary self-start">+ Criar publicação</Link>
    </section>

    <section className="grid grid-cols-3 gap-2 sm:gap-3">
      {[
        ["12","Publicações"],
        ["8","Agendadas"],
        ["1","Falha"],
      ].map(([value,label]) => <article key={label} className="card p-3 sm:p-4">
        <p className="text-xl font-black text-slate-950 sm:text-2xl">{value}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500 sm:text-sm">{label}</p>
      </article>)}
    </section>

    <section className="card min-w-0 overflow-hidden">
      <div className="border-b border-slate-200 p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-slate-100 p-1">
              {([["month","Mês"],["week","Semana"],["list","Lista"]] as const).map(([value,label]) => <button key={value} onClick={() => setView(value)} className={`rounded-md px-3 py-2 text-sm font-bold sm:text-xs ${view === value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>{label}</button>)}
            </div>
            <button className="btn-secondary !min-h-10 !px-2.5" aria-label="Período anterior"><ChevronLeft size={16}/></button>
            <div className="min-w-0 flex-1 text-center text-sm font-black text-slate-900 sm:min-w-48 sm:flex-none">22 – 28 set 2026</div>
            <button className="btn-secondary !min-h-10 !px-2.5" aria-label="Próximo período"><ChevronRight size={16}/></button>
            <button className="btn-secondary !min-h-10">Hoje</button>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button className="btn-secondary !min-h-10"><SlidersHorizontal size={15}/> Redes</button>
            <button className="btn-secondary !min-h-10">Status</button>
            <label className="relative min-w-0 flex-1 sm:min-w-56 xl:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15}/>
              <input className="field !min-h-10 pl-9 pr-3 text-base sm:text-xs" placeholder="Buscar..."/>
            </label>
          </div>
        </div>
      </div>

      {view === "week" && <>
        <div className="divide-y divide-slate-100 md:hidden">
          {weekSlots.map(item => <button key={item.title} onClick={() => setDrawerOpen(true)} className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
            <div className="w-12 shrink-0 text-center"><p className="text-sm font-black text-slate-900">{item.time}</p><p className="text-xs text-slate-500">{weekDays[item.day].label} {weekDays[item.day].day}</p></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{item.title}</p><div className="mt-1 flex items-center gap-1">{item.networks.map(network => <PlatformIcon key={network} platform={network} small/>)}</div></div>
            <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">Agendado</span>
          </button>)}
        </div>

        <div className="app-scrollbar hidden overflow-x-auto md:block">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50">
              <div className="p-3 text-[10px] font-bold text-slate-400">GMT-3</div>
              {weekDays.map((day,index) => <div key={day.day} className={`border-l border-slate-200 p-3 text-center ${index === 2 ? "bg-indigo-50" : ""}`}>
                <p className="text-[11px] font-bold text-slate-500">{day.label}</p>
                <p className={`mt-1 text-sm font-black ${index === 2 ? "text-indigo-700" : "text-slate-900"}`}>{day.day}</p>
                <p className="mt-1 text-[10px] text-slate-400">{day.count} publicações</p>
              </div>)}
            </div>
            <div className="relative grid min-h-[640px] grid-cols-[64px_repeat(7,1fr)] bg-white">
              <div className="border-r border-slate-200">
                {["08:00","10:00","12:00","14:00","16:00","18:00","20:00"].map(time => <div key={time} className="h-20 border-b border-slate-100 pr-2 pt-1 text-right text-[10px] font-medium text-slate-400">{time}</div>)}
              </div>
              {weekDays.map((day,index) => <div key={day.day} className={`relative border-r border-slate-100 ${index === 2 ? "bg-indigo-50/20" : ""}`}>
                {Array.from({length:8}).map((_,line) => <div key={line} className="h-20 border-b border-slate-100"/>)}
                {weekSlots.filter(item => item.day === index).map((item,itemIndex) => {
                  const top = 22 + itemIndex * 135 + (index % 2) * 20;
                  return <button key={item.title} onClick={() => setDrawerOpen(true)} style={{ top }} className={`absolute left-2 right-2 rounded-xl border bg-white p-2 text-left shadow-sm transition hover:shadow-md ${item.selected ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"}`}>
                    <p className="text-[10px] font-bold text-slate-500">{item.time}</p>
                    <p className="mt-1 truncate text-xs font-bold text-slate-900">{item.title}</p>
                    <div className="mt-2 flex items-center gap-1">{item.networks.map(network => <PlatformIcon key={network} platform={network} small />)}</div>
                  </button>;
                })}
              </div>)}
            </div>
          </div>
        </div>
      </>}

      {view === "month" && <div>
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(day => <div key={day} className="p-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:p-3">{day}</div>)}</div>
        <div className="grid grid-cols-7">{monthDays.map((day,index) => <div key={index} className={`min-h-16 border-b border-r border-slate-100 p-1.5 sm:min-h-28 sm:p-2 ${index === 24 ? "bg-indigo-50/40" : "bg-white"}`}>
          <span className="text-xs font-bold text-slate-700">{day}</span>
          {[3,8,10,15,17,22,24,29].includes(day) && <button onClick={() => setDrawerOpen(true)} className="mt-1 flex w-full items-center justify-center rounded-md bg-indigo-50 p-1 text-[10px] font-bold text-indigo-800 sm:mt-2 sm:justify-start sm:p-2"><span className="sm:hidden">•</span><span className="hidden sm:inline">2 publicações</span></button>}
        </div>)}</div>
      </div>}

      {view === "list" && <div className="divide-y divide-slate-100">
        {weekSlots.map(item => <button key={item.title} onClick={() => setDrawerOpen(true)} className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-sm font-black text-indigo-700">{weekDays[item.day].day}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{weekDays[item.day].label} · {item.time}</p></div>
          <div className="hidden items-center gap-1 sm:flex">{item.networks.map(network => <PlatformIcon key={network} platform={network} small />)}</div>
          <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">Agendado</span>
        </button>)}
      </div>}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500"/> Publicado</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-indigo-500"/> Agendado</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500"/> Aviso</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-500"/> Erro</span>
      </div>
    </section>

    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
        <div><h2 className="font-bold text-slate-950">Publicações recentes</h2><p className="mt-0.5 text-xs text-slate-500">Abaixo do calendário, onde o histórico recente faz mais sentido.</p></div>
        <Link href="/historico" className="text-xs font-bold text-indigo-600">Ver todas</Link>
      </div>
      <div className="divide-y divide-slate-100">
        {publications.slice(0,3).map(publication => <Link key={publication.id} href={"/historico#" + publication.id} className="flex min-w-0 items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm">{publication.mediaType === "video" ? "▶" : "✦"}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{publication.baseText}</p><div className="mt-1 flex items-center gap-1">{publication.destinations.slice(0,4).map(destination => <PlatformIcon key={destination.id} platform={destination.platform} small/>)}</div></div>
          <StatusBadge status={publication.status}/>
        </Link>)}
      </div>
    </section>

    {drawerOpen && <>
      <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[1px] xl:hidden" onClick={() => setDrawerOpen(false)}/>
      <aside className="fixed inset-x-0 bottom-[72px] top-16 z-50 overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl xl:hidden">
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3"><p className="font-black text-slate-950">Detalhes da publicação</p><button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-slate-500"><X size={18}/></button></div>
        {details}
      </aside>
      <aside className="fixed inset-y-16 right-0 z-30 hidden w-[380px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl xl:block">
        <div className="flex items-center justify-between border-b border-slate-200 p-4"><p className="text-sm font-black text-slate-950">Detalhes da publicação</p><button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div>
        <div className="p-4">{details}</div>
      </aside>
    </>}
  </div>;
}
