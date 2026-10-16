"use client";

import { useMemo, useState } from "react";
import { FileImage, Film, Grid2X2, Heart, List, MoreHorizontal, Search, Trash2, UploadCloud, X } from "lucide-react";

type MediaKind = "video" | "image";
type MediaItem = {
  id: string;
  name: string;
  kind: MediaKind;
  size: string;
  date: string;
  duration?: string;
  tone: string;
  favorite?: boolean;
};

const items: MediaItem[] = [
  { id: "m1", name: "skincare-rotina.mp4", kind: "video", size: "23,4 MB", date: "20 set 2026", duration: "0:28", tone: "from-rose-100 via-orange-50 to-amber-100", favorite: true },
  { id: "m2", name: "produtos-estetica.mp4", kind: "video", size: "18,1 MB", date: "20 set 2026", duration: "0:15", tone: "from-amber-100 via-stone-50 to-orange-100" },
  { id: "m3", name: "sobrancelhas.mp4", kind: "video", size: "12,6 MB", date: "19 set 2026", duration: "0:12", tone: "from-amber-200 via-orange-100 to-rose-100" },
  { id: "m4", name: "limpeza-de-pele.mp4", kind: "video", size: "28,4 MB", date: "19 set 2026", duration: "0:30", tone: "from-slate-100 via-stone-100 to-rose-100" },
  { id: "m5", name: "depilacao-laser.mp4", kind: "video", size: "22,1 MB", date: "18 set 2026", duration: "0:25", tone: "from-orange-100 via-rose-100 to-pink-100" },
  { id: "m6", name: "pele-saudavel.jpg", kind: "image", size: "3,2 MB", date: "18 set 2026", tone: "from-rose-50 via-amber-50 to-stone-100" },
  { id: "m7", name: "spa-relaxamento.jpg", kind: "image", size: "4,1 MB", date: "17 set 2026", tone: "from-stone-200 via-amber-50 to-emerald-50" },
  { id: "m8", name: "post-beleza.png", kind: "image", size: "1,8 MB", date: "17 set 2026", tone: "from-pink-100 via-rose-50 to-orange-50" },
  { id: "m9", name: "tratamento-facial.mp4", kind: "video", size: "19,3 MB", date: "16 set 2026", duration: "0:20", tone: "from-stone-200 via-orange-100 to-amber-50" },
  { id: "m10", name: "massagem-relaxante.mp4", kind: "video", size: "31,5 MB", date: "15 set 2026", duration: "0:40", tone: "from-stone-300 via-amber-100 to-orange-100" },
  { id: "m11", name: "oleos-naturais.jpg", kind: "image", size: "2,8 MB", date: "15 set 2026", tone: "from-emerald-100 via-stone-100 to-amber-50" },
];

export default function LibraryPage() {
  const [filter, setFilter] = useState<"all" | MediaKind | "favorite">("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<MediaItem | null>(null);

  const visible = useMemo(() => items.filter(item => {
    const byType = filter === "all" || (filter === "favorite" ? item.favorite : item.kind === filter);
    const byQuery = item.name.toLowerCase().includes(query.toLowerCase());
    return byType && byQuery;
  }), [filter, query]);

  const detail = selected && <div className="space-y-5">
    <div className={`relative aspect-[4/5] rounded-2xl bg-gradient-to-br ${selected.tone}`}>
      <div className="absolute inset-0 grid place-items-center text-slate-500/60">{selected.kind === "video" ? <Film size={42}/> : <FileImage size={42}/>}</div>
      {selected.duration && <span className="absolute bottom-3 left-3 rounded-md bg-slate-950/75 px-2 py-1 text-xs font-bold text-white">{selected.duration}</span>}
    </div>
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-400">Tipo</p><p className="mt-1 font-bold text-slate-900">{selected.kind === "video" ? "Vídeo" : "Imagem"}</p></div>
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-400">Tamanho</p><p className="mt-1 font-bold text-slate-900">{selected.size}</p></div>
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-400">Adicionado</p><p className="mt-1 font-bold text-slate-900">{selected.date}</p></div>
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-400">Retenção</p><p className="mt-1 font-bold text-slate-900">Biblioteca</p></div>
    </div>
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">Usado em</p>
      <div className="mt-2 grid grid-cols-3 gap-2">{[1,2,3].map(index => <div key={index} className="aspect-video rounded-lg bg-gradient-to-br from-indigo-50 to-rose-50"/>)}</div>
    </div>
    <div className="space-y-2">
      <button className="btn-secondary w-full justify-start"><Heart size={15}/> Adicionar aos favoritos</button>
      <button className="btn-secondary w-full justify-start"><MoreHorizontal size={15}/> Mais opções</button>
      <button className="btn-secondary w-full justify-start !border-red-200 !text-red-600"><Trash2 size={15}/> Excluir</button>
    </div>
  </div>;

  return <div className="w-full max-w-full space-y-4 overflow-x-hidden">
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">Mídia</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Biblioteca</h1>
        <p className="mt-1 text-sm text-slate-500">Arquivos que você decidiu manter para reutilizar.</p>
      </div>
      <button className="btn-primary self-start"><UploadCloud size={16}/> Adicionar mídia</button>
    </section>

    <section className="card min-w-0 overflow-hidden">
      <div className="border-b border-slate-200 p-3 sm:p-4">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <label className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
            <input value={query} onChange={event => setQuery(event.target.value)} className="field pl-9 pr-3 text-base sm:text-sm" placeholder="Buscar na biblioteca..."/>
          </label>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 sm:min-w-52">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>7,2 GB de 20 GB</span><span>36%</span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[36%] rounded-full bg-indigo-500"/></div>
            </div>
            <div className="flex shrink-0 rounded-lg bg-slate-100 p-1">
              <button onClick={() => setView("list")} className={`rounded-md p-2 ${view === "list" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`} aria-label="Visualização em lista"><List size={16}/></button>
              <button onClick={() => setView("grid")} className={`rounded-md p-2 ${view === "grid" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`} aria-label="Visualização em grade"><Grid2X2 size={16}/></button>
            </div>
          </div>
        </div>
        <div className="app-scrollbar mt-3 flex max-w-full gap-2 overflow-x-auto">
          {([["all","Todos"],["video","Vídeos"],["image","Imagens"],["favorite","Favoritos"]] as const).map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-bold sm:text-xs ${filter === value ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"}`}>{label}</button>)}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {view === "grid" ? <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-4">
          {visible.map(item => <button key={item.id} onClick={() => setSelected(item)} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md">
            <div className={`relative aspect-video bg-gradient-to-br ${item.tone}`}>
              <div className="absolute inset-0 grid place-items-center text-slate-500/65">{item.kind === "video" ? <Film size={28}/> : <FileImage size={28}/>}</div>
              {item.duration && <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/75 px-1.5 py-1 text-xs font-bold text-white">{item.duration}</span>}
              {item.favorite && <Heart className="absolute right-2 top-2 fill-amber-400 text-amber-500" size={17}/>}
            </div>
            <div className="flex min-w-0 items-start gap-2 p-2.5 sm:p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900 sm:text-xs">{item.name}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{item.date} · {item.size}</p>
              </div>
              <MoreHorizontal className="shrink-0 text-slate-400" size={16}/>
            </div>
          </button>)}
        </div> : <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {visible.map(item => <button key={item.id} onClick={() => setSelected(item)} className="flex w-full min-w-0 items-center gap-3 p-3 text-left hover:bg-slate-50">
            <div className={`grid h-12 w-16 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${item.tone} text-slate-500`}>{item.kind === "video" ? <Film size={20}/> : <FileImage size={20}/>}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{item.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{item.date} · {item.size}</p></div>
            {item.favorite && <Heart className="shrink-0 fill-amber-400 text-amber-500" size={16}/>}
            <MoreHorizontal className="shrink-0 text-slate-400" size={16}/>
          </button>)}
        </div>}
      </div>
    </section>

    {selected && <>
      <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[1px] xl:hidden" onClick={() => setSelected(null)}/>
      <aside className="fixed inset-x-0 bottom-[72px] top-16 z-50 overflow-y-auto rounded-t-2xl bg-white shadow-2xl xl:hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-4">
          <p className="truncate pr-3 font-black text-slate-950">{selected.name}</p>
          <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-500"><X size={18}/></button>
        </div>
        <div className="p-4">{detail}</div>
      </aside>
      <aside className="fixed inset-y-16 right-0 z-30 hidden w-[360px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl xl:block">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-4">
          <p className="truncate pr-3 text-sm font-black text-slate-950">{selected.name}</p>
          <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button>
        </div>
        <div className="p-4">{detail}</div>
      </aside>
    </>}
  </div>;
}
