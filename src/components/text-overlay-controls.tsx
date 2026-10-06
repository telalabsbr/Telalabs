"use client";

import { Check, ChevronDown, ChevronUp, Move, RotateCcw, SmilePlus, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultTextOverlay,
  overlayFontFamilies,
  overlayFontLabels,
  type OverlayBackground,
  type OverlayFont,
  type TextOverlayConfig,
} from "@/lib/media/text-overlay";

const QUICK_EMOJIS = ["✨", "🔥", "❤️", "😍"];
const EMOJI_LIBRARY = [
  "✨", "🔥", "❤️", "😍", "👏", "😂", "🚀", "💡", "✅", "🎯", "📢", "💥", "⭐", "🌟", "💫", "🎉",
  "🥳", "😎", "🤩", "😊", "😉", "🤔", "😱", "🙌", "🙏", "💪", "👀", "👉", "👇", "👍", "💯", "⚡", "🎬",
  "📸", "🎥", "🎵", "🎶", "📌", "📍", "🛍️", "💰", "🎁", "📣", "🧠", "🏆", "🌈", "☀️", "🌙", "💎", "👑", "🫶",
];
const COLOR_SWATCHES = ["#ffffff", "#111827", "#2563eb", "#dc2626", "#f59e0b", "#16a34a"];
const RECENT_KEY = "tela_social_recent_emojis";
const STYLE_KEY = "tela_social_text_style";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function backgroundCss(background: OverlayBackground) {
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
}

function formatTime(ms: number) {
  const safe = Math.max(0, Math.round(ms));
  const seconds = safe / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function InlineEmojiPicker({
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

  const quick = useMemo(() => Array.from(new Set([...recent, ...QUICK_EMOJIS])).slice(0, 4), [recent]);

  function appendEmoji(emoji: string) {
    onChange(`${value}${value && !/\s$/.test(value) ? " " : ""}${emoji}`);
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

export function TextOverlayLayer({
  config,
  onChange,
  visible = true,
  interactive = true,
}: {
  config: TextOverlayConfig;
  onChange: (config: TextOverlayConfig) => void;
  visible?: boolean;
  interactive?: boolean;
}) {
  const gesture = useRef<null | {
    type: "move" | "resize";
    x: number;
    y: number;
    startX: number;
    startY: number;
    boxWidth: number;
    size: number;
  }>(null);

  if (!visible || !config.text.trim()) return null;

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

  function stageRect(target: HTMLElement) {
    const stage = target.closest<HTMLElement>("[data-overlay-stage]");
    return stage?.getBoundingClientRect() ?? null;
  }

  function beginMove(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      type: "move",
      x: event.clientX,
      y: event.clientY,
      startX: config.x,
      startY: config.y,
      boxWidth: config.boxWidth,
      size: config.size,
    };
  }

  function beginResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      type: "resize",
      x: event.clientX,
      y: event.clientY,
      startX: config.x,
      startY: config.y,
      boxWidth: config.boxWidth,
      size: config.size,
    };
  }

  function move(event: React.PointerEvent<HTMLElement>) {
    const active = gesture.current;
    if (!active) return;
    const rect = stageRect(event.currentTarget);
    if (!rect) return;
    const dx = (event.clientX - active.x) / Math.max(1, rect.width);
    const dy = (event.clientY - active.y) / Math.max(1, rect.height);

    if (active.type === "move") {
      onChange({
        ...config,
        x: clamp(active.startX + dx, 0.05, 0.95),
        y: clamp(active.startY + dy, 0.05, 0.95),
      });
      return;
    }

    onChange({
      ...config,
      boxWidth: clamp(active.boxWidth + dx * 1.7, 0.2, 0.92),
      size: clamp(active.size + dy * 0.22, 0.04, 0.2),
    });
  }

  function end() {
    gesture.current = null;
  }

  return <div
    className="absolute -translate-x-1/2 -translate-y-1/2 touch-none select-none"
    style={{
      left: `${config.x * 100}%`,
      top: `${config.y * 100}%`,
      width: `${config.boxWidth * 100}%`,
      zIndex: 4,
    }}
    onPointerDown={beginMove}
    onPointerMove={move}
    onPointerUp={end}
    onPointerCancel={end}
  >
    <div
      className="relative cursor-move whitespace-pre-wrap break-words rounded-lg px-2.5 py-1.5 text-center font-bold leading-tight shadow-sm outline outline-1 outline-white/70"
      style={{
        color: config.color,
        background: backgroundCss(config.background),
        fontFamily: overlayFontFamilies[config.font],
        fontSize: `${Math.max(14, config.size * 260)}px`,
        textShadow: config.background === "none" ? "0 2px 8px rgba(0,0,0,.8)" : "none",
      }}
    >
      {config.text}
      <button
        type="button"
        aria-label="Redimensionar texto"
        title="Arraste para redimensionar"
        className="absolute -bottom-3 -right-3 grid h-7 w-7 touch-none place-items-center rounded-full border-2 border-white bg-blue-600 text-white shadow-lg"
        onPointerDown={beginResize}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span className="block h-2.5 w-2.5 border-b-2 border-r-2 border-white"/>
      </button>
    </div>
  </div>;
}

export function TextTimingControl({
  config,
  durationMs,
  onChange,
}: {
  config: TextOverlayConfig;
  durationMs: number | null | undefined;
  onChange: (config: TextOverlayConfig) => void;
}) {
  const duration = Math.max(0, durationMs ?? 0);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const start = clamp(config.startMs, 0, duration || 0);
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
  }

  if (!duration) return <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">A duração do vídeo será carregada antes de liberar o intervalo do texto.</p>;

  return <div className="rounded-xl border border-slate-200 bg-white p-3">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setMode("all")} className={`rounded-lg px-3 py-2 text-xs font-black ${config.timingMode === "all" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>Vídeo todo</button>
      <button type="button" onClick={() => setMode("range")} className={`rounded-lg px-3 py-2 text-xs font-black ${config.timingMode === "range" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>Somente um trecho</button>
    </div>

    {config.timingMode === "range" && <div className="mt-4">
      <div
        ref={trackRef}
        className="relative h-10 touch-none select-none"
        onPointerMove={event => {
          if (!dragging) return;
          updateFromPointer(event.clientX, dragging);
        }}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
      >
        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200"/>
        <div className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-l-full bg-blue-500" style={{ width: `${(start / duration) * 100}%` }}/>
        <div className="absolute right-0 top-1/2 h-2 -translate-y-1/2 rounded-r-full bg-blue-500" style={{ width: `${((duration - end) / duration) * 100}%` }}/>
        {(["start", "end"] as const).map(handle => {
          const value = handle === "start" ? start : end;
          return <button
            key={handle}
            type="button"
            aria-label={handle === "start" ? "Início do texto" : "Fim do texto"}
            className="absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-4 border-white bg-blue-600 shadow-md"
            style={{ left: `${(value / duration) * 100}%` }}
            onPointerDown={event => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(handle);
            }}
            onPointerMove={event => {
              if (dragging === handle) updateFromPointer(event.clientX, handle);
            }}
            onPointerUp={() => setDragging(null)}
            onPointerCancel={() => setDragging(null)}
          />;
        })}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-slate-600">
        <span>No início: {formatTime(start)}</span>
        <span>No fim: {formatTime(duration - end)}</span>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">A área azul mostra onde o texto aparece. Arraste a bolinha da esquerda para a direita para aumentar o tempo no início e a da direita para a esquerda para aumentar o tempo no fim. Se as duas se encontrarem, o texto cobre o vídeo inteiro.</p>
    </div>}
  </div>;
}

function hslToHex(h: number, s: number, l: number) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const m = lightness - chroma / 2;
  let r = 0; let g = 0; let b = 0;
  if (h < 60) [r, g, b] = [chroma, x, 0];
  else if (h < 120) [r, g, b] = [x, chroma, 0];
  else if (h < 180) [r, g, b] = [0, chroma, x];
  else if (h < 240) [r, g, b] = [0, x, chroma];
  else if (h < 300) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];
  const toHex = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function InlineColorMixer({ onChange }: { onChange: (color: string) => void }) {
  const [hue, setHue] = useState(220);
  const [saturation, setSaturation] = useState(85);
  const [lightness, setLightness] = useState(50);
  function apply(nextHue: number, nextSaturation: number, nextLightness: number) {
    onChange(hslToHex(nextHue, nextSaturation, nextLightness));
  }
  return <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
    <p className="mb-2 text-[11px] font-bold text-slate-600">Personalizar</p>
    <input aria-label="Tom da cor" type="range" min={0} max={359} value={hue} onChange={event => { const value = Number(event.target.value); setHue(value); apply(value, saturation, lightness); }} className="w-full" style={{ accentColor: `hsl(${hue} 85% 50%)` }}/>
    <div className="mt-2 grid grid-cols-2 gap-2">
      <label className="text-[10px] font-bold text-slate-500">Intensidade<input type="range" min={0} max={100} value={saturation} onChange={event => { const value = Number(event.target.value); setSaturation(value); apply(hue, value, lightness); }} className="mt-1 w-full"/></label>
      <label className="text-[10px] font-bold text-slate-500">Luminosidade<input type="range" min={10} max={90} value={lightness} onChange={event => { const value = Number(event.target.value); setLightness(value); apply(hue, saturation, value); }} className="mt-1 w-full"/></label>
    </div>
  </div>;
}
export function TextOverlayControls({
  config,
  onChange,
  compact = false,
}: {
  config: TextOverlayConfig;
  onChange: (config: TextOverlayConfig) => void;
  compact?: boolean;
}) {
  const [hasSavedStyle, setHasSavedStyle] = useState(false);
  const [openMenu, setOpenMenu] = useState<"text" | "background" | null>(null);

  useEffect(() => {
    try { setHasSavedStyle(!!localStorage.getItem(STYLE_KEY)); } catch { setHasSavedStyle(false); }
  }, []);

  function patch(next: Partial<TextOverlayConfig>) {
    onChange({ ...config, ...next });
  }

  function saveStyle() {
    const style = {
      font: config.font,
      color: config.color,
      background: config.background,
      size: config.size,
      boxWidth: config.boxWidth,
    };
    try {
      localStorage.setItem(STYLE_KEY, JSON.stringify(style));
      setHasSavedStyle(true);
    } catch { /* ignore */ }
  }

  function loadStyle() {
    try {
      const style = JSON.parse(localStorage.getItem(STYLE_KEY) ?? "null") as Partial<TextOverlayConfig> | null;
      if (style) patch(style);
    } catch { /* ignore */ }
  }

  function resetStyle() {
    patch({
      font: defaultTextOverlay.font,
      color: defaultTextOverlay.color,
      background: defaultTextOverlay.background,
      size: defaultTextOverlay.size,
      boxWidth: defaultTextOverlay.boxWidth,
      x: defaultTextOverlay.x,
      y: defaultTextOverlay.y,
    });
  }

  return <div className={compact ? "space-y-3" : "space-y-4"}>
    <textarea
      value={config.text}
      onChange={event => patch({ text: event.target.value })}
      onInput={event => { event.currentTarget.style.height = "0px"; event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`; }}
      className="field min-h-20 touch-pan-y resize-none overflow-hidden p-3 text-base sm:text-sm"
      placeholder="Digite o texto ou adicione um emoji..."
      maxLength={240}
    />

    <InlineEmojiPicker value={config.text} onChange={text => patch({ text })}/>

    <div className="grid grid-cols-2 gap-2">
      <label className="min-w-0 text-xs font-bold text-slate-700">Fonte
        <select value={config.font} onChange={event => patch({ font: event.target.value as OverlayFont })} className="field mt-1 min-w-0 px-2 text-sm">
          {(Object.keys(overlayFontLabels) as OverlayFont[]).map(font => <option key={font} value={font}>{overlayFontLabels[font]}</option>)}
        </select>
      </label>
      <div className="min-w-0 text-xs font-bold text-slate-700">Cor do texto
        <button type="button" onClick={() => setOpenMenu(current => current === "text" ? null : "text")} className="field mt-1 flex min-w-0 items-center justify-between gap-2 px-2 text-left text-sm font-semibold">
          <span className="flex min-w-0 items-center gap-2"><span className="h-4 w-4 shrink-0 rounded-full border border-slate-300" style={{ backgroundColor: config.color }}/><span className="truncate">Cor</span></span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${openMenu === "text" ? "rotate-180" : ""}`}/>
        </button>
      </div>
    </div>

    {openMenu === "text" && <div className="rounded-xl border border-slate-200 bg-white p-2.5">
      <div className="flex flex-wrap gap-2">{COLOR_SWATCHES.map(color => <button type="button" key={color} onClick={() => patch({ color })} aria-label={`Cor ${color}`} className={`h-8 w-8 rounded-full border-2 ${config.color.toLowerCase() === color ? "border-blue-600 ring-2 ring-blue-100" : "border-white ring-1 ring-slate-200"}`} style={{ backgroundColor: color }}/>)}</div>
      <InlineColorMixer onChange={color => patch({ color })}/>
    </div>}

    <div className="text-xs font-bold text-slate-700">Fundo
      <button type="button" onClick={() => setOpenMenu(current => current === "background" ? null : "background")} className="field mt-1 flex w-full items-center justify-between gap-2 px-3 text-left text-sm font-semibold">
        <span>{config.background === "none" ? "Sem fundo" : config.background === "dark" ? "Escuro" : config.background === "light" ? "Claro" : config.background === "blue" ? "Azul" : config.background === "red" ? "Vermelho" : config.background === "orange" ? "Laranja" : config.background === "yellow" ? "Amarelo" : config.background === "green" ? "Verde" : config.background === "indigo" ? "Anil" : "Violeta"}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${openMenu === "background" ? "rotate-180" : ""}`}/>
      </button>
    </div>

    {openMenu === "background" && <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5 sm:grid-cols-3">
      {([["none", "Sem fundo"], ["dark", "Escuro"], ["light", "Claro"], ["blue", "Azul"], ["red", "Vermelho"], ["orange", "Laranja"], ["yellow", "Amarelo"], ["green", "Verde"], ["indigo", "Anil"], ["violet", "Violeta"]] as Array<[OverlayBackground, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => { patch({ background: value }); setOpenMenu(null); }} className={`rounded-lg border px-2 py-2 text-xs font-bold ${config.background === value ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}>{label}</button>)}
    </div>}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={saveStyle} className="btn-secondary !px-3 !py-2 text-xs"><Star size={14}/> Salvar estilo</button>
      {hasSavedStyle && <button type="button" onClick={loadStyle} className="btn-secondary !px-3 !py-2 text-xs"><Check size={14}/> Usar meu estilo</button>}
      <button type="button" onClick={resetStyle} className="btn-secondary !px-3 !py-2 text-xs"><RotateCcw size={14}/> Centralizar</button>
    </div>

    <p className="flex items-center gap-1 text-[11px] leading-4 text-slate-500"><Move size={12}/> Arraste o texto na própria mídia. Puxe o quadradinho no canto para mudar largura e tamanho; o texto quebra linha automaticamente.</p>
  </div>;
}

export function CollapsibleEditorShell({
  title,
  subtitle,
  children,
  defaultOpen = false,
  configured = false,
  open,
  onOpenChange,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  configured?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  function toggleOpen() {
    const next = !isOpen;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }
  return <div className="rounded-xl border border-blue-100 bg-blue-50/35">
    <button type="button" onClick={toggleOpen} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
      <span className="min-w-0">
        <span className="block text-sm font-black text-slate-900">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-slate-500">{configured ? "Texto configurado" : subtitle ?? "Opcional"}</span>
      </span>
      {isOpen ? <ChevronUp size={18} className="shrink-0 text-blue-600"/> : <ChevronDown size={18} className="shrink-0 text-blue-600"/>}
    </button>
    {isOpen && <div className="border-t border-blue-100 p-3 sm:p-4">{children}</div>}
  </div>;
}
