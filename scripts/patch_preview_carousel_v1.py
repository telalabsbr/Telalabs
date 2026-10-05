from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"trecho não encontrado em {path}: {label}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_all(path: str, old: str, new: str, label: str):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"trecho não encontrado em {path}: {label}")
    p.write_text(text.replace(old, new), encoding="utf-8")


# ---------------------------------------------------------------------------
# Text overlay: rainbow backgrounds + intuitive beginning/end timing semantics.
# ---------------------------------------------------------------------------
replace_once(
    "src/lib/media/text-overlay.ts",
    'export type OverlayBackground = "none" | "dark" | "light" | "blue";',
    'export type OverlayBackground = "none" | "dark" | "light" | "blue" | "red" | "orange" | "yellow" | "green" | "indigo" | "violet";',
    "background union",
)

replace_once(
    "src/lib/media/text-overlay.ts",
    '''  const rawEnd = config.endMs == null ? duration || null : config.endMs;
  const endMs = rawEnd == null
    ? null
    : clamp(rawEnd, Math.min(startMs + 100, duration || rawEnd), duration || rawEnd);''',
    '''  const rawEnd = config.endMs == null ? duration || null : config.endMs;
  const endMs = rawEnd == null
    ? null
    : clamp(rawEnd, startMs, duration || rawEnd);''',
    "normalize timing",
)

replace_once(
    "src/lib/media/text-overlay.ts",
    '''export function overlayVisibleAt(config: TextOverlayConfig, currentMs: number, durationMs?: number | null) {
  if (config.timingMode !== "range") return true;
  const normalized = normalizeTextOverlay(config, durationMs);
  const end = normalized.endMs ?? durationMs ?? Number.MAX_SAFE_INTEGER;
  return currentMs >= normalized.startMs && currentMs <= end;
}''',
    '''export function overlayVisibleAt(config: TextOverlayConfig, currentMs: number, durationMs?: number | null) {
  if (config.timingMode !== "range") return true;
  const normalized = normalizeTextOverlay(config, durationMs);
  const end = normalized.endMs ?? durationMs ?? Number.MAX_SAFE_INTEGER;
  // No modo por trecho, as duas alças representam quanto do começo e quanto do
  // final exibem o texto. O espaço central entre elas é a área sem texto.
  return currentMs <= normalized.startMs || currentMs >= end;
}''',
    "preview timing semantics",
)

replace_once(
    "src/lib/media/text-overlay.ts",
    '''    const fills: Record<Exclude<OverlayBackground, "none">, string> = {
      dark: "rgba(0,0,0,0.68)",
      light: "rgba(255,255,255,0.88)",
      blue: "rgba(37,99,235,0.90)",
    };''',
    '''    const fills: Record<Exclude<OverlayBackground, "none">, string> = {
      dark: "rgba(0,0,0,0.68)",
      light: "rgba(255,255,255,0.88)",
      blue: "rgba(37,99,235,0.90)",
      red: "rgba(220,38,38,0.90)",
      orange: "rgba(234,88,12,0.90)",
      yellow: "rgba(234,179,8,0.90)",
      green: "rgba(22,163,74,0.90)",
      indigo: "rgba(79,70,229,0.90)",
      violet: "rgba(124,58,237,0.90)",
    };''',
    "canvas background fills",
)

replace_once(
    "src/lib/media/text-overlay.ts",
    '''    const timing = normalized.timingMode === "range"
      ? `:enable='between(t,${(normalized.startMs / 1000).toFixed(3)},${((normalized.endMs ?? normalized.startMs + 100) / 1000).toFixed(3)})'`
      : "";''',
    '''    const timing = normalized.timingMode === "range"
      ? `:enable='lte(t,${(normalized.startMs / 1000).toFixed(3)})+gte(t,${((normalized.endMs ?? normalized.startMs) / 1000).toFixed(3)})'`
      : "";''',
    "ffmpeg timing semantics",
)

# ---------------------------------------------------------------------------
# Overlay controls: background palette, read-only preview layer, shared emojis,
# and a dual-ended beginning/end timing track.
# ---------------------------------------------------------------------------
replace_once(
    "src/components/text-overlay-controls.tsx",
    '''function backgroundCss(background: OverlayBackground) {
  if (background === "dark") return "rgba(0,0,0,0.68)";
  if (background === "light") return "rgba(255,255,255,0.88)";
  if (background === "blue") return "rgba(37,99,235,0.90)";
  return "transparent";
}''',
    '''function backgroundCss(background: OverlayBackground) {
  if (background === "dark") return "rgba(0,0,0,0.68)";
  if (background === "light") return "rgba(255,255,255,0.88)";
  if (background === "blue") return "rgba(37,99,235,0.90)";
  if (background === "red") return "rgba(220,38,38,0.90)";
  if (background === "orange") return "rgba(234,88,12,0.90)";
  if (background === "yellow") return "rgba(234,179,8,0.90)";
  if (background === "green") return "rgba(22,163,74,0.90)";
  if (background === "indigo") return "rgba(79,70,229,0.90)";
  if (background === "violet") return "rgba(124,58,237,0.90)";
  return "transparent";
}''',
    "css background fills",
)

replace_once(
    "src/components/text-overlay-controls.tsx",
    '''export function TextOverlayLayer({
  config,
  onChange,
  visible = true,
}: {
  config: TextOverlayConfig;
  onChange: (config: TextOverlayConfig) => void;
  visible?: boolean;
}) {''',
    '''export function TextOverlayLayer({
  config,
  onChange,
  visible = true,
  interactive = true,
}: {
  config: TextOverlayConfig;
  onChange: (config: TextOverlayConfig) => void;
  visible?: boolean;
  interactive?: boolean;
}) {''',
    "interactive preview prop",
)

replace_once(
    "src/components/text-overlay-controls.tsx",
    '''  if (!visible || !config.text.trim()) return null;

  function stageRect(target: HTMLElement) {''',
    '''  if (!visible || !config.text.trim()) return null;

  if (!interactive) {
    return <div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none"
      style={{ left: `${config.x * 100}%`, top: `${config.y * 100}%`, width: `${config.boxWidth * 100}%`, zIndex: 4 }}
    >
      <div
        className="whitespace-pre-wrap break-words rounded-lg px-2.5 py-1.5 text-center font-bold leading-tight shadow-sm"
        style={{
          color: config.color,
          background: backgroundCss(config.background),
          fontFamily: overlayFontFamilies[config.font],
          fontSize: `${Math.max(14, config.size * 260)}px`,
          textShadow: config.background === "none" ? "0 2px 8px rgba(0,0,0,.8)" : "none",
        }}
      >
        {config.text}
      </div>
    </div>;
  }

  function stageRect(target: HTMLElement) {''',
    "readonly overlay rendering",
)

# Shared emoji picker used both by media text and publication descriptions.
insert_anchor = 'export function TextOverlayLayer({' 
emoji_component = '''export function InlineEmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [moreEmojis, setMoreEmojis] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
      setRecent(Array.isArray(stored) ? stored.slice(0, 8) : []);
    } catch {
      setRecent([]);
    }
  }, []);

  const quick = useMemo(() => Array.from(new Set([...recent, ...QUICK_EMOJIS])).slice(0, 8), [recent]);

  function appendEmoji(emoji: string) {
    onChange(`${value}${value && !/\\s$/.test(value) ? " " : ""}${emoji}`);
    const next = [emoji, ...recent.filter(item => item !== emoji)].slice(0, 8);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  return <div>
    <div className="flex flex-wrap items-center gap-1.5">
      {quick.map(emoji => <button type="button" key={emoji} onClick={() => appendEmoji(emoji)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-lg active:scale-95">{emoji}</button>)}
      <button type="button" onClick={() => setMoreEmojis(current => !current)} className={`flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-black ${moreEmojis ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}><SmilePlus size={16}/> +</button>
    </div>
    {moreEmojis && <div className="mt-2 grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-10">
      {EMOJI_LIBRARY.map(emoji => <button type="button" key={emoji} onClick={() => appendEmoji(emoji)} className="grid h-9 w-9 place-items-center rounded-lg text-lg hover:bg-slate-100">{emoji}</button>)}
    </div>}
  </div>;
}

'''
replace_once(
    "src/components/text-overlay-controls.tsx",
    insert_anchor,
    emoji_component + insert_anchor,
    "shared emoji picker",
)

# Timing control: left handle grows beginning; right handle grows ending; center is off.
old_timing = '''  const start = clamp(config.startMs, 0, duration || 0);
  const end = clamp(config.endMs ?? duration, Math.min(duration, start + 250), duration || 0);

  function setMode(mode: "all" | "range") {
    if (mode === "all") {
      onChange({ ...config, timingMode: "all", startMs: 0, endMs: null });
      return;
    }
    const initialEnd = duration ? Math.min(duration, Math.max(3000, duration * 0.4)) : 3000;
    onChange({ ...config, timingMode: "range", startMs: 0, endMs: initialEnd });
  }

  function updateFromPointer(clientX: number, handle: "start" | "end") {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    const value = clamp(((clientX - rect.left) / Math.max(1, rect.width)) * duration, 0, duration);
    if (handle === "start") {
      onChange({ ...config, timingMode: "range", startMs: Math.min(value, end - 250), endMs: end });
    } else {
      onChange({ ...config, timingMode: "range", startMs: start, endMs: Math.max(value, start + 250) });
    }
  }'''
new_timing = '''  const start = clamp(config.startMs, 0, duration || 0);
  const end = clamp(config.endMs ?? duration, start, duration || 0);

  function setMode(mode: "all" | "range") {
    if (mode === "all") {
      onChange({ ...config, timingMode: "all", startMs: 0, endMs: null });
      return;
    }
    const edge = Math.min(3000, duration / 2);
    onChange({ ...config, timingMode: "range", startMs: edge, endMs: Math.max(edge, duration - edge) });
  }

  function updateFromPointer(clientX: number, handle: "start" | "end") {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    const value = clamp(((clientX - rect.left) / Math.max(1, rect.width)) * duration, 0, duration);
    if (handle === "start") {
      onChange({ ...config, timingMode: "range", startMs: Math.min(value, end), endMs: end });
    } else {
      onChange({ ...config, timingMode: "range", startMs: start, endMs: Math.max(value, start) });
    }
  }'''
replace_once("src/components/text-overlay-controls.tsx", old_timing, new_timing, "timing logic")

old_track = '''        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200"/>
        <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-blue-500" style={{ left: `${(start / duration) * 100}%`, right: `${100 - (end / duration) * 100}%` }}/>
        {(["start", "end"] as const).map(handle => {'''
new_track = '''        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200"/>
        <div className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-l-full bg-blue-500" style={{ width: `${(start / duration) * 100}%` }}/>
        <div className="absolute right-0 top-1/2 h-2 -translate-y-1/2 rounded-r-full bg-blue-500" style={{ width: `${((duration - end) / duration) * 100}%` }}/>
        {(["start", "end"] as const).map(handle => {'''
replace_once("src/components/text-overlay-controls.tsx", old_track, new_track, "timing track")

replace_once(
    "src/components/text-overlay-controls.tsx",
    '''      <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-slate-600">
        <span>Início: {formatTime(start)}</span>
        <span>Fim: {formatTime(end)}</span>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">Arraste as duas bolinhas para escolher quando o texto aparece e desaparece.</p>''',
    '''      <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-slate-600">
        <span>No início: {formatTime(start)}</span>
        <span>No fim: {formatTime(duration - end)}</span>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">A área azul mostra onde o texto aparece. Arraste a bolinha da esquerda para a direita para aumentar o tempo no início e a da direita para a esquerda para aumentar o tempo no fim. Se as duas se encontrarem, o texto cobre o vídeo inteiro.</p>''',
    "timing instructions",
)

# Remove local emoji state/logic from TextOverlayControls and reuse shared picker.
replace_once(
    "src/components/text-overlay-controls.tsx",
    '''  const [moreEmojis, setMoreEmojis] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [hasSavedStyle, setHasSavedStyle] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
      setRecent(Array.isArray(stored) ? stored.slice(0, 8) : []);
      setHasSavedStyle(!!localStorage.getItem(STYLE_KEY));
    } catch {
      setRecent([]);
    }
  }, []);

  const quick = useMemo(() => Array.from(new Set([...recent, ...QUICK_EMOJIS])).slice(0, 8), [recent]);''',
    '''  const [hasSavedStyle, setHasSavedStyle] = useState(false);

  useEffect(() => {
    try { setHasSavedStyle(!!localStorage.getItem(STYLE_KEY)); } catch { setHasSavedStyle(false); }
  }, []);''',
    "overlay emoji state",
)
replace_once(
    "src/components/text-overlay-controls.tsx",
    '''  function appendEmoji(emoji: string) {
    patch({ text: `${config.text}${config.text ? " " : ""}${emoji}` });
    const next = [emoji, ...recent.filter(item => item !== emoji)].slice(0, 8);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

''',
    "",
    "overlay append emoji",
)
replace_once(
    "src/components/text-overlay-controls.tsx",
    '''    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {quick.map(emoji => <button type="button" key={emoji} onClick={() => appendEmoji(emoji)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-lg active:scale-95">{emoji}</button>)}
        <button type="button" onClick={() => setMoreEmojis(current => !current)} className={`flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-black ${moreEmojis ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}><SmilePlus size={16}/> +</button>
      </div>
      {moreEmojis && <div className="mt-2 grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-10">
        {EMOJI_LIBRARY.map(emoji => <button type="button" key={emoji} onClick={() => appendEmoji(emoji)} className="grid h-9 w-9 place-items-center rounded-lg text-lg hover:bg-slate-100">{emoji}</button>)}
      </div>}
    </div>''',
    '''    <InlineEmojiPicker value={config.text} onChange={text => patch({ text })}/>''',
    "overlay shared picker",
)
replace_once(
    "src/components/text-overlay-controls.tsx",
    '''          <option value="blue">Azul</option>
        </select>''',
    '''          <option value="blue">Azul</option>
          <option value="red">Vermelho</option>
          <option value="orange">Laranja</option>
          <option value="yellow">Amarelo</option>
          <option value="green">Verde</option>
          <option value="indigo">Anil</option>
          <option value="violet">Violeta</option>
        </select>''',
    "rainbow select",
)

# ---------------------------------------------------------------------------
# Final publication media preview component (edited image/video/carousel).
# ---------------------------------------------------------------------------
Path("src/components/publication-media-preview.tsx").write_text('''"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { overlayVisibleAt, type TextOverlayConfig } from "@/lib/media/text-overlay";
import { TextOverlayLayer } from "./text-overlay-controls";

export type CarouselPreviewItem = { id: string; previewUrl: string };

export function PublicationMediaPreview({
  previewUrl,
  fileType,
  textConfig,
  durationMs,
  posterUrl,
  carouselItems = [],
}: {
  previewUrl: string | null;
  fileType: "image" | "video" | null;
  textConfig: TextOverlayConfig;
  durationMs?: number | null;
  posterUrl?: string | null;
  carouselItems?: CarouselPreviewItem[];
}) {
  const [currentMs, setCurrentMs] = useState(0);
  const [index, setIndex] = useState(0);
  const isCarousel = carouselItems.length > 1;
  const safeIndex = Math.min(index, Math.max(0, carouselItems.length - 1));
  const activeUrl = isCarousel ? carouselItems[safeIndex]?.previewUrl ?? previewUrl : previewUrl;
  const visible = fileType !== "video" || overlayVisibleAt(textConfig, currentMs, durationMs);

  useEffect(() => {
    if (index >= carouselItems.length && carouselItems.length) setIndex(carouselItems.length - 1);
  }, [carouselItems.length, index]);

  const dots = useMemo(() => carouselItems.map(item => item.id), [carouselItems]);

  return <div data-overlay-stage className="relative h-full w-full overflow-hidden">
    {activeUrl && (fileType === "video" && !isCarousel
      ? <video
          src={activeUrl}
          poster={posterUrl || undefined}
          className="h-full w-full object-cover"
          controls
          playsInline
          preload="metadata"
          onTimeUpdate={event => setCurrentMs(event.currentTarget.currentTime * 1000)}
          onSeeked={event => setCurrentMs(event.currentTarget.currentTime * 1000)}
        />
      : <img src={activeUrl} alt="Prévia final da mídia" className="h-full w-full object-cover"/>)}

    {activeUrl && <TextOverlayLayer config={textConfig} onChange={() => {}} visible={visible} interactive={false}/>} 

    {isCarousel && <>
      <button type="button" aria-label="Imagem anterior" onClick={() => setIndex(current => (current - 1 + carouselItems.length) % carouselItems.length)} className="absolute left-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-slate-950/65 text-white shadow"><ChevronLeft size={17}/></button>
      <button type="button" aria-label="Próxima imagem" onClick={() => setIndex(current => (current + 1) % carouselItems.length)} className="absolute right-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-slate-950/65 text-white shadow"><ChevronRight size={17}/></button>
      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-full bg-slate-950/50 px-2 py-1">
        {dots.map((id, dotIndex) => <button key={id} type="button" aria-label={`Ver imagem ${dotIndex + 1}`} onClick={() => setIndex(dotIndex)} className={`h-1.5 w-1.5 rounded-full ${dotIndex === safeIndex ? "bg-white" : "bg-white/45"}`}/>) }
      </div>
      <span className="absolute right-2 top-2 z-10 rounded-full bg-slate-950/65 px-2 py-1 text-[10px] font-black text-white">{safeIndex + 1}/{carouselItems.length}</span>
    </>}
  </div>;
}
''', encoding="utf-8")

# ---------------------------------------------------------------------------
# Runtime context supports ordered media arrays for carousels.
# ---------------------------------------------------------------------------
replace_once(
    "src/integrations/social/runtime-context.ts",
    '''  media: RuntimeMedia | null;
  cover_media: RuntimeMedia | null;''',
    '''  media: RuntimeMedia | null;
  media_items: RuntimeMedia[];
  cover_media: RuntimeMedia | null;''',
    "runtime media items",
)

# ---------------------------------------------------------------------------
# Instagram carousel publishing (2-10 JPEG images).
# ---------------------------------------------------------------------------
replace_once(
    "src/integrations/social/instagram-adapter.ts",
    '  mediaType: "IMAGE" | "REELS" | "STORIES";',
    '  mediaType: "IMAGE" | "REELS" | "STORIES" | "CAROUSEL";',
    "instagram carousel container type",
)

replace_once(
    "src/integrations/social/instagram-adapter.ts",
    '''    if (!context.media) {
      return invalidContent("Adicione uma imagem ou vídeo antes de publicar no Instagram.", "INSTAGRAM_MEDIA_REQUIRED");
    }

    const preflight = preflightMedia(context.media);
    if (preflight) return preflight;

    const isVideo = context.media.mime_type.startsWith("video/");
    const isStory = surfaceFromConfig(context.target.provider_config) === "story";
    let container = await existingContainer(job.postTargetId);''',
    '''    if (!context.media) {
      return invalidContent("Adicione uma imagem ou vídeo antes de publicar no Instagram.", "INSTAGRAM_MEDIA_REQUIRED");
    }

    const isStory = surfaceFromConfig(context.target.provider_config) === "story";
    const carouselItems = context.media_items ?? [];
    const isCarousel = !isStory && context.target.content_intent === "CAROUSEL" && carouselItems.length > 1;

    if (isCarousel) {
      if (carouselItems.length < 2 || carouselItems.length > 10) {
        return invalidContent("O carrossel do Instagram precisa ter entre 2 e 10 imagens.", "INSTAGRAM_CAROUSEL_COUNT");
      }
      for (const item of carouselItems) {
        if (item.mime_type !== "image/jpeg" || item.processing_status !== "READY" || !item.object_key) {
          return invalidContent("Neste momento, o carrossel do Instagram aceita imagens JPEG prontas.", "INSTAGRAM_CAROUSEL_MEDIA");
        }
      }
    } else {
      const preflight = preflightMedia(context.media);
      if (preflight) return preflight;
    }

    const isVideo = context.media.mime_type.startsWith("video/");
    let container = await existingContainer(job.postTargetId);''',
    "instagram carousel preflight",
)

replace_once(
    "src/integrations/social/instagram-adapter.ts",
    '''      const createParams: Record<string, string | boolean> = isStory
        ? isVideo
          ? { media_type: "STORIES", video_url: deliveryUrl }
          : { media_type: "STORIES", image_url: deliveryUrl }
        : isVideo
          ? {
              media_type: "REELS",
              video_url: deliveryUrl,
              caption: context.target.caption,
              share_to_feed: true,
              ...(coverUrl ? { cover_url: coverUrl } : {}),
            }
          : {
              image_url: deliveryUrl,
              caption: context.target.caption,
            };

      const create = await metaGraphRequest<ContainerCreated>({''',
    '''      let createParams: Record<string, string | boolean>;
      if (isCarousel) {
        const childIds: string[] = [];
        for (const item of carouselItems) {
          const itemUrl = await issueAttachedMediaDeliveryUrl(context, item);
          const child = await metaGraphRequest<ContainerCreated>({
            path: `/${encodeURIComponent(context.connection.provider_account_id)}/media`,
            method: "POST",
            accessToken,
            params: { image_url: itemUrl, is_carousel_item: true },
          });
          if (!child.ok || !child.data?.id) return classifyMetaFailure(child);
          childIds.push(child.data.id);
        }
        createParams = {
          media_type: "CAROUSEL",
          children: childIds.join(","),
          caption: context.target.caption,
        };
      } else {
        createParams = isStory
          ? isVideo
            ? { media_type: "STORIES", video_url: deliveryUrl }
            : { media_type: "STORIES", image_url: deliveryUrl }
          : isVideo
            ? {
                media_type: "REELS",
                video_url: deliveryUrl,
                caption: context.target.caption,
                share_to_feed: true,
                ...(coverUrl ? { cover_url: coverUrl } : {}),
              }
            : {
                image_url: deliveryUrl,
                caption: context.target.caption,
              };
      }

      const create = await metaGraphRequest<ContainerCreated>({''',
    "instagram carousel children",
)

replace_once(
    "src/integrations/social/instagram-adapter.ts",
    '          mediaType: isStory ? "STORIES" : isVideo ? "REELS" : "IMAGE",',
    '          mediaType: isCarousel ? "CAROUSEL" : isStory ? "STORIES" : isVideo ? "REELS" : "IMAGE",',
    "instagram remember carousel",
)

# ---------------------------------------------------------------------------
# Facebook photo carousel publishing.
# ---------------------------------------------------------------------------
replace_once(
    "src/integrations/social/facebook-adapter.ts",
    '''  accessTokenFromContext,
  issueMediaDeliveryUrl,
  loadRuntimePublicationContext,''',
    '''  accessTokenFromContext,
  issueAttachedMediaDeliveryUrl,
  issueMediaDeliveryUrl,
  loadRuntimePublicationContext,''',
    "facebook attached delivery import",
)
replace_once(
    "src/integrations/social/facebook-adapter.ts",
    'type FacebookPhotoCreated = { id?: string; post_id?: string };',
    'type FacebookPhotoCreated = { id?: string; post_id?: string };\ntype FacebookFeedCreated = { id?: string };',
    "facebook feed type",
)

facebook_carousel_function = '''
async function publishCarousel(job: PublicationWorkerJob, accessToken: string) {
  const context = await loadRuntimePublicationContext(job.postTargetId);
  const items = context.media_items ?? [];
  if (items.length < 2 || items.length > 10) {
    return invalidContent("O carrossel do Facebook precisa ter entre 2 e 10 imagens.", "FACEBOOK_CAROUSEL_COUNT");
  }

  const childIds: string[] = [];
  for (const item of items) {
    if (!item.mime_type.startsWith("image/") || item.processing_status !== "READY" || !item.object_key) {
      return invalidContent("O carrossel do Facebook precisa usar imagens prontas.", "FACEBOOK_CAROUSEL_MEDIA");
    }
    const deliveryUrl = await issueAttachedMediaDeliveryUrl(context, item);
    const child = await metaGraphRequest<FacebookPhotoCreated>({
      baseUrl: getMetaGraphBaseUrl(),
      path: `/${encodeURIComponent(context.connection.provider_account_id)}/photos`,
      method: "POST",
      accessToken,
      params: { url: deliveryUrl, published: false },
    });
    if (!child.ok || !child.data?.id) return classifyMetaFailure(child);
    childIds.push(child.data.id);
  }

  const params: Record<string, string | boolean> = { message: context.target.caption };
  childIds.forEach((id, index) => {
    params[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id });
  });

  const create = await metaGraphRequest<FacebookFeedCreated>({
    baseUrl: getMetaGraphBaseUrl(),
    path: `/${encodeURIComponent(context.connection.provider_account_id)}/feed`,
    method: "POST",
    accessToken,
    params,
  });
  if (!create.ok || !create.data?.id) return classifyMetaFailure(create);

  const details = await facebookObject(create.data.id, accessToken);
  const permalink = details.ok ? details.data?.permalink_url ?? null : null;

  try {
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
    const saved = await admin.from("provider_assets").upsert({
      organization_id: job.organizationId,
      post_target_id: job.postTargetId,
      provider: "facebook",
      provider_asset_id: create.data.id,
      kind: "CAROUSEL",
      state: "PUBLISHED",
      metadata: { child_photo_ids: childIds, permalink, published_at: new Date().toISOString() },
    }, { onConflict: "provider,provider_asset_id" });
    if (saved.error) throw new Error(saved.error.message);
    await revokeMediaDeliveryUrls(job.postTargetId);
  } catch {
    return {
      outcome: "UNKNOWN" as const,
      providerRequestId: create.data.id,
      errorCode: "FACEBOOK_CAROUSEL_PERSIST_UNKNOWN",
      errorMessageSafe: "O Facebook recebeu o carrossel, mas o Tela Social ainda precisa confirmar o registro local.",
    };
  }

  return { outcome: "SUCCEEDED" as const, providerRequestId: create.data.id, publicUrl: permalink };
}

'''
replace_once(
    "src/integrations/social/facebook-adapter.ts",
    'async function publishReel(job: PublicationWorkerJob, accessToken: string) {',
    facebook_carousel_function + 'async function publishReel(job: PublicationWorkerJob, accessToken: string) {',
    "facebook carousel publisher",
)

replace_once(
    "src/integrations/social/facebook-adapter.ts",
    '''    const preflight = preflightMedia(context.media);
    if (preflight) return preflight;

    const published = await existingPublishedAsset(job.postTargetId);''',
    '''    const isCarousel = context.target.content_intent === "CAROUSEL" && (context.media_items?.length ?? 0) > 1;
    if (!isCarousel) {
      const preflight = preflightMedia(context.media);
      if (preflight) return preflight;
    }

    const published = await existingPublishedAsset(job.postTargetId);''',
    "facebook carousel preflight",
)
replace_once(
    "src/integrations/social/facebook-adapter.ts",
    '''    if (context.media.mime_type.startsWith("video/")) return publishReel(job, accessToken);
    return publishPhoto(job, accessToken);''',
    '''    if (isCarousel) return publishCarousel(job, accessToken);
    if (context.media.mime_type.startsWith("video/")) return publishReel(job, accessToken);
    return publishPhoto(job, accessToken);''',
    "facebook carousel branch",
)

# ---------------------------------------------------------------------------
# Browser DB RPC typing.
# ---------------------------------------------------------------------------
replace_once(
    "src/lib/supabase/database.app-types.ts",
    '''      attach_cover_to_post: {
        Args: { p_media_asset_id: string; p_post_id: string };
        Returns: number;
      };''',
    '''      attach_cover_to_post: {
        Args: { p_media_asset_id: string; p_post_id: string };
        Returns: number;
      };
      attach_media_items_to_post: {
        Args: { p_media_asset_ids: string[]; p_post_id: string };
        Returns: number;
      };''',
    "carousel rpc app type",
)

# ---------------------------------------------------------------------------
# Composer UI/state/persistence.
# ---------------------------------------------------------------------------
replace_once(
    "src/components/publication-editor.tsx",
    '''import { VideoCoverEditor, type CoverSelection } from "./video-cover-editor";
import { MediaTextEditor } from "./media-text-editor";''',
    '''import { VideoCoverEditor, type CoverSelection } from "./video-cover-editor";
import { MediaTextEditor } from "./media-text-editor";
import { CollapsibleEditorShell, InlineEmojiPicker } from "./text-overlay-controls";
import { PublicationMediaPreview } from "./publication-media-preview";''',
    "composer imports",
)

replace_once(
    "src/components/publication-editor.tsx",
    '''interface PublishAttemptResult {
  postTargetId?: string;
  provider: string;
  contentIntent?: string;
  surface?: string | null;
  outcome: string;
  errorMessage?: string | null;
  publicUrl?: string | null;
}
''',
    '''interface PublishAttemptResult {
  postTargetId?: string;
  provider: string;
  contentIntent?: string;
  surface?: string | null;
  outcome: string;
  errorMessage?: string | null;
  publicUrl?: string | null;
}

interface CarouselItem {
  id: string;
  file: File;
  previewUrl: string;
  metadata: PreparedMediaMetadata;
}
''',
    "carousel interface",
)

replace_once(
    "src/components/publication-editor.tsx",
    '''  const [feedTextConfig, setFeedTextConfig] = useState<TextOverlayConfig>({ ...defaultTextOverlay });
  const [storyTextConfig, setStoryTextConfig] = useState<TextOverlayConfig>({ ...defaultTextOverlay });
  const [stagedStoryMedia, setStagedStoryMedia] = useState<{ key: string; mediaId: string } | null>(null);''',
    '''  const [feedTextConfig, setFeedTextConfig] = useState<TextOverlayConfig>({ ...defaultTextOverlay });
  const [storyTextConfig, setStoryTextConfig] = useState<TextOverlayConfig>({ ...defaultTextOverlay });
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([]);
  const [stagedCarouselMedia, setStagedCarouselMedia] = useState<Record<string, { key: string; mediaId: string }>>({});
  const carouselUrlsRef = useRef<Set<string>>(new Set());
  const [stagedStoryMedia, setStagedStoryMedia] = useState<{ key: string; mediaId: string } | null>(null);''',
    "carousel states",
)

replace_once(
    "src/components/publication-editor.tsx",
    '''  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);''',
    '''  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => () => {
    for (const url of carouselUrlsRef.current) URL.revokeObjectURL(url);
    carouselUrlsRef.current.clear();
  }, []);''',
    "carousel url cleanup",
)

replace_once(
    "src/components/publication-editor.tsx",
    '''  const hasInstagram = selectedOptions.some(option => option.platform === "instagram");
  const requiresDescription = selectedOptions.some(option => !(option.platform === "instagram" && instagramPlacement === "story"));''',
    '''  const hasInstagram = selectedOptions.some(option => option.platform === "instagram");
  const isCarousel = carouselItems.length > 1;
  const carouselPreviewItems = carouselItems.map(item => ({ id: item.id, previewUrl: item.previewUrl }));
  const requiresDescription = selectedOptions.some(option => !(option.platform === "instagram" && instagramPlacement === "story"));''',
    "carousel derived state",
)

# Clear carousel when selecting a single file.
replace_once(
    "src/components/publication-editor.tsx",
    '''    setStagedCover(null);
    setStagedStoryMedia(null);
    setFeedTextConfig({ ...defaultTextOverlay });''',
    '''    setStagedCover(null);
    setStagedStoryMedia(null);
    setStagedCarouselMedia({});
    for (const url of carouselUrlsRef.current) URL.revokeObjectURL(url);
    carouselUrlsRef.current.clear();
    setCarouselItems([]);
    setFeedTextConfig({ ...defaultTextOverlay });''',
    "clear carousel on single file",
)

# Insert carousel handlers before removeFile.
carousel_handlers = '''
  async function handleCarouselFiles(files?: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files).slice(0, 10);
    if (incoming.length < 2) {
      await handleFile(incoming[0]);
      return;
    }

    setSaveError("");
    setSaveMessage("Preparando imagens do carrossel...");
    setPublishComplete(false);
    setPublishResults([]);
    setPublishedUrl(null);
    setStagedMedia(null);
    setStagedCarouselMedia({});
    setStagedCover(null);
    setStagedStoryMedia(null);
    setFeedTextConfig({ ...defaultTextOverlay });
    setStoryTextConfig({ ...defaultTextOverlay });
    setInstagramPlacement("feed");

    try {
      const prepared = await Promise.all(incoming.map(file => prepareMediaFile(file)));
      if (prepared.some(item => item.kind !== "image")) {
        throw new Error("carousel_images_only");
      }

      for (const url of carouselUrlsRef.current) URL.revokeObjectURL(url);
      carouselUrlsRef.current.clear();
      const nextItems = prepared.map((item, index) => {
        const itemUrl = URL.createObjectURL(item.file);
        carouselUrlsRef.current.add(itemUrl);
        return { id: `${item.file.name}-${item.file.lastModified}-${index}`, file: item.file, previewUrl: itemUrl, metadata: item.metadata } satisfies CarouselItem;
      });

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const primaryPreview = URL.createObjectURL(nextItems[0].file);
      setPreviewUrl(primaryPreview);
      setSelectedFile(nextItems[0].file);
      setFileName(`${nextItems.length} imagens no carrossel`);
      setFileType("image");
      setFileSize(nextItems.reduce((sum, item) => sum + item.file.size, 0));
      setMediaMetadata(nextItems[0].metadata);
      setCarouselItems(nextItems);
      setMediaNotice(prepared.some(item => item.notice) ? "Algumas imagens foram adaptadas automaticamente para JPEG." : "");
      setUploadProgress(null);
      setSaveMessage(`Carrossel com ${nextItems.length} imagens pronto.`);
    } catch (error) {
      const code = error instanceof Error ? error.message : "carousel_failed";
      setSaveError(code === "carousel_images_only"
        ? "O carrossel aceita imagens. Selecione de 2 a 10 fotos."
        : "Não foi possível preparar uma das imagens do carrossel.");
      setSaveMessage("");
    }
  }

  function syncCarouselPrimary(items: CarouselItem[]) {
    if (!items.length) {
      removeFile();
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(items[0].file));
    setSelectedFile(items[0].file);
    setFileType("image");
    setMediaMetadata(items[0].metadata);
    setFileSize(items.reduce((sum, item) => sum + item.file.size, 0));
    setFileName(items.length > 1 ? `${items.length} imagens no carrossel` : items[0].file.name);
    if (items.length === 1) setCarouselItems([]);
  }

  function moveCarouselItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= carouselItems.length) return;
    const next = [...carouselItems];
    [next[index], next[target]] = [next[target], next[index]];
    setCarouselItems(next);
    setStagedCarouselMedia({});
    syncCarouselPrimary(next);
  }

  function removeCarouselItem(index: number) {
    const removed = carouselItems[index];
    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
      carouselUrlsRef.current.delete(removed.previewUrl);
    }
    const next = carouselItems.filter((_, itemIndex) => itemIndex !== index);
    setCarouselItems(next);
    setStagedCarouselMedia({});
    syncCarouselPrimary(next);
  }

'''
replace_once(
    "src/components/publication-editor.tsx",
    '  function removeFile() {',
    carousel_handlers + '  function removeFile() {',
    "carousel handlers",
)

# Clear carousel in removeFile.
replace_once(
    "src/components/publication-editor.tsx",
    '''    setStagedMedia(null);
    setStagedCover(null);
    setStagedStoryMedia(null);''',
    '''    setStagedMedia(null);
    setStagedCover(null);
    setStagedStoryMedia(null);
    setStagedCarouselMedia({});
    for (const url of carouselUrlsRef.current) URL.revokeObjectURL(url);
    carouselUrlsRef.current.clear();
    setCarouselItems([]);''',
    "clear carousel on remove",
)

# Validation for carousel.
replace_once(
    "src/components/publication-editor.tsx",
    '''    if (option.platform === "instagram") {
      if (!fileType && !existingMedia) return { option, level: "error" as const, text: "Adicione uma imagem ou vídeo" };''',
    '''    if (isCarousel && !["instagram", "facebook"].includes(option.platform)) {
      return { option, level: "error" as const, text: "Carrossel disponível no Instagram e Facebook nesta etapa" };
    }
    if (isCarousel && option.platform === "instagram" && instagramPlacement !== "feed") {
      return { option, level: "error" as const, text: "Carrossel do Instagram usa Feed / Reels" };
    }

    if (option.platform === "instagram") {
      if (!fileType && !existingMedia) return { option, level: "error" as const, text: "Adicione uma imagem ou vídeo" };''',
    "carousel checks",
)

# Compose all carousel slides with the same optional overlay.
replace_once(
    "src/components/publication-editor.tsx",
    '''    const selectedKind: "image" | "video" = fileType ?? (selectedFile?.type.startsWith("video/") ? "video" : "image");
    let baseMediaFile = selectedFile;
    let storyMediaFile: File | null = null;

    try {
      if (selectedFile && instagramPlacement === "story" && storyTextConfig.text.trim()) {''',
    '''    const selectedKind: "image" | "video" = fileType ?? (selectedFile?.type.startsWith("video/") ? "video" : "image");
    let baseMediaFile = selectedFile;
    let storyMediaFile: File | null = null;
    let carouselMediaFiles: File[] = [];

    try {
      if (isCarousel) {
        setSaveMessage("Preparando imagens do carrossel...");
        carouselMediaFiles = await Promise.all(carouselItems.map(item => composeTextOnMedia(item.file, "image", feedTextConfig)));
        baseMediaFile = null;
      } else if (selectedFile && instagramPlacement === "story" && storyTextConfig.text.trim()) {''',
    "carousel compose",
)

# Upload carousel assets before single media block.
replace_once(
    "src/components/publication-editor.tsx",
    '''    let mediaId: string | null = null;
    if (baseMediaFile) {''',
    '''    let mediaId: string | null = null;
    const carouselMediaIds: string[] = [];
    if (isCarousel && carouselMediaFiles.length) {
      const nextStaged = { ...stagedCarouselMedia };
      for (let index = 0; index < carouselMediaFiles.length; index += 1) {
        const carouselFile = carouselMediaFiles[index];
        const sourceItem = carouselItems[index];
        const mediaKey = [carouselFile.name, carouselFile.size, carouselFile.lastModified, retention].join(":");
        const cached = nextStaged[sourceItem.id];
        if (cached?.key === mediaKey) {
          carouselMediaIds.push(cached.mediaId);
          continue;
        }
        setUploadProgress(Math.round((index / carouselMediaFiles.length) * 100));
        setSaveMessage(`Enviando imagem ${index + 1} de ${carouselMediaFiles.length}...`);
        try {
          const uploaded = await uploadMediaFile({
            file: carouselFile,
            brandId: tenant.activeBrand.id,
            retention,
            metadata: sourceItem.metadata,
          });
          nextStaged[sourceItem.id] = { key: mediaKey, mediaId: uploaded.mediaId };
          carouselMediaIds.push(uploaded.mediaId);
        } catch {
          setSaveError(`Não foi possível enviar a imagem ${index + 1} do carrossel.`);
          setSaveMessage("");
          setUploadProgress(null);
          setSaving(false);
          return;
        }
      }
      setStagedCarouselMedia(nextStaged);
      setUploadProgress(100);
    }

    if (baseMediaFile) {''',
    "carousel upload",
)

replace_once(
    "src/components/publication-editor.tsx",
    '''        content_intent: option.contentIntent ?? "AUTO",''',
    '''        content_intent: isCarousel ? "CAROUSEL" : option.contentIntent ?? "AUTO",''',
    "carousel content intent",
)

replace_once(
    "src/components/publication-editor.tsx",
    '''    if (instagramPlacement === "both" && hasInstagram && postId) {''',
    '''    if (!isCarousel && instagramPlacement === "both" && hasInstagram && postId) {''',
    "no story target for carousel",
)

replace_once(
    "src/components/publication-editor.tsx",
    '''    if (mediaId && postId) {
      const mediaResult = await client.rpc("attach_media_to_post", {
        p_post_id: postId,
        p_media_asset_id: mediaId,
      });

      if (mediaResult.error) {
        setSaveError("A publicação foi salva, mas não conseguimos vincular a mídia. Tente novamente antes de publicar.");
        setSaving(false);
        return;
      }
    }''',
    '''    if (carouselMediaIds.length > 1 && postId) {
      const mediaResult = await client.rpc("attach_media_items_to_post", {
        p_post_id: postId,
        p_media_asset_ids: carouselMediaIds,
      });
      if (mediaResult.error) {
        setSaveError("A publicação foi salva, mas não conseguimos vincular as imagens do carrossel.");
        setSaving(false);
        return;
      }
    } else if (mediaId && postId) {
      const mediaResult = await client.rpc("attach_media_to_post", {
        p_post_id: postId,
        p_media_asset_id: mediaId,
      });

      if (mediaResult.error) {
        setSaveError("A publicação foi salva, mas não conseguimos vincular a mídia. Tente novamente antes de publicar.");
        setSaving(false);
        return;
      }
    }''',
    "attach carousel media",
)

# UI: selected media preview reflects overlay/carousel.
replace_once(
    "src/components/publication-editor.tsx",
    '''              {previewUrl
                ? (fileType === "video" ? <video src={previewUrl} className="h-full w-full object-cover" controls playsInline preload="metadata"/> : <img src={previewUrl} alt="Prévia da mídia" className="h-full w-full object-cover"/> )
                : <div className="grid h-full place-items-center text-center text-slate-400"><div><Play className="mx-auto" size={28}/><p className="mt-2 px-3 text-xs font-bold">Mídia já vinculada</p></div></div>}
              <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/75 px-2 py-1 text-xs font-bold text-white">{fileType === "video" ? "VÍDEO" : "IMAGEM"}</span>''',
    '''              {previewUrl
                ? <PublicationMediaPreview previewUrl={previewUrl} fileType={fileType} textConfig={feedTextConfig} durationMs={mediaMetadata.durationMs} posterUrl={coverSelection.previewUrl} carouselItems={carouselPreviewItems}/>
                : <div className="grid h-full place-items-center text-center text-slate-400"><div><Play className="mx-auto" size={28}/><p className="mt-2 px-3 text-xs font-bold">Mídia já vinculada</p></div></div>}
              <span className="absolute bottom-2 left-2 z-20 rounded-md bg-slate-950/75 px-2 py-1 text-xs font-bold text-white">{isCarousel ? `CARROSSEL · ${carouselItems.length}` : fileType === "video" ? "VÍDEO" : "IMAGEM"}</span>''',
    "main media edited preview",
)

# Selected media actions: include carousel chooser and simple ordering controls.
replace_once(
    "src/components/publication-editor.tsx",
    '''                <label className="btn-secondary cursor-pointer"><UploadCloud size={15}/> Substituir<input type="file" accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,.gif,.mp4,.mov,.webm,.avi,.mkv,.mpeg,.mpg,.m4v,.3gp,.ogv,.mp3,.wav,.m4a,.aac,.ogg,.flac,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp,image/gif,video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,video/mpeg,video/x-m4v,video/3gpp,video/ogg,audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,audio/flac" className="sr-only" onChange={event => handleFile(event.target.files?.[0])}/></label>
                {selectedFile && <button onClick={removeFile} className="btn-secondary !text-red-600"><Trash2 size={15}/> Cancelar substituição</button>}''',
    '''                <label className="btn-secondary cursor-pointer"><UploadCloud size={15}/> Substituir<input type="file" accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,.gif,.mp4,.mov,.webm,.avi,.mkv,.mpeg,.mpg,.m4v,.3gp,.ogv,.mp3,.wav,.m4a,.aac,.ogg,.flac,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp,image/gif,video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,video/mpeg,video/x-m4v,video/3gpp,video/ogg,audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,audio/flac" className="sr-only" onChange={event => handleFile(event.target.files?.[0])}/></label>
                <label className="btn-secondary cursor-pointer"><ImagePlus size={15}/> Carrossel<input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp" className="sr-only" onChange={event => void handleCarouselFiles(event.target.files)}/></label>
                {selectedFile && <button onClick={removeFile} className="btn-secondary !text-red-600"><Trash2 size={15}/> Cancelar substituição</button>}''',
    "selected carousel action",
)

replace_once(
    "src/components/publication-editor.tsx",
    '''              <div className="mt-4 border-t border-slate-200 pt-4">''',
    '''              {isCarousel && <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-black text-slate-700">Ordem do carrossel</p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {carouselItems.map((item, index) => <div key={item.id} className="w-24 shrink-0 rounded-lg border border-slate-200 bg-white p-1.5">
                    <div className="relative aspect-square overflow-hidden rounded-md bg-slate-100"><img src={item.previewUrl} alt={`Imagem ${index + 1}`} className="h-full w-full object-cover"/><span className="absolute left-1 top-1 rounded bg-slate-950/70 px-1.5 py-0.5 text-[9px] font-black text-white">{index + 1}</span></div>
                    <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] font-black">
                      <button type="button" onClick={() => moveCarouselItem(index, -1)} disabled={index === 0} className="rounded bg-slate-100 py-1 disabled:opacity-30">←</button>
                      <button type="button" onClick={() => removeCarouselItem(index)} className="rounded bg-red-50 py-1 text-red-600">×</button>
                      <button type="button" onClick={() => moveCarouselItem(index, 1)} disabled={index === carouselItems.length - 1} className="rounded bg-slate-100 py-1 disabled:opacity-30">→</button>
                    </div>
                  </div>)}
                </div>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">De 2 a 10 imagens. A primeira imagem será a capa visual do carrossel.</p>
              </div>}
              <div className="mt-4 border-t border-slate-200 pt-4">''',
    "carousel ordering ui",
)

# Empty media picker offers a dedicated carousel option.
replace_once(
    "src/components/publication-editor.tsx",
    '''          </div> : <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">''',
    '''          </div> : <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-3">''',
    "media grid columns",
)
replace_once(
    "src/components/publication-editor.tsx",
    '''            <button className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-5 text-center hover:bg-slate-100">''',
    '''            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-5 text-center transition-colors hover:bg-blue-50">
              <ImagePlus className="text-blue-600" size={26}/>
              <span className="mt-2 text-base font-bold text-slate-900 sm:text-sm">Criar carrossel</span>
              <span className="mt-1 text-sm text-slate-500 sm:text-xs">Selecione de 2 a 10 imagens de uma vez</span>
              <input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp" className="sr-only" onChange={event => void handleCarouselFiles(event.target.files)}/>
            </label>
            <button className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-5 text-center hover:bg-slate-100">''',
    "empty carousel picker",
)

# Cover and text editors are collapsible/optional.
replace_once(
    "src/components/publication-editor.tsx",
    '''          {fileType === "video" && previewUrl && hasInstagram && instagramPlacement !== "story" && <div className="mt-4">
            <VideoCoverEditor
              videoUrl={previewUrl}
              durationMs={mediaMetadata.durationMs}
              onChange={selection => {
                if (coverSelection.previewUrl && coverSelection.previewUrl !== selection.previewUrl) URL.revokeObjectURL(coverSelection.previewUrl);
                setCoverSelection(selection);
                setStagedCover(null);
                setSaveMessage(selection.mode === "auto" ? "Capa automática selecionada." : "Capa personalizada pronta.");
              }}
            />
          </div>}''',
    '''          {fileType === "video" && previewUrl && hasInstagram && instagramPlacement !== "story" && <div className="mt-4">
            <CollapsibleEditorShell title="Capa do vídeo" subtitle="Opcional · abra para escolher frame, recorte e texto" defaultOpen={false} configured={coverSelection.mode !== "auto"}>
              <VideoCoverEditor
                videoUrl={previewUrl}
                durationMs={mediaMetadata.durationMs}
                onChange={selection => {
                  if (coverSelection.previewUrl && coverSelection.previewUrl !== selection.previewUrl) URL.revokeObjectURL(coverSelection.previewUrl);
                  setCoverSelection(selection);
                  setStagedCover(null);
                  setSaveMessage(selection.mode === "auto" ? "Capa automática selecionada." : "Capa personalizada pronta.");
                }}
              />
            </CollapsibleEditorShell>
          </div>}''',
    "collapsible cover",
)
replace_once(
    "src/components/publication-editor.tsx",
    '''              title={fileType === "video" ? "Texto no vídeo" : "Texto na imagem do Feed"}
              collapsible={fileType === "video"}
              defaultOpen={fileType !== "video"}''',
    '''              title={isCarousel ? "Texto nas imagens do carrossel" : fileType === "video" ? "Texto no vídeo" : "Texto na imagem do Feed"}
              collapsible
              defaultOpen={false}''',
    "optional media text editor",
)
replace_once(
    "src/components/publication-editor.tsx",
    '''          {previewUrl && selectedFile && hasInstagram && instagramPlacement !== "feed" && <div className="mt-4">''',
    '''          {!isCarousel && previewUrl && selectedFile && hasInstagram && instagramPlacement !== "feed" && <div className="mt-4">''',
    "hide story editor for carousel",
)

# Description emoji pickers.
replace_once(
    "src/components/publication-editor.tsx",
    '''            <textarea value={base} onChange={event => { setBase(event.target.value); setSaveMessage(""); }} placeholder={requiresDescription ? "Escreva a descrição principal aqui..." : "Descrição opcional para organizar esta publicação..."} className="field min-h-36 resize-y p-4 text-base sm:text-sm"/>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">''',
    '''            <textarea value={base} onChange={event => { setBase(event.target.value); setSaveMessage(""); }} placeholder={requiresDescription ? "Escreva a descrição principal aqui..." : "Descrição opcional para organizar esta publicação..."} className="field min-h-36 resize-y p-4 text-base sm:text-sm"/>
            <div className="mt-2"><InlineEmojiPicker value={base} onChange={value => { setBase(value); setSaveMessage(""); }}/></div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">''',
    "base description emojis",
)
replace_once(
    "src/components/publication-editor.tsx",
    '''                  <textarea value={effectiveText(activeOption)} onChange={event => setTexts(current => ({ ...current, [activeOption.id]: event.target.value }))} className="field min-h-36 resize-y p-4 text-base sm:text-sm"/>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">''',
    '''                  <textarea value={effectiveText(activeOption)} onChange={event => setTexts(current => ({ ...current, [activeOption.id]: event.target.value }))} className="field min-h-36 resize-y p-4 text-base sm:text-sm"/>
                  <div className="mt-2"><InlineEmojiPicker value={effectiveText(activeOption)} onChange={value => setTexts(current => ({ ...current, [activeOption.id]: value }))}/></div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">''',
    "destination description emojis",
)

# Final sidebar preview and modal show edited media/carousel/cover.
replace_once(
    "src/components/publication-editor.tsx",
    '''                  {previewUrl && (fileType === "video" ? <video src={previewUrl} className="h-full w-full object-cover" controls playsInline preload="metadata"/> : <img src={previewUrl} alt="" className="h-full w-full object-cover"/>)}''',
    '''                  {previewUrl && <PublicationMediaPreview previewUrl={previewUrl} fileType={fileType} textConfig={activeOption.platform === "instagram" && instagramPlacement === "story" ? storyTextConfig : feedTextConfig} durationMs={mediaMetadata.durationMs} posterUrl={coverSelection.previewUrl} carouselItems={carouselPreviewItems}/>}''',
    "sidebar final preview",
)
replace_once(
    "src/components/publication-editor.tsx",
    '''              {previewUrl && (fileType === "video"
                ? <video src={previewUrl} className="h-full w-full object-cover" controls playsInline preload="metadata"/>
                : <img src={previewUrl} alt="Prévia ampliada" className="h-full w-full object-cover"/>)}''',
    '''              {previewUrl && <PublicationMediaPreview previewUrl={previewUrl} fileType={fileType} textConfig={activeOption.platform === "instagram" && instagramPlacement === "story" ? storyTextConfig : feedTextConfig} durationMs={mediaMetadata.durationMs} posterUrl={coverSelection.previewUrl} carouselItems={carouselPreviewItems}/>}''',
    "modal final preview",
)

# ---------------------------------------------------------------------------
# Migration 042: ordered media arrays + safe attach RPC + worker context.
# ---------------------------------------------------------------------------
Path("supabase/migrations/042_carousel_media_and_worker_context.sql").write_text('''-- Carrossel de imagens para Instagram/Facebook.
-- Mantém a posição 0 como mídia principal e posições 1..9 como itens adicionais.

create or replace function public.attach_media_items_to_post(
  p_post_id uuid,
  p_media_asset_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_brand_id uuid;
  v_count integer := 0;
  v_expected integer := coalesce(array_length(p_media_asset_ids, 1), 0);
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_expected < 2 or v_expected > 10 then
    raise exception 'carousel must contain between 2 and 10 items' using errcode = '22023';
  end if;

  select p.organization_id, p.brand_id into v_org_id, v_brand_id
  from public.posts p
  join public.memberships m
    on m.organization_id = p.organization_id
   and m.user_id = v_user_id
   and m.status = 'ACTIVE'
   and m.role in ('OWNER','ADMIN','MANAGER','CREATOR')
  where p.id = p_post_id and p.deleted_at is null
  limit 1;

  if v_org_id is null then
    raise exception 'post not found or not accessible' using errcode = '42501';
  end if;

  if (
    select count(*)
    from public.media_assets ma
    where ma.id = any(p_media_asset_ids)
      and ma.organization_id = v_org_id
      and (ma.brand_id is null or ma.brand_id = v_brand_id)
      and ma.processing_status = 'READY'
      and ma.deleted_at is null
      and ma.mime_type like 'image/%'
  ) <> v_expected then
    raise exception 'one or more carousel assets are unavailable' using errcode = '42501';
  end if;

  delete from public.post_target_media ptm
  where ptm.post_target_id in (
    select pt.id from public.post_targets pt
    where pt.post_id = p_post_id and pt.organization_id = v_org_id
  )
    and ptm.position between 0 and 9;

  insert into public.post_target_media (organization_id, post_target_id, media_asset_id, position, role)
  select pt.organization_id, pt.id, item.media_id, item.ord - 1,
         case when item.ord = 1 then 'PRIMARY' else 'CAROUSEL' end
  from public.post_targets pt
  cross join lateral unnest(p_media_asset_ids) with ordinality as item(media_id, ord)
  where pt.post_id = p_post_id
    and pt.organization_id = v_org_id
  on conflict (post_target_id, position)
  do update set media_asset_id = excluded.media_asset_id, role = excluded.role;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.attach_media_items_to_post(uuid,uuid[]) from public;
grant execute on function public.attach_media_items_to_post(uuid,uuid[]) to authenticated;

create or replace function public.worker_get_publication_context(
  p_post_target_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_context jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'target', jsonb_build_object(
      'id', pt.id,
      'organization_id', pt.organization_id,
      'post_id', pt.post_id,
      'social_connection_id', pt.social_connection_id,
      'provider', pt.provider,
      'content_intent', coalesce(pt.content_intent_override, 'AUTO'),
      'caption', coalesce(pt.caption_override, p.base_caption, ''),
      'title', coalesce(pt.title_override, p.internal_title, ''),
      'provider_config', pt.provider_config,
      'scheduled_at', pt.scheduled_at,
      'state', pt.state
    ),
    'connection', jsonb_build_object(
      'id', sc.id,
      'provider_account_id', sc.provider_account_id,
      'display_name', sc.display_name,
      'username', sc.username,
      'connection_status', sc.connection_status,
      'scopes', sc.scopes,
      'token_expires_at', sc.token_expires_at,
      'metadata', sc.metadata
    ),
    'credential', case
      when oc.social_connection_id is null then null
      else jsonb_build_object(
        'access_token_ciphertext', oc.access_token_ciphertext,
        'refresh_token_ciphertext', oc.refresh_token_ciphertext,
        'expires_at', oc.expires_at,
        'key_version', oc.key_version
      )
    end,
    'post', jsonb_build_object(
      'id', p.id,
      'brand_id', p.brand_id,
      'internal_title', p.internal_title,
      'base_caption', p.base_caption
    ),
    'media', case
      when ma.id is null then null
      else jsonb_build_object(
        'id', ma.id, 'object_key', ma.object_key, 'filename', ma.filename,
        'mime_type', ma.mime_type, 'size_bytes', ma.size_bytes,
        'duration_ms', ma.duration_ms, 'width', ma.width, 'height', ma.height,
        'storage_class', ma.storage_class, 'origin', ma.origin,
        'processing_status', ma.processing_status, 'metadata', ma.metadata
      )
    end,
    'media_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', carousel_ma.id, 'object_key', carousel_ma.object_key, 'filename', carousel_ma.filename,
        'mime_type', carousel_ma.mime_type, 'size_bytes', carousel_ma.size_bytes,
        'duration_ms', carousel_ma.duration_ms, 'width', carousel_ma.width, 'height', carousel_ma.height,
        'storage_class', carousel_ma.storage_class, 'origin', carousel_ma.origin,
        'processing_status', carousel_ma.processing_status, 'metadata', carousel_ma.metadata
      ) order by carousel_ptm.position)
      from public.post_target_media carousel_ptm
      join public.media_assets carousel_ma
        on carousel_ma.id = carousel_ptm.media_asset_id
       and carousel_ma.organization_id = carousel_ptm.organization_id
       and carousel_ma.deleted_at is null
      where carousel_ptm.post_target_id = pt.id
        and carousel_ptm.organization_id = pt.organization_id
        and carousel_ptm.position between 0 and 9
    ), '[]'::jsonb),
    'cover_media', case
      when cover_ma.id is null then null
      else jsonb_build_object(
        'id', cover_ma.id, 'object_key', cover_ma.object_key, 'filename', cover_ma.filename,
        'mime_type', cover_ma.mime_type, 'size_bytes', cover_ma.size_bytes,
        'duration_ms', cover_ma.duration_ms, 'width', cover_ma.width, 'height', cover_ma.height,
        'storage_class', cover_ma.storage_class, 'origin', cover_ma.origin,
        'processing_status', cover_ma.processing_status, 'metadata', cover_ma.metadata
      )
    end
  ) into v_context
  from public.post_targets pt
  join public.posts p on p.id = pt.post_id and p.organization_id = pt.organization_id
  join public.social_connections sc on sc.id = pt.social_connection_id and sc.organization_id = pt.organization_id
  left join private.oauth_credentials oc on oc.social_connection_id = sc.id
  left join public.post_target_media ptm
    on ptm.post_target_id = pt.id and ptm.organization_id = pt.organization_id and ptm.position = 0
  left join public.media_assets ma
    on ma.id = ptm.media_asset_id and ma.organization_id = pt.organization_id and ma.deleted_at is null
  left join public.post_target_media cover_ptm
    on cover_ptm.post_target_id = pt.id and cover_ptm.organization_id = pt.organization_id and cover_ptm.position = 100
  left join public.media_assets cover_ma
    on cover_ma.id = cover_ptm.media_asset_id and cover_ma.organization_id = pt.organization_id and cover_ma.deleted_at is null
  where pt.id = p_post_target_id
  limit 1;

  if v_context is null then
    raise exception 'publication target not found' using errcode = '22023';
  end if;
  return v_context;
end;
$function$;

revoke all on function public.worker_get_publication_context(uuid) from public, anon, authenticated;
grant execute on function public.worker_get_publication_context(uuid) to service_role;
''', encoding="utf-8")

print("patch de prévia, emojis, timing e carrossel aplicado")
