"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Heart,
  ImagePlus,
  Library,
  MessageCircle,
  MoreHorizontal,
  Play,
  Repeat2,
  Send,
  Share2,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { platformLabels, socialPlatforms, type ConnectionStatus, type SocialPlatform } from "@/domain/social";
import { PlatformIcon } from "./ui/platform-icon";
import { useTenantData } from "@/components/tenant-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PublishMode = "now" | "schedule";
type RetentionMode = "delete" | "library";
type SaveIntent = "draft" | "publish_now" | "schedule";

interface DestinationOption {
  id: string;
  platform: SocialPlatform;
  label: string;
  handle: string;
  status: ConnectionStatus;
  connectionId?: string;
}

const aiSuffixPlain: Partial<Record<SocialPlatform, string>> = {
  instagram: "\n\nSalve para ver depois. #conteudo #socialmedia",
  facebook: "\n\nO que você acha? Conte para a gente nos comentários.",
  tiktok: "\n\n#paravoce #conteudo",
  youtube: "\n\nInscreva-se para acompanhar os próximos conteúdos.",
  linkedin: "\n\nComo você aplica isso na sua rotina profissional?",
  x: "\n\n#conteudo",
  kwai: "\n\n#dicas #criadores",
};

const aiSuffixEmoji: Partial<Record<SocialPlatform, string>> = {
  instagram: "\n\n✨ Salve para ver depois. 💾 #conteudo #socialmedia",
  facebook: "\n\n💬 O que você acha? Conte para a gente nos comentários.",
  tiktok: "\n\n✨ #paravoce #conteudo",
  youtube: "\n\n▶️ Inscreva-se para acompanhar os próximos conteúdos.",
  linkedin: "\n\n💡 Como você aplica isso na sua rotina profissional?",
  x: "\n\n✨ #conteudo",
  kwai: "\n\n🔥 #dicas #criadores",
};

function PreviewChrome({ platform }: { platform: SocialPlatform }) {
  if (platform === "instagram") {
    return <div className="flex items-center justify-between px-3 py-2 text-slate-700"><div className="flex gap-3"><Heart size={18}/><MessageCircle size={18}/><Send size={18}/></div><span className="text-[11px] font-bold">Instagram</span></div>;
  }
  if (platform === "facebook") {
    return <div className="grid grid-cols-3 border-t border-slate-100 text-center text-[11px] font-semibold text-slate-500"><span className="py-2">Curtir</span><span className="py-2">Comentar</span><span className="py-2">Compartilhar</span></div>;
  }
  if (platform === "tiktok" || platform === "kwai") {
    return <div className="absolute bottom-3 right-3 flex flex-col gap-3 text-white drop-shadow"><Heart size={19}/><MessageCircle size={19}/><Share2 size={19}/></div>;
  }
  if (platform === "youtube") {
    return <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2"><span className="text-[11px] font-bold text-slate-600">YouTube</span><div className="flex gap-3 text-slate-500"><Heart size={17}/><Share2 size={17}/></div></div>;
  }
  if (platform === "linkedin") {
    return <div className="grid grid-cols-4 border-t border-slate-100 text-center text-[10px] font-semibold text-slate-500"><span className="py-2">Gostei</span><span className="py-2">Comentar</span><span className="py-2">Republicar</span><span className="py-2">Enviar</span></div>;
  }
  return <div className="flex items-center gap-4 border-t border-slate-100 px-3 py-2 text-slate-500"><MessageCircle size={16}/><Repeat2 size={16}/><Heart size={16}/><Share2 size={16}/></div>;
}

function toIso(date: string, time: string) {
  const parsed = new Date(date + "T" + time + ":00");
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function PublicationEditor() {
  const tenant = useTenantData();
  const initialized = useRef(false);

  const destinationOptions = useMemo<DestinationOption[]>(() => {
    if (tenant.source === "supabase") {
      return tenant.connections.map(connection => ({
        id: connection.id,
        platform: connection.platform,
        label: connection.displayName ?? platformLabels[connection.platform],
        handle: connection.handle ?? platformLabels[connection.platform],
        status: connection.status,
        connectionId: connection.id,
      }));
    }

    return socialPlatforms.map(platform => ({
      id: "demo:" + platform,
      platform,
      label: platformLabels[platform],
      handle: "@conta",
      status: "connected",
    }));
  }, [tenant.source, tenant.connections]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState("");
  const [base, setBase] = useState("");
  const [customize, setCustomize] = useState(false);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<PublishMode>("schedule");
  const [differentTimes, setDifferentTimes] = useState(false);
  const [destinationTimes, setDestinationTimes] = useState<Record<string, string>>({});
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [retention, setRetention] = useState<RetentionMode>("delete");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState<"image" | "video" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [date, setDate] = useState("2026-09-25");
  const [time, setTime] = useState("18:30");

  useEffect(() => {
    if (tenant.loading || initialized.current) return;
    initialized.current = true;
    const preferred = tenant.source === "supabase"
      ? destinationOptions.filter(option => option.status === "connected").map(option => option.id)
      : destinationOptions.filter(option => ["instagram", "tiktok", "facebook", "youtube"].includes(option.platform)).map(option => option.id);
    setSelectedIds(preferred);
    setActiveId(preferred[0] ?? destinationOptions[0]?.id ?? "");
  }, [tenant.loading, tenant.source, destinationOptions]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const selectedOptions = destinationOptions.filter(option => selectedIds.includes(option.id));
  const activeOption = selectedOptions.find(option => option.id === activeId) ?? selectedOptions[0] ?? destinationOptions[0];

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

  function toggle(option: DestinationOption) {
    setSelectedIds(current => {
      if (current.includes(option.id)) {
        const next = current.filter(item => item !== option.id);
        if (activeId === option.id) setActiveId(next[0] ?? "");
        return next;
      }
      setActiveId(option.id);
      return [...current, option.id];
    });
    setSaveMessage("");
  }

  function adaptAll() {
    const suffixes = includeEmojis ? aiSuffixEmoji : aiSuffixPlain;
    const next = { ...texts };
    const nextTitles = { ...titles };
    selectedOptions.forEach(option => {
      next[option.id] = base + (suffixes[option.platform] ?? "");
      if (option.platform === "youtube" && !nextTitles[option.id]) {
        nextTitles[option.id] = base.slice(0, 80) || "Novo vídeo";
      }
    });
    setTexts(next);
    setTitles(nextTitles);
    setCustomize(true);
    setSaveMessage("");
  }

  const effectiveText = (option: DestinationOption) => texts[option.id] ?? base;

  const checks = selectedOptions.map(option => {
    if (!base.trim()) return { option, level: "error" as const, text: "Adicione a descrição base" };
    if (tenant.source === "supabase" && option.status !== "connected") return { option, level: "error" as const, text: "Conta precisa ser reconectada" };
    if (option.platform === "youtube" && !(titles[option.id]?.trim())) return { option, level: "warning" as const, text: "Título será necessário" };
    if (effectiveText(option).length > 2000) return { option, level: "warning" as const, text: "Revise o tamanho da descrição" };
    return { option, level: "ok" as const, text: "Pronto" };
  });

  const canSubmit = !!base.trim() && selectedOptions.length > 0 && !checks.some(check => check.level === "error");

  async function persist(intent: SaveIntent) {
    setSaving(true);
    setSaveError("");
    setSaveMessage("");

    if (tenant.source !== "supabase") {
      setSaveMessage("Salvo no modo demonstração. Nenhuma rede externa foi acionada.");
      setSaving(false);
      return;
    }

    if (!tenant.user || !tenant.organization || tenant.activeBrand.id === "unconfigured") {
      setSaveError("Conclua a configuração da conta antes de salvar uma publicação.");
      setSaving(false);
      return;
    }

    if (!selectedOptions.length || selectedOptions.some(option => !option.connectionId)) {
      setSaveError("Selecione pelo menos uma conta social conectada.");
      setSaving(false);
      return;
    }

    const client = createSupabaseBrowserClient();
    if (!client) {
      setSaveError("Supabase não está configurado neste ambiente.");
      setSaving(false);
      return;
    }

    const timezone = tenant.activeBrand.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const targets = selectedOptions.map(option => {
      const targetTime = differentTimes ? (destinationTimes[option.id] || time) : time;
      return {
        connection_id: option.connectionId as string,
        provider: option.platform,
        scheduled_at: intent === "publish_now" ? new Date().toISOString() : toIso(date, targetTime),
        scheduled_timezone: timezone,
        caption_override: effectiveText(option) === base ? "" : effectiveText(option),
        title_override: titles[option.id] ?? "",
        requested_action: intent,
        retention: retention,
      };
    });

    const result = await client.rpc("save_post_draft", {
      p_brand_id: tenant.activeBrand.id,
      p_internal_title: base.trim().slice(0, 80) || "Nova publicação",
      p_base_caption: base.trim(),
      p_targets: targets,
    });

    if (result.error) {
      setSaveError(result.error.message);
      setSaving(false);
      return;
    }

    if (intent === "draft") {
      setSaveMessage("Rascunho salvo no Supabase real.");
    } else {
      setSaveMessage("Intenção salva no Supabase. O worker de publicação ainda não está ativado, então nenhuma rede externa foi acionada.");
    }
    setSaving(false);
  }

  return <div className="w-full max-w-full space-y-5 overflow-x-hidden">
    <section>
      <p className="eyebrow">Publicação</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Criar publicação</h1>
      <p className="mt-1 text-sm leading-6 text-slate-500">Mídia, descrição, destinos e horário em um único fluxo.</p>
      {tenant.source === "supabase" && <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Dados reais da marca: {tenant.activeBrand.name}</p>}
    </section>

    <div className="grid w-full max-w-full gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <section className="card p-4 sm:p-5">
          <div>
            <h2 className="text-base font-bold text-slate-950 sm:text-sm">1. Mídia</h2>
            <p className="mt-1 text-sm text-slate-500 sm:text-xs">Envie um arquivo ou escolha algo que já está na biblioteca.</p>
          </div>

          {previewUrl ? <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-100">
              {fileType === "video" ? <video src={previewUrl} className="h-full w-full object-cover" muted playsInline/> : <img src={previewUrl} alt="Prévia da mídia" className="h-full w-full object-cover"/>}
              <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/75 px-2 py-1 text-xs font-bold text-white">{fileType === "video" ? "VÍDEO" : "IMAGEM"}</span>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="truncate text-sm font-bold text-slate-900">{fileName}</p>
              <p className="mt-1 text-sm leading-5 text-slate-500 sm:text-xs">Pré-visualização local. O upload definitivo será conectado ao storage depois.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <label className="btn-secondary cursor-pointer"><UploadCloud size={15}/> Substituir<input type="file" accept="image/*,video/*" className="sr-only" onChange={event => handleFile(event.target.files?.[0])}/></label>
                <button onClick={removeFile} className="btn-secondary !text-red-600"><Trash2 size={15}/> Remover</button>
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-sm font-bold text-slate-700 sm:text-xs">Depois de concluir todos os destinos</p>
                <div className="mt-2 flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:gap-4 sm:text-xs">
                  <label className="flex items-center gap-2"><input type="radio" checked={retention === "delete"} onChange={() => setRetention("delete")}/> Excluir automaticamente</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={retention === "library"} onChange={() => setRetention("library")}/> Manter na biblioteca</label>
                </div>
              </div>
            </div>
          </div> : <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-5 text-center transition-colors hover:bg-indigo-50">
              <ImagePlus className="text-indigo-600" size={26}/>
              <span className="mt-2 text-base font-bold text-slate-900 sm:text-sm">Adicionar imagem ou vídeo</span>
              <span className="mt-1 text-sm text-slate-500 sm:text-xs">Clique para selecionar</span>
              <input type="file" accept="image/*,video/*" className="sr-only" onChange={event => handleFile(event.target.files?.[0])}/>
            </label>
            <button className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-5 text-center hover:bg-slate-100">
              <Library className="text-slate-600" size={26}/>
              <span className="mt-2 text-base font-bold text-slate-900 sm:text-sm">Escolher da biblioteca</span>
              <span className="mt-1 text-sm text-slate-500 sm:text-xs">Mídias que você decidiu guardar</span>
            </button>
          </div>}
        </section>

        <section className="card min-w-0 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-950 sm:text-sm">2. Onde publicar?</h2>
              <p className="mt-1 text-sm text-slate-500 sm:text-xs">{tenant.source === "supabase" ? "Cada conta conectada é um destino independente." : "Modo demonstração: escolha as redes para simular o fluxo."}</p>
            </div>
            {!!destinationOptions.length && <button onClick={() => setSelectedIds(selectedIds.length === destinationOptions.length ? [] : destinationOptions.map(option => option.id))} className="shrink-0 text-sm font-bold text-indigo-600 sm:text-xs">
              {selectedIds.length === destinationOptions.length ? "Limpar" : "Selecionar todas"}
            </button>}
          </div>

          {tenant.source === "supabase" && !destinationOptions.length ? <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <p className="text-sm font-bold text-slate-900">Nenhuma conta social conectada ainda.</p>
            <p className="mt-1 text-sm text-slate-500">Conecte pelo menos uma conta antes de criar destinos reais.</p>
            <Link href="/conexoes" className="btn-secondary mt-3">Ir para Contas</Link>
          </div> : <div className="mt-4 grid w-full max-w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {destinationOptions.map(option => {
              const active = selectedIds.includes(option.id);
              const blocked = tenant.source === "supabase" && option.status !== "connected";
              return <button key={option.id} onClick={() => toggle(option)} aria-pressed={active} className={`focusable flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors ${active ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                <PlatformIcon platform={option.platform} small/>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900 sm:text-xs">{option.label}</span>
                  <span className={`block truncate text-sm sm:text-xs ${blocked ? "text-amber-600" : "text-slate-500"}`}>{blocked ? "Reconexão necessária" : option.handle}</span>
                </span>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>{active && <Check size={12}/>}</span>
              </button>;
            })}
          </div>}
        </section>

        <section className="card min-w-0 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-950 sm:text-sm">3. Descrição</h2>
              <p className="mt-1 text-sm text-slate-500 sm:text-xs">Use uma descrição base e personalize somente quando quiser.</p>
            </div>
            <div className="flex max-w-full rounded-lg bg-slate-100 p-1 text-sm font-bold sm:text-xs">
              <button onClick={() => setCustomize(false)} className={`rounded-md px-3 py-2 ${!customize ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Descrição base</button>
              <button onClick={() => setCustomize(true)} className={`rounded-md px-3 py-2 ${customize ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Por destino</button>
            </div>
          </div>

          {!customize ? <div className="mt-4">
            <textarea value={base} onChange={event => { setBase(event.target.value); setSaveMessage(""); }} placeholder="Escreva a descrição principal aqui..." className="field min-h-36 resize-y p-4 text-base sm:text-sm"/>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-500 sm:text-xs">{base.length} caracteres</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 sm:text-xs">
                  <input type="checkbox" checked={includeEmojis} onChange={event => setIncludeEmojis(event.target.checked)}/>
                  Usar emojis
                </label>
                <button onClick={adaptAll} disabled={!base.trim() || !selectedOptions.length} className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"><Sparkles size={16}/> Adaptar para todas</button>
              </div>
            </div>
          </div> : <div className="mt-4 min-w-0">
            {selectedOptions.length ? <>
              <div className="app-scrollbar flex max-w-full gap-1 overflow-x-auto border-b border-slate-200">
                {selectedOptions.map(option => <button key={option.id} onClick={() => setActiveId(option.id)} className={`flex max-w-44 shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-bold sm:text-xs ${activeId === option.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}><PlatformIcon platform={option.platform} small/><span className="truncate">{option.label}</span></button>)}
              </div>
              {activeOption && <div className="mt-4">
                {activeOption.platform === "youtube" && <label className="mb-3 block text-sm font-bold text-slate-700 sm:text-xs">Título do YouTube<input value={titles[activeOption.id] ?? ""} onChange={event => setTitles(current => ({ ...current, [activeOption.id]: event.target.value }))} className="field mt-1 px-3 text-base sm:text-sm" placeholder="Título do vídeo"/></label>}
                <textarea value={effectiveText(activeOption)} onChange={event => setTexts(current => ({ ...current, [activeOption.id]: event.target.value }))} className="field min-h-36 resize-y p-4 text-base sm:text-sm"/>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-500 sm:text-xs">Personalização de {activeOption.label}.</p>
                  <button onClick={() => setTexts(current => ({ ...current, [activeOption.id]: base }))} className="text-sm font-bold text-indigo-600 sm:text-xs">Usar descrição base</button>
                </div>
              </div>}
            </> : <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Selecione ao menos uma conta para personalizar.</p>}
          </div>}
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="text-base font-bold text-slate-950 sm:text-sm">4. Quando publicar?</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button onClick={() => setMode("now")} className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${mode === "now" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-700"}`}><Send size={16}/> Publicar agora</button>
            <button onClick={() => setMode("schedule")} className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${mode === "schedule" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-700"}`}><CalendarClock size={16}/> Agendar</button>
          </div>

          {mode === "schedule" && <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-700 sm:text-xs">Data<input type="date" value={date} onChange={event => setDate(event.target.value)} className="field mt-1 px-3 text-base sm:text-sm"/></label>
              <label className="text-sm font-bold text-slate-700 sm:text-xs">Horário<input type="time" value={time} onChange={event => setTime(event.target.value)} className="field mt-1 px-3 text-base sm:text-sm"/></label>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700 sm:text-xs">
              <input type="checkbox" checked={differentTimes} onChange={event => setDifferentTimes(event.target.checked)}/>
              Usar horários diferentes por destino
            </label>
            {differentTimes && <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {selectedOptions.map(option => <label key={option.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-700 sm:text-xs"><PlatformIcon platform={option.platform} small/><span className="min-w-0 flex-1 truncate">{option.label}</span><input type="time" value={destinationTimes[option.id] ?? time} onChange={event => setDestinationTimes(current => ({ ...current, [option.id]: event.target.value }))} className="w-28 shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-base sm:text-xs"/></label>)}
            </div>}
          </div>}
        </section>

        <section className="card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-600" size={18}/>
            <h2 className="text-base font-bold text-slate-950 sm:text-sm">5. Verificação</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500 sm:text-xs">Avisos por destino antes de publicar.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map(check => <button key={check.option.id} onClick={() => { setCustomize(true); setActiveId(check.option.id); }} className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left ${check.level === "error" ? "border-red-200 bg-red-50" : check.level === "warning" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
              <PlatformIcon platform={check.option.platform} small/>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900 sm:text-xs">{check.option.label}</span>
                <span className={`block truncate text-sm sm:text-xs ${check.level === "error" ? "text-red-700" : check.level === "warning" ? "text-amber-700" : "text-emerald-700"}`}>{check.text}</span>
              </span>
              {check.level === "ok" ? <CheckCircle2 size={15} className="shrink-0 text-emerald-600"/> : <CircleAlert size={15} className={`shrink-0 ${check.level === "error" ? "text-red-600" : "text-amber-600"}`}/>}
            </button>)}
          </div>
        </section>
      </div>

      <aside className="min-w-0 space-y-4 xl:sticky xl:top-20 xl:self-start">
        <section className="card min-w-0 overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <p className="font-bold text-slate-950">Prévia da publicação</p>
            <p className="mt-1 text-sm leading-5 text-slate-500 sm:text-xs">Simulação aproximada por rede. A interface oficial pode mudar.</p>
          </div>

          {selectedOptions.length ? <>
            <div className="app-scrollbar flex max-w-full gap-1 overflow-x-auto border-b border-slate-200 px-3 pt-2">
              {selectedOptions.map(option => <button key={option.id} onClick={() => setActiveId(option.id)} className={`flex min-w-12 shrink-0 items-center justify-center border-b-2 px-3 py-2 ${activeId === option.id ? "border-indigo-600" : "border-transparent"}`}><PlatformIcon platform={option.platform} small/></button>)}
            </div>
            {activeOption && <div className="bg-slate-50 p-3 sm:p-4">
              <div className={`relative mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm ${activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "bg-slate-950 text-white" : "bg-white"}`}>
                <div className="flex items-center gap-2 px-3 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-[10px] font-black text-indigo-700">{tenant.activeBrand.initials}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-xs font-bold ${activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "text-white" : "text-slate-900"}`}>{activeOption.handle}</p>
                    <p className={`text-[11px] ${activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "text-white/70" : "text-slate-400"}`}>{platformLabels[activeOption.platform]}</p>
                  </div>
                  <MoreHorizontal size={17} className={activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "text-white/70" : "text-slate-400"}/>
                </div>
                <div className={`relative bg-gradient-to-br from-indigo-50 via-slate-100 to-violet-100 ${activeOption.platform === "youtube" ? "aspect-video" : "aspect-[4/5]"}`}>
                  {previewUrl && (fileType === "video" ? <video src={previewUrl} className="h-full w-full object-cover" muted playsInline/> : <img src={previewUrl} alt="" className="h-full w-full object-cover"/>)}
                  {!previewUrl && <div className="grid h-full place-items-center text-slate-400"><Play size={30}/></div>}
                  {(activeOption.platform === "tiktok" || activeOption.platform === "kwai") && <PreviewChrome platform={activeOption.platform}/>}
                </div>
                <div className="p-3">
                  {activeOption.platform === "youtube" && titles[activeOption.id] && <p className="mb-1 text-base font-black text-slate-950">{titles[activeOption.id]}</p>}
                  <p className={`whitespace-pre-line text-sm leading-5 ${activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "text-white" : "text-slate-700"}`}>{effectiveText(activeOption) || "Sua descrição aparecerá aqui."}</p>
                </div>
                {activeOption.platform !== "tiktok" && activeOption.platform !== "kwai" && <PreviewChrome platform={activeOption.platform}/>}
              </div>
            </div>}
          </> : <div className="p-6 text-center text-sm text-slate-500">Selecione ao menos um destino para ver a prévia.</div>}
        </section>

        <section className="card p-4">
          <div className="flex items-center justify-between text-sm sm:text-xs">
            <span className="text-slate-500">Destinos</span><strong className="text-slate-900">{selectedOptions.length}</strong>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm sm:text-xs">
            <span className="text-slate-500">Envio</span><strong className="text-slate-900">{mode === "now" ? "Agora" : "Agendado"}</strong>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm sm:text-xs">
            <span className="text-slate-500">Arquivo após publicar</span><strong className="text-right text-slate-900">{retention === "delete" ? "Excluir" : "Biblioteca"}</strong>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <button disabled={saving || !base.trim()} onClick={() => void persist("draft")} className="btn-secondary w-full disabled:opacity-50">Salvar rascunho</button>
            <button disabled={saving || !canSubmit} onClick={() => void persist(mode === "now" ? "publish_now" : "schedule")} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40">{mode === "now" ? <Send size={16}/> : <Clock3 size={16}/>} {saving ? "Salvando..." : mode === "now" ? "Publicar agora" : "Agendar publicação"}</button>
          </div>
          {saveMessage && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold leading-5 text-emerald-700 sm:text-xs">{saveMessage}</p>}
          {saveError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold leading-5 text-red-700 sm:text-xs">{saveError}</p>}
          {tenant.source === "supabase" && <p className="mt-3 text-xs leading-5 text-slate-500">Nesta fase, o Tela já persiste rascunho e destinos de forma atômica. Publicação externa e scheduler continuam desativados até a próxima integração.</p>}
        </section>
      </aside>
    </div>
  </div>;
}
