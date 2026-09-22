"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ImagePlus,
  Library,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { platformLabels, socialPlatforms, type SocialPlatform } from "@/domain/social";
import { PlatformIcon } from "./ui/platform-icon";

type PublishMode = "now" | "schedule";
type RetentionMode = "delete" | "library";

const aiSuffix: Partial<Record<SocialPlatform, string>> = {
  instagram: "\n\n✨ Salve para ver depois. #conteudo #socialmedia",
  facebook: "\n\nO que você acha? Conte para a gente nos comentários.",
  tiktok: "\n\n#paravoce #conteudo",
  youtube: "\n\nInscreva-se para acompanhar os próximos conteúdos.",
  linkedin: "\n\nComo você aplica isso na sua rotina profissional?",
  x: "\n\n#conteudo",
  kwai: "\n\n#dicas #criadores",
};

export function PublicationEditor() {
  const [selected, setSelected] = useState<SocialPlatform[]>(["instagram", "tiktok", "facebook", "youtube"]);
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>("instagram");
  const [base, setBase] = useState("");
  const [customize, setCustomize] = useState(false);
  const [texts, setTexts] = useState<Partial<Record<SocialPlatform, string>>>({});
  const [titles, setTitles] = useState<Partial<Record<SocialPlatform, string>>>({});
  const [mode, setMode] = useState<PublishMode>("schedule");
  const [differentTimes, setDifferentTimes] = useState(false);
  const [retention, setRetention] = useState<RetentionMode>("delete");
  const [saved, setSaved] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState<"image" | "video" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function handleFile(file?: File) {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFileName(file.name);
    setFileType(file.type.startsWith("video/") ? "video" : "image");
    setPreviewUrl(URL.createObjectURL(file));
  }

  function removeFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileName("");
    setFileType(null);
  }

  function toggle(platform: SocialPlatform) {
    setSelected(current => {
      if (current.includes(platform)) {
        const next = current.filter(item => item !== platform);
        if (activePlatform === platform && next.length) setActivePlatform(next[0]);
        return next;
      }
      setActivePlatform(platform);
      return [...current, platform];
    });
  }

  function adaptAll() {
    const next: Partial<Record<SocialPlatform, string>> = {};
    selected.forEach(platform => next[platform] = base + (aiSuffix[platform] ?? ""));
    setTexts(next);
    if (selected.includes("youtube") && !titles.youtube) {
      setTitles(current => ({ ...current, youtube: base.slice(0, 80) || "Novo vídeo" }));
    }
    setCustomize(true);
    setSaved(false);
  }

  const effectiveText = (platform: SocialPlatform) => texts[platform] ?? base;

  const checks = selected.map(platform => {
    if (!base.trim()) return { platform, level: "error" as const, text: "Adicione o conteúdo-base" };
    if (platform === "youtube" && !(titles.youtube?.trim())) return { platform, level: "warning" as const, text: "Título será necessário" };
    if (effectiveText(platform).length > 2000) return { platform, level: "warning" as const, text: "Revise o tamanho do texto" };
    return { platform, level: "ok" as const, text: "Pronto" };
  });

  const canSubmit = !!base.trim() && selected.length > 0 && !checks.some(check => check.level === "error");

  return <div className="space-y-5">
    <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="eyebrow">Composer</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Criar publicação</h1>
        <p className="mt-1 text-sm text-slate-500">Crie uma vez. Personalize somente quando fizer sentido.</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 sm:inline-flex">● Salvamento automático</span>
        <button onClick={() => setSaved(true)} className="btn-secondary">Salvar rascunho</button>
      </div>
    </section>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <section className="card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-950">1. Mídia</h2>
              <p className="mt-1 text-xs text-slate-500">Use um arquivo do computador ou escolha da biblioteca.</p>
            </div>
            <button className="btn-secondary hidden sm:inline-flex"><Library size={15}/> Biblioteca</button>
          </div>

          {previewUrl ? <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-100">
              {fileType === "video" ? <video src={previewUrl} className="h-full w-full object-cover" muted playsInline/> : <img src={previewUrl} alt="Prévia da mídia" className="h-full w-full object-cover"/>}
              <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/75 px-2 py-1 text-[10px] font-bold text-white">{fileType === "video" ? "VÍDEO" : "IMAGEM"}</span>
            </div>
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="truncate text-sm font-bold text-slate-900">{fileName}</p>
                <p className="mt-1 text-xs text-slate-500">Pré-visualização local. O upload real entra na etapa de mídia/R2.</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <label className="btn-secondary cursor-pointer"><UploadCloud size={15}/> Substituir<input type="file" accept="image/*,video/*" className="sr-only" onChange={event => handleFile(event.target.files?.[0])}/></label>
                <button onClick={removeFile} className="btn-secondary !text-red-600"><Trash2 size={15}/> Remover</button>
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-bold text-slate-700">Depois de concluir todos os destinos</p>
                <div className="mt-2 flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:gap-4">
                  <label className="flex items-center gap-2"><input type="radio" checked={retention === "delete"} onChange={() => setRetention("delete")}/> Excluir automaticamente</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={retention === "library"} onChange={() => setRetention("library")}/> Manter na biblioteca</label>
                </div>
              </div>
            </div>
          </div> : <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-5 text-center transition-colors hover:bg-indigo-50">
              <ImagePlus className="text-indigo-600" size={24}/>
              <span className="mt-2 text-sm font-bold text-slate-900">Adicionar imagem ou vídeo</span>
              <span className="mt-1 text-xs text-slate-500">Clique para selecionar</span>
              <input type="file" accept="image/*,video/*" className="sr-only" onChange={event => handleFile(event.target.files?.[0])}/>
            </label>
            <button className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-5 text-center hover:bg-slate-100">
              <Library className="text-slate-600" size={24}/>
              <span className="mt-2 text-sm font-bold text-slate-900">Escolher da biblioteca</span>
              <span className="mt-1 text-xs text-slate-500">Mídias que você decidiu guardar</span>
            </button>
          </div>}
        </section>

        <section className="card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-950">2. Onde publicar?</h2>
              <p className="mt-1 text-xs text-slate-500">Cada destino continua independente dos demais.</p>
            </div>
            <button onClick={() => setSelected(selected.length === socialPlatforms.length ? [] : [...socialPlatforms])} className="text-xs font-bold text-indigo-600">
              {selected.length === socialPlatforms.length ? "Limpar" : "Selecionar todas"}
            </button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {socialPlatforms.map(platform => {
              const active = selected.includes(platform);
              return <button key={platform} onClick={() => toggle(platform)} aria-pressed={active} className={`focusable flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${active ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                <PlatformIcon platform={platform} small/>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-slate-900">{platformLabels[platform]}</span>
                  <span className="block truncate text-[11px] text-slate-500">@conta</span>
                </span>
                <span className={`grid h-5 w-5 place-items-center rounded-md border ${active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>{active && <Check size={12}/>}</span>
              </button>;
            })}
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-950">3. Conteúdo</h2>
              <p className="mt-1 text-xs text-slate-500">O conteúdo-base é usado em todas as redes até você decidir personalizar.</p>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-bold">
              <button onClick={() => setCustomize(false)} className={`rounded-md px-3 py-1.5 ${!customize ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Conteúdo-base</button>
              <button onClick={() => setCustomize(true)} className={`rounded-md px-3 py-1.5 ${customize ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Personalizar por rede</button>
            </div>
          </div>

          {!customize ? <div className="mt-4">
            <textarea value={base} onChange={event => { setBase(event.target.value); setSaved(false); }} placeholder="Escreva sua legenda principal aqui..." className="field min-h-36 resize-y p-4 text-sm"/>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-500">{base.length} caracteres</span>
              <button onClick={adaptAll} disabled={!base.trim() || !selected.length} className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"><Sparkles size={16}/> Adaptar para todas</button>
            </div>
          </div> : <div className="mt-4">
            {selected.length ? <>
              <div className="app-scrollbar flex gap-1 overflow-x-auto border-b border-slate-200">
                {selected.map(platform => <button key={platform} onClick={() => setActivePlatform(platform)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-bold ${activePlatform === platform ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}><PlatformIcon platform={platform} small/>{platformLabels[platform]}</button>)}
              </div>
              <div className="mt-4">
                {activePlatform === "youtube" && <label className="mb-3 block text-xs font-bold text-slate-700">Título do YouTube<input value={titles.youtube ?? ""} onChange={event => setTitles(current => ({ ...current, youtube: event.target.value }))} className="field mt-1 px-3 text-sm" placeholder="Título do vídeo"/></label>}
                <textarea value={effectiveText(activePlatform)} onChange={event => setTexts(current => ({ ...current, [activePlatform]: event.target.value }))} className="field min-h-36 resize-y p-4 text-sm"/>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-slate-500">Personalização de {platformLabels[activePlatform]}.</p>
                  <button onClick={() => setTexts(current => ({ ...current, [activePlatform]: base }))} className="text-xs font-bold text-indigo-600">Usar conteúdo-base</button>
                </div>
              </div>
            </> : <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Selecione ao menos uma conta para personalizar.</p>}
          </div>}
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="text-sm font-bold text-slate-950">4. Quando publicar?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => setMode("now")} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${mode === "now" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-700"}`}><Send size={16}/> Publicar agora</button>
            <button onClick={() => setMode("schedule")} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${mode === "schedule" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-700"}`}><CalendarClock size={16}/> Agendar</button>
          </div>

          {mode === "schedule" && <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-700">Data<input type="date" defaultValue="2026-09-25" className="field mt-1 px-3 text-sm"/></label>
              <label className="text-xs font-bold text-slate-700">Horário<input type="time" defaultValue="18:30" className="field mt-1 px-3 text-sm"/></label>
            </div>
            <label className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={differentTimes} onChange={event => setDifferentTimes(event.target.checked)}/>
              Usar horários diferentes por rede
            </label>
            {differentTimes && <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {selected.map(platform => <label key={platform} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs font-bold text-slate-700"><PlatformIcon platform={platform} small/><span className="flex-1">{platformLabels[platform]}</span><input type="time" defaultValue="18:30" className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"/></label>)}
            </div>}
          </div>}
        </section>

        <section className="card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-600" size={18}/>
            <h2 className="text-sm font-bold text-slate-950">5. Verificação</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Valide antes de enviar. Avisos não escondem limitações da plataforma.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map(check => <button key={check.platform} onClick={() => { setCustomize(true); setActivePlatform(check.platform); }} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${check.level === "error" ? "border-red-200 bg-red-50" : check.level === "warning" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
              <PlatformIcon platform={check.platform} small/>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-slate-900">{platformLabels[check.platform]}</span>
                <span className={`block truncate text-[11px] ${check.level === "error" ? "text-red-700" : check.level === "warning" ? "text-amber-700" : "text-emerald-700"}`}>{check.text}</span>
              </span>
              {check.level === "ok" ? <CheckCircle2 size={15} className="text-emerald-600"/> : <CircleAlert size={15} className={check.level === "error" ? "text-red-600" : "text-amber-600"}/>}
            </button>)}
          </div>
        </section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <section className="card overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <p className="font-bold text-slate-950">Prévia da publicação</p>
            <p className="mt-1 text-xs text-slate-500">Aproximação visual. O resultado final pode variar por rede.</p>
          </div>
          <div className="app-scrollbar flex gap-1 overflow-x-auto border-b border-slate-200 px-3 pt-2">
            {selected.map(platform => <button key={platform} onClick={() => setActivePlatform(platform)} className={`flex min-w-12 items-center justify-center border-b-2 px-3 py-2 ${activePlatform === platform ? "border-indigo-600" : "border-transparent"}`}><PlatformIcon platform={platform} small/></button>)}
          </div>
          <div className="bg-slate-50 p-4">
            <div className="mx-auto max-w-[300px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-100 text-[10px] font-black text-indigo-700">TS</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">@conta</p>
                  <p className="text-[10px] text-slate-400">{platformLabels[activePlatform]}</p>
                </div>
              </div>
              <div className="aspect-[4/5] bg-gradient-to-br from-indigo-50 via-slate-100 to-violet-100">
                {previewUrl && (fileType === "video" ? <video src={previewUrl} className="h-full w-full object-cover" muted playsInline/> : <img src={previewUrl} alt="" className="h-full w-full object-cover"/>)}
              </div>
              <div className="p-3">
                {activePlatform === "youtube" && titles.youtube && <p className="mb-1 text-sm font-black text-slate-950">{titles.youtube}</p>}
                <p className="whitespace-pre-line text-xs leading-5 text-slate-700">{effectiveText(activePlatform) || "Seu conteúdo aparecerá aqui."}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="card p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Destinos</span><strong className="text-slate-900">{selected.length}</strong>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">Envio</span><strong className="text-slate-900">{mode === "now" ? "Agora" : "Agendado"}</strong>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">Arquivo após publicar</span><strong className="text-slate-900">{retention === "delete" ? "Excluir" : "Biblioteca"}</strong>
          </div>
          <button disabled={!canSubmit} onClick={() => setSaved(true)} className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-40">{mode === "now" ? <Send size={16}/> : <Clock3 size={16}/>} {mode === "now" ? "Publicar agora" : "Agendar publicação"}</button>
          {saved && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">Salvo no modo demonstração. Nenhuma rede externa foi acionada.</p>}
        </section>
      </aside>
    </div>
  </div>;
}
