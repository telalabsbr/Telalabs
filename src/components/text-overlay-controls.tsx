"use client";

import { Check, ChevronDown, ChevronUp, CircleHelp, SmilePlus, Star } from "lucide-react";
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
const DEFAULT_COLORS = ["#ffffff", "#111827", "#2563eb", "#dc2626"];
const RECENT_KEY = "tela_social_recent_emojis";
const RECENT_COLOR_KEY = "tela_social_recent_colors";
const STYLE_KEY = "tela_social_text_style";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function backgroundCss(config: TextOverlayConfig) {
  if (config.background === "dark") return "rgba(0,0,0,0.68)";
  if (config.background === "light") return "rgba(255,255,255,0.88)";
  if (config.background === "color") return config.backgroundColor || "#2563eb";
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
      <button type="button" aria-label="Escolher mais emojis" title="Mais emojis" onClick={() => setMoreEmojis(current => !current)} className={`grid h-9 w-9 place-items-center rounded-lg border ${moreEmojis ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}><SmilePlus size={17}/></button>
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
          background: backgroundCss(config),
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
        background: backgroundCss(config),
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
  const [rangeOpen, setRangeOpen] = useState(true);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const start = clamp(config.startMs, 0, duration || 0);
  const end = clamp(config.endMs ?? duration, start, duration || 0);

  function setMode(mode: "all" | "range") {
    if (mode === "all") {
      onChange({ ...config, timingMode: "all", startMs: 0, endMs: null });
      return;
    }
    const edge = Math.min(3000, duration / 2);
    setRangeOpen(true);
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

  if (!duration) return null;

  return <div className="rounded-xl border border-slate-200 bg-white p-2.5">
    <div className="flex items-center gap-2">
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
        <button type="button" onClick={() => setMode("all")} className={`rounded-lg px-2 py-2 text-[11px] font-black sm:text-xs ${config.timingMode === "all" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>Vídeo todo</button>
        <button type="button" onClick={() => setMode("range")} className={`rounded-lg px-2 py-2 text-[11px] font-black sm:text-xs ${config.timingMode === "range" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>Somente um trecho</button>
      </div>
      <details className="relative shrink-0">
        <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full border border-slate-200 bg-white text-slate-500"><CircleHelp size={14}/></summary>
        <div className="absolute right-0 top-10 z-30 w-56 rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] leading-4 text-slate-600 shadow-lg">
          Use “Vídeo todo” para manter o texto sempre visível. Em “Somente um trecho”, ajuste quanto tempo ele aparece no começo e no fim.
        </div>
      </details>
    </div>

    {config.timingMode === "range" && <div className="mt-2">
      <button type="button" onClick={() => setRangeOpen(current => !current)} className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] font-black text-slate-600">
        <span>Intervalo do texto</span>
        {rangeOpen ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
      </button>

      {rangeOpen && <div className="mt-2">
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
      </div>}
    </div>}
  </div>;
}

function hsvToHex(h: number, s: number, v: number) {
  const saturation = Math.max(0, Math.min(1, s));
  const value = Math.max(0, Math.min(1, v));
  const chroma = value * saturation;
  const section = ((h % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs(section % 2 - 1));
  const m = value - chroma;
  let r = 0; let g = 0; let b = 0;
  if (section < 1) [r, g, b] = [chroma, x, 0];
  else if (section < 2) [r, g, b] = [x, chroma, 0];
  else if (section < 3) [r, g, b] = [0, chroma, x];
  else if (section < 4) [r, g, b] = [0, x, chroma];
  else if (section < 5) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];
  const toHex = (channel: number) => Math.round((channel + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function InlineColorPicker({
  value,
  onChange,
  onCommit,
}: {
  value: string;
  onChange: (color: string) => void;
  onCommit: (color: string) => void;
}) {
  const [hue, setHue] = useState(220);
  const [current, setCurrent] = useState(value);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  useEffect(() => setCurrent(value), [value]);

  function pick(clientX: number, clientY: number, commit = false) {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const saturation = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const brightness = clamp(1 - (clientY - rect.top) / Math.max(1, rect.height), 0, 1);
    const color = hsvToHex(hue, saturation, brightness);
    setCurrent(color);
    onChange(color);
    if (commit) onCommit(color);
  }

  return <div className="mt-2 rounded-xl border border-slate-200 bg-white p-2.5">
    <div
      ref={fieldRef}
      className="relative h-32 w-full touch-none cursor-crosshair overflow-hidden rounded-lg"
      style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue} 100% 50%))` }}
      onPointerDown={event => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); pick(event.clientX, event.clientY); }}
      onPointerMove={event => { if (dragging.current) pick(event.clientX, event.clientY); }}
      onPointerUp={event => { if (!dragging.current) return; dragging.current = false; pick(event.clientX, event.clientY, true); }}
      onPointerCancel={() => { dragging.current = false; }}
    />
    <input
      aria-label="Tom da cor"
      type="range"
      min={0}
      max={359}
      value={hue}
      onChange={event => setHue(Number(event.target.value))}
      onPointerUp={() => onCommit(current)}
      className="mt-2 h-3 w-full cursor-pointer appearance-none rounded-full"
      style={{ background: "linear-gradient(to right, #f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)", accentColor: `hsl(${hue} 100% 50%)` }}
    />
    <div className="mt-2 flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-[11px] font-bold text-slate-600"><span className="h-5 w-5 rounded-full border border-slate-200" style={{ backgroundColor: current }}/>{current.toUpperCase()}</span>
      <button type="button" onClick={() => onCommit(current)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-black text-white">Usar cor</button>
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
  const [openMenu, setOpenMenu] = useState<"font" | "text" | null>(null);
  const [customPicker, setCustomPicker] = useState<"text" | "background" | null>(null);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  useEffect(() => {
    try {
      setHasSavedStyle(!!localStorage.getItem(STYLE_KEY));
      const stored = JSON.parse(localStorage.getItem(RECENT_COLOR_KEY) ?? "[]") as string[];
      setRecentColors(Array.isArray(stored) ? stored.slice(0, 8) : []);
    } catch {
      setHasSavedStyle(false);
      setRecentColors([]);
    }
  }, []);

  function patch(next: Partial<TextOverlayConfig>) {
    onChange({ ...config, ...next });
  }

  function saveStyle() {
    const style = {
      font: config.font,
      color: config.color,
      background: config.background,
      backgroundColor: config.backgroundColor,
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
      const style = JSON.parse(localStorage.getItem(STYLE_KEY) ?? "null") as (Partial<TextOverlayConfig> & { background?: string }) | null;
      if (!style) return;
      const legacyBackgrounds: Record<string, string> = {
        blue: "#2563eb", red: "#dc2626", orange: "#ea580c", yellow: "#eab308",
        green: "#16a34a", indigo: "#4f46e5", violet: "#7c3aed",
      };
      if (style.background && legacyBackgrounds[style.background]) {
        patch({ ...style, background: "color", backgroundColor: legacyBackgrounds[style.background] });
        return;
      }
      patch(style);
    } catch { /* ignore */ }
  }

  function rememberColor(color: string) {
    const normalized = color.toLowerCase();
    const next = [normalized, ...recentColors.filter(item => item.toLowerCase() !== normalized)].slice(0, 8);
    setRecentColors(next);
    try { localStorage.setItem(RECENT_COLOR_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const quickColors = Array.from(new Set([...recentColors, ...DEFAULT_COLORS])).slice(0, 4);

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
      <div className="min-w-0 text-xs font-bold text-slate-700">Fonte
        <button type="button" onClick={() => setOpenMenu(current => current === "font" ? null : "font")} className="field mt-1 flex min-w-0 items-center justify-between gap-2 px-2 text-left text-sm font-semibold">
          <span className="truncate" style={{ fontFamily: overlayFontFamilies[config.font] }}>{overlayFontLabels[config.font]}</span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${openMenu === "font" ? "rotate-180" : ""}`}/>
        </button>
      </div>
      <div className="min-w-0 text-xs font-bold text-slate-700">Cor do texto
        <button type="button" onClick={() => setOpenMenu(current => current === "text" ? null : "text")} className="field mt-1 flex min-w-0 items-center justify-between gap-2 px-2 text-left text-sm font-semibold">
          <span className="flex min-w-0 items-center gap-2"><span className="h-4 w-4 shrink-0 rounded-full border border-slate-300" style={{ backgroundColor: config.color }}/><span className="truncate">Cor</span></span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${openMenu === "text" ? "rotate-180" : ""}`}/>
        </button>
      </div>
    </div>

    {openMenu === "font" && <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5 sm:grid-cols-3">
      {(Object.keys(overlayFontLabels) as OverlayFont[]).map(font => <button key={font} type="button" onClick={() => { patch({ font }); setOpenMenu(null); }} className={`rounded-lg border px-2 py-2.5 text-sm ${config.font === font ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700"}`} style={{ fontFamily: overlayFontFamilies[font] }}>{overlayFontLabels[font]}</button>)}
    </div>}

    {openMenu === "text" && <div className="rounded-xl border border-slate-200 bg-white p-2.5">
      <div className="flex items-center gap-2">
        {quickColors.map(color => <button type="button" key={color} onClick={() => { patch({ color }); rememberColor(color); setOpenMenu(null); setCustomPicker(null); }} aria-label={`Cor ${color}`} className={`h-9 w-9 rounded-full border-2 ${config.color.toLowerCase() === color.toLowerCase() ? "border-blue-600 ring-2 ring-blue-100" : "border-white ring-1 ring-slate-200"}`} style={{ backgroundColor: color }}/>) }
        <button type="button" aria-label="Personalizar cor do texto" title="Personalizar cor" onClick={() => setCustomPicker(current => current === "text" ? null : "text")} className="grid h-9 w-9 place-items-center rounded-full border-2 border-white text-sm font-black text-white shadow-sm ring-1 ring-slate-200" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}>+</button>
      </div>
      {customPicker === "text" && <InlineColorPicker value={config.color} onChange={color => patch({ color })} onCommit={color => { patch({ color }); rememberColor(color); setCustomPicker(null); setOpenMenu(null); }}/>}
    </div>}

    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
      <p className="text-xs font-bold text-slate-700">Fundo</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {([["none", "Sem fundo"], ["dark", "Escuro"], ["light", "Claro"]] as Array<[OverlayBackground, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => patch({ background: value })} className={`rounded-lg border px-2 py-2 text-xs font-bold ${config.background === value ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}>{label}</button>)}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {quickColors.map(color => <button type="button" key={color} onClick={() => { patch({ background: "color", backgroundColor: color }); rememberColor(color); }} aria-label={`Fundo ${color}`} className={`h-9 w-9 rounded-full border-2 ${config.background === "color" && config.backgroundColor.toLowerCase() === color.toLowerCase() ? "border-blue-600 ring-2 ring-blue-100" : "border-white ring-1 ring-slate-200"}`} style={{ backgroundColor: color }}/>) }
        <button type="button" aria-label="Personalizar cor de fundo" title="Personalizar cor" onClick={() => setCustomPicker(current => current === "background" ? null : "background")} className="grid h-9 w-9 place-items-center rounded-full border-2 border-white text-sm font-black text-white shadow-sm ring-1 ring-slate-200" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}>+</button>
      </div>
      {customPicker === "background" && <InlineColorPicker value={config.backgroundColor} onChange={color => patch({ background: "color", backgroundColor: color })} onCommit={color => { patch({ background: "color", backgroundColor: color }); rememberColor(color); setCustomPicker(null); }}/>}
    </div>

    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={saveStyle} className="btn-secondary w-full !px-2 !py-2 text-xs"><Star size={14} className={hasSavedStyle ? "fill-yellow-400 text-yellow-500" : ""}/> Salvar estilo</button>
      <button type="button" disabled={!hasSavedStyle} onClick={loadStyle} className="btn-secondary w-full !px-2 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"><Check size={14}/> Usar meu estilo</button>
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
