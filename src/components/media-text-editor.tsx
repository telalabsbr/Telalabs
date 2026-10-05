"use client";

import { Move, RotateCcw, Sparkles, Type } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  composeTextOnMedia,
  defaultTextOverlay,
  overlayFontFamilies,
  overlayFontLabels,
  type OverlayBackground,
  type OverlayFont,
  type TextOverlayConfig,
} from "@/lib/media/text-overlay";

const quickEmojis = ["✨", "🔥", "❤️", "😍", "👏", "😂", "🚀", "💡"];
const colors = ["#ffffff", "#111827", "#2563eb", "#dc2626", "#f59e0b", "#16a34a"];

function backgroundCss(background: OverlayBackground) {
  if (background === "dark") return "rgba(0,0,0,0.68)";
  if (background === "light") return "rgba(255,255,255,0.88)";
  if (background === "blue") return "rgba(37,99,235,0.90)";
  return "transparent";
}

export function MediaTextEditor({
  sourceFile,
  sourceUrl,
  kind,
  width,
  height,
  title,
  onChange,
}: {
  sourceFile: File;
  sourceUrl: string;
  kind: "image" | "video";
  width?: number | null;
  height?: number | null;
  title: string;
  onChange: (file: File | null, previewUrl: string | null, config: TextOverlayConfig) => void;
}) {
  const [config, setConfig] = useState<TextOverlayConfig>({ ...defaultTextOverlay });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dragRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);

  const aspectRatio = useMemo(() => {
    if (width && height && width > 0 && height > 0) return width / height;
    return kind === "video" ? 9 / 16 : 4 / 5;
  }, [width, height, kind]);

  function patch(next: Partial<TextOverlayConfig>) {
    const updated = { ...config, ...next };
    setConfig(updated);
    setMessage("");
    setError("");
  }

  function appendEmoji(emoji: string) {
    patch({ text: `${config.text}${config.text ? " " : ""}${emoji}` });
  }

  function reset() {
    const next = { ...defaultTextOverlay };
    setConfig(next);
    setProgress(0);
    setMessage("");
    setError("");
    onChange(null, null, next);
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, x: config.x, y: config.y };
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0.08, Math.min(0.92, drag.x + (event.clientX - drag.pointerX) / Math.max(1, rect.width)));
    const y = Math.max(0.08, Math.min(0.92, drag.y + (event.clientY - drag.pointerY) / Math.max(1, rect.height)));
    patch({ x, y });
  }

  async function apply() {
    if (!config.text.trim()) {
      setError("Digite um texto ou emoji antes de aplicar.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage(kind === "video" ? "Preparando vídeo..." : "Preparando imagem...");
    try {
      const file = await composeTextOnMedia(sourceFile, kind, config, (nextProgress, nextMessage) => {
        setProgress(nextProgress);
        setMessage(nextMessage);
      });
      const previewUrl = URL.createObjectURL(file);
      onChange(file, previewUrl, config);
      setProgress(100);
      setMessage("Texto aplicado na mídia.");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "text_overlay_failed";
      setError(code === "text_overlay_video_too_large"
        ? "Este vídeo é grande demais para aplicar texto no navegador. Para este arquivo, use a mídia sem texto ou um vídeo menor."
        : "Não foi possível aplicar o texto nesta mídia. Tente novamente.");
      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  return <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-black text-slate-900"><Type size={16} className="text-blue-600"/>{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Escreva, use emoji e arraste o texto para a posição que quiser.</p>
      </div>
      <button type="button" onClick={reset} className="btn-secondary !px-3"><RotateCcw size={14}/> Limpar</button>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 space-y-3">
        <textarea
          value={config.text}
          onChange={event => patch({ text: event.target.value })}
          className="field min-h-24 resize-y p-3 text-base sm:text-sm"
          placeholder="Digite o texto que vai aparecer na mídia..."
          maxLength={180}
        />

        <div className="flex flex-wrap gap-1.5">
          {quickEmojis.map(emoji => <button type="button" key={emoji} onClick={() => appendEmoji(emoji)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-lg hover:bg-slate-50">{emoji}</button>)}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">Fonte
            <select value={config.font} onChange={event => patch({ font: event.target.value as OverlayFont })} className="field mt-1 px-3 text-sm">
              {(Object.keys(overlayFontLabels) as OverlayFont[]).map(font => <option key={font} value={font}>{overlayFontLabels[font]}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700">Fundo
            <select value={config.background} onChange={event => patch({ background: event.target.value as OverlayBackground })} className="field mt-1 px-3 text-sm">
              <option value="none">Sem fundo</option>
              <option value="dark">Escuro</option>
              <option value="light">Claro</option>
              <option value="blue">Azul</option>
            </select>
          </label>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-700">Cor do texto</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {colors.map(color => <button type="button" key={color} onClick={() => patch({ color })} aria-label={`Cor ${color}`} className={`h-8 w-8 rounded-full border-2 ${config.color === color ? "border-blue-600 ring-2 ring-blue-100" : "border-white ring-1 ring-slate-200"}`} style={{ backgroundColor: color }}/>) }
          </div>
        </div>

        <label className="block text-xs font-bold text-slate-700">Tamanho
          <input type="range" min={0.04} max={0.16} step={0.005} value={config.size} onChange={event => patch({ size: Number(event.target.value) })} className="mt-2 w-full"/>
        </label>
      </div>

      <div>
        <div
          className="relative mx-auto w-full max-w-[260px] touch-none overflow-hidden rounded-xl bg-black shadow-sm"
          style={{ aspectRatio }}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={() => { dragRef.current = null; }}
          onPointerCancel={() => { dragRef.current = null; }}
        >
          {kind === "video"
            ? <video src={sourceUrl} muted playsInline loop autoPlay className="pointer-events-none h-full w-full object-contain"/>
            : <img src={sourceUrl} alt="Prévia com texto" className="pointer-events-none h-full w-full object-contain"/>}
          {!!config.text.trim() && <div
            className="pointer-events-none absolute max-w-[82%] -translate-x-1/2 -translate-y-1/2 whitespace-pre-wrap break-words rounded-lg px-2.5 py-1.5 text-center font-bold leading-tight shadow-sm"
            style={{
              left: `${config.x * 100}%`,
              top: `${config.y * 100}%`,
              color: config.color,
              background: backgroundCss(config.background),
              fontFamily: overlayFontFamilies[config.font],
              fontSize: `${Math.max(14, config.size * 240)}px`,
              textShadow: config.background === "none" ? "0 2px 8px rgba(0,0,0,.8)" : "none",
            }}
          >{config.text}</div>}
          <div className="pointer-events-none absolute inset-x-[7%] inset-y-[5%] rounded-lg border border-dashed border-white/40"/>
          <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold text-white"><Move size={10}/> arraste o texto</div>
        </div>
      </div>
    </div>

    {message && <div className="mt-3">
      <p className="text-xs font-semibold text-blue-700">{message}</p>
      {busy && <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.max(3, progress)}%` }}/></div>}
    </div>}
    {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{error}</p>}

    <button type="button" disabled={busy || !config.text.trim()} onClick={() => void apply()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
      <Sparkles size={16}/>{busy ? "Aplicando..." : "Aplicar texto"}
    </button>
  </div>;
}
