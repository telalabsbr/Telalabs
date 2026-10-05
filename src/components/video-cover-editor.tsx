"use client";

import { Minus, Move, Plus, RotateCcw, Upload, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultTextOverlay, drawTextOverlay, overlayFontLabels, type OverlayBackground, type OverlayFont, type TextOverlayConfig } from "@/lib/media/text-overlay";

type CoverMode = "auto" | "frame" | "upload";
type Aspect = "9:16" | "4:5" | "1:1" | "16:9";

export type CoverSelection = {
  mode: CoverMode;
  file: File | null;
  previewUrl: string | null;
  aspect: Aspect;
};

const aspectSizes: Record<Aspect, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function imageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("cover_image_decode_failed"));
    image.src = url;
  });
}

async function canvasBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.92) {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error("cover_export_failed");
  return blob;
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  zoom: number,
  panX: number,
  panY: number,
) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);

  const baseScale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const scale = baseScale * zoom;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const overflowX = Math.max(0, (drawWidth - width) / 2);
  const overflowY = Math.max(0, (drawHeight - height) / 2);
  const dx = (width - drawWidth) / 2 + panX * overflowX;
  const dy = (height - drawHeight) / 2 + panY * overflowY;

  context.drawImage(image, dx, dy, drawWidth, drawHeight);
}

async function captureVideoFrame(videoUrl: string, timeSeconds: number) {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("cover_video_decode_failed"));
  });

  const safeTime = clamp(timeSeconds, 0, Math.max(0, (video.duration || 0) - 0.03));
  if (safeTime > 0) {
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("cover_video_seek_failed"));
      video.currentTime = safeTime;
    });
  }

  const width = video.videoWidth || 1080;
  const height = video.videoHeight || 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("cover_canvas_failed");
  context.drawImage(video, 0, 0, width, height);
  return canvasBlob(canvas, "image/jpeg", 0.94);
}

export function VideoCoverEditor({
  videoUrl,
  durationMs,
  onChange,
}: {
  videoUrl: string;
  durationMs: number | null;
  onChange: (selection: CoverSelection) => void;
}) {
  const [mode, setMode] = useState<CoverMode>("auto");
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [frameMs, setFrameMs] = useState(0);
  const [detectedDurationMs, setDetectedDurationMs] = useState(0);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("capa");
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [textOverlay, setTextOverlay] = useState<TextOverlayConfig>({ ...defaultTextOverlay });
  const ownedUrl = useRef<string | null>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameVideoRef = useRef<HTMLVideoElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);

  const duration = Math.max(0, durationMs ?? detectedDurationMs);
  const ratio = useMemo(() => {
    const size = aspectSizes[aspect];
    return size.width / size.height;
  }, [aspect]);

  useEffect(() => () => {
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
  }, []);

  useEffect(() => {
    const video = frameVideoRef.current;
    if (!video || mode !== "frame") return;
    const safeSeconds = clamp(frameMs / 1000, 0, Math.max(0, (video.duration || duration / 1000 || 0) - 0.03));
    if (Math.abs(video.currentTime - safeSeconds) > 0.03) {
      try {
        video.currentTime = safeSeconds;
      } catch {
        // O navegador pode rejeitar seek antes dos metadados; onLoadedMetadata sincroniza novamente.
      }
    }
  }, [frameMs, duration, mode]);

  useEffect(() => {
    if (!sourceUrl) {
      sourceImageRef.current = null;
      setSourceSize({ width: 0, height: 0 });
      return;
    }

    let active = true;
    void imageFromUrl(sourceUrl)
      .then(image => {
        if (!active) return;
        sourceImageRef.current = image;
        setSourceSize({ width: image.naturalWidth, height: image.naturalHeight });
      })
      .catch(() => {
        if (active) setError("Não foi possível abrir a imagem escolhida para a capa.");
      });

    return () => { active = false; };
  }, [sourceUrl]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const image = sourceImageRef.current;
    if (!canvas || !image || !sourceSize.width || !sourceSize.height) return;

    const output = aspectSizes[aspect];
    canvas.width = output.width;
    canvas.height = output.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    drawCover(context, image, output.width, output.height, zoom, panX, panY);
    drawTextOverlay(context, output.width, output.height, textOverlay);
  }, [aspect, zoom, panX, panY, sourceSize, textOverlay]);

  function resetPosition() {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }

  function ownBlob(blob: Blob, name: string) {
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    const url = URL.createObjectURL(blob);
    ownedUrl.current = url;
    setSourceUrl(url);
    setSourceName(name.replace(/\.[^.]+$/, "") || "capa");
    resetPosition();
  }

  async function chooseFrame() {
    setBusy(true);
    setError("");
    try {
      const blob = await captureVideoFrame(videoUrl, frameMs / 1000);
      ownBlob(blob, "frame-video.jpg");
      setMode("frame");
    } catch {
      setError("Não foi possível capturar este frame. Tente outro ponto do vídeo.");
    } finally {
      setBusy(false);
    }
  }

  function chooseUpload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Escolha uma imagem para a capa.");
      return;
    }
    ownBlob(file, file.name);
    setMode("upload");
    setError("");
  }

  async function applyCover() {
    if (mode === "auto") {
      onChange({ mode, file: null, previewUrl: null, aspect });
      return;
    }
    if (!sourceUrl) {
      setError(mode === "frame" ? "Selecione um frame antes de aplicar." : "Envie uma imagem antes de aplicar.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const image = sourceImageRef.current ?? await imageFromUrl(sourceUrl);
      const output = aspectSizes[aspect];
      const canvas = document.createElement("canvas");
      canvas.width = output.width;
      canvas.height = output.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("cover_canvas_failed");

      drawCover(context, image, output.width, output.height, zoom, panX, panY);
      drawTextOverlay(context, output.width, output.height, textOverlay);

      const blob = await canvasBlob(canvas, "image/jpeg", 0.92);
      const file = new File([blob], `${sourceName}-${aspect.replace(":", "x")}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      const previewUrl = URL.createObjectURL(blob);
      onChange({ mode, file, previewUrl, aspect });
    } catch {
      setError("Não foi possível gerar a capa ajustada.");
    } finally {
      setBusy(false);
    }
  }

  function panOverflow(containerWidth: number, containerHeight: number) {
    if (!sourceSize.width || !sourceSize.height) return { x: 0, y: 0 };
    const baseScale = Math.max(containerWidth / sourceSize.width, containerHeight / sourceSize.height);
    const drawWidth = sourceSize.width * baseScale * zoom;
    const drawHeight = sourceSize.height * baseScale * zoom;
    return {
      x: Math.max(0, (drawWidth - containerWidth) / 2),
      y: Math.max(0, (drawHeight - containerHeight) / 2),
    };
  }

  function applyDrag(clientX: number, clientY: number, element: HTMLDivElement) {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = element.getBoundingClientRect();
    const overflow = panOverflow(rect.width, rect.height);
    const deltaX = clientX - drag.x;
    const deltaY = clientY - drag.y;

    setPanX(overflow.x > 0 ? clamp(drag.panX + deltaX / overflow.x, -1, 1) : 0);
    setPanY(overflow.y > 0 ? clamp(drag.panY + deltaY / overflow.y, -1, 1) : 0);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!sourceUrl || event.pointerType === "touch") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, panX, panY };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || event.pointerType === "touch") return;
    applyDrag(event.clientX, event.clientY, event.currentTarget);
  }

  function onTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2) {
      const [a, b] = [event.touches[0], event.touches[1]];
      pinchRef.current = { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom };
    } else if (event.touches.length === 1) {
      const touch = event.touches[0];
      dragRef.current = { x: touch.clientX, y: touch.clientY, panX, panY };
    }
  }

  function onTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2 && pinchRef.current) {
      const [a, b] = [event.touches[0], event.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      setZoom(clamp(pinchRef.current.zoom * (distance / Math.max(1, pinchRef.current.distance)), 1, 4));
      return;
    }
    if (event.touches.length === 1 && dragRef.current) {
      const touch = event.touches[0];
      applyDrag(touch.clientX, touch.clientY, event.currentTarget);
    }
  }

  function endGesture() {
    dragRef.current = null;
    pinchRef.current = null;
  }

  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm font-black text-slate-900">Capa do vídeo</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Escolha um frame ou envie uma imagem. Depois recorte exatamente como quiser dentro do formato final.</p>
      </div>
      <div className="flex rounded-lg bg-white p-1 text-xs font-bold shadow-sm">
        {(["auto", "frame", "upload"] as CoverMode[]).map(value => <button key={value} type="button" onClick={() => { setMode(value); setError(""); }} className={`rounded-md px-2.5 py-1.5 ${mode === value ? "bg-indigo-600 text-white" : "text-slate-600"}`}>
          {value === "auto" ? "Automática" : value === "frame" ? "Frame" : "Enviar"}
        </button>)}
      </div>
    </div>

    {mode === "frame" && <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-700"><Video size={15}/> Escolher frame</div>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">A imagem abaixo acompanha a barra. Pare exatamente no quadro que você quer usar.</p>

      <div className="relative mt-3 overflow-hidden rounded-lg bg-black">
        <video
          ref={frameVideoRef}
          src={videoUrl}
          muted
          playsInline
          preload="metadata"
          className="mx-auto max-h-64 w-full object-contain"
          onLoadedMetadata={event => {
            const video = event.currentTarget;
            const detected = Number.isFinite(video.duration) ? Math.max(0, video.duration * 1000) : 0;
            setDetectedDurationMs(detected);
            const safeSeconds = clamp(frameMs / 1000, 0, Math.max(0, (video.duration || 0) - 0.03));
            video.currentTime = safeSeconds;
          }}
        />
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-1 text-[11px] font-bold text-white">{(frameMs / 1000).toFixed(1)}s</span>
      </div>

      <input type="range" min={0} max={Math.max(0, duration)} step={100} value={Math.min(frameMs, duration)} onChange={event => setFrameMs(Number(event.target.value))} className="mt-3 w-full"/>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500"><span>{(frameMs / 1000).toFixed(1)}s</span><span>{duration ? `${(duration / 1000).toFixed(1)}s` : "carregando duração..."}</span></div>
      <button type="button" disabled={busy} onClick={() => void chooseFrame()} className="btn-secondary mt-2 w-full disabled:opacity-50">Selecionar este frame para editar</button>
    </div>}

    {mode === "upload" && <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-200 bg-white px-4 py-4 text-sm font-bold text-indigo-700">
      <Upload size={16}/> Enviar imagem de capa
      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={event => chooseUpload(event.target.files?.[0])}/>
    </label>}

    {mode !== "auto" && sourceUrl && <>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-black text-slate-800">Formato final da capa</p>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">Troque o formato sem perder a liberdade de reposicionar. Ex.: uma imagem 9:16 pode ser recortada em qualquer região para virar 1:1.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(aspectSizes) as Aspect[]).map(value => <button type="button" key={value} onClick={() => setAspect(value)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${aspect === value ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"}`}>{value}</button>)}
        </div>
      </div>

      <div className="mt-3 flex justify-center">
        <div
          className="relative w-full max-w-[320px] touch-none cursor-move overflow-hidden rounded-xl bg-black shadow-inner"
          style={{ aspectRatio: ratio }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={endGesture}
        >
          <canvas ref={previewCanvasRef} className="pointer-events-none h-full w-full select-none"/>
          <div className="pointer-events-none absolute inset-0 border border-white/45"/>
          <div className="pointer-events-none absolute inset-x-[8%] inset-y-[6%] rounded-lg border border-dashed border-white/55"/>
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-black/20"/>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <button type="button" onClick={() => setZoom(current => clamp(current - 0.1, 1, 4))} className="btn-secondary !px-3"><Minus size={15}/></button>
        <span className="min-w-16 text-center text-xs font-bold text-slate-600">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom(current => clamp(current + 0.1, 1, 4))} className="btn-secondary !px-3"><Plus size={15}/></button>
        <button type="button" onClick={resetPosition} className="btn-secondary !px-3" title="Centralizar"><RotateCcw size={15}/></button>
      </div>
      <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] leading-4 text-slate-500"><Move size={12}/> Arraste em qualquer direção para escolher a região exata. Use −/+ ou pinça para ampliar.</p>
      <p className="mt-1 text-center text-[11px] font-semibold text-slate-500">A prévia acima é o recorte que será gerado ao aplicar a capa.</p>
    </>}

    {mode !== "auto" && sourceUrl && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
      <p className="text-xs font-black text-slate-900">Texto na capa</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">Opcional. Você pode escrever, usar emoji e escolher um estilo antes de gerar a capa.</p>
      <textarea value={textOverlay.text} onChange={event => setTextOverlay(current => ({ ...current, text: event.target.value }))} className="field mt-3 min-h-20 resize-y p-3 text-sm" placeholder="Texto da capa..." maxLength={180}/>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["✨", "🔥", "❤️", "😍", "👏", "😂", "🚀", "💡"].map(emoji => <button type="button" key={emoji} onClick={() => setTextOverlay(current => ({ ...current, text: `${current.text}${current.text ? " " : ""}${emoji}` }))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-base">{emoji}</button>)}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] font-bold text-slate-700">Fonte
          <select value={textOverlay.font} onChange={event => setTextOverlay(current => ({ ...current, font: event.target.value as OverlayFont }))} className="field mt-1 px-2 text-xs">
            {(Object.keys(overlayFontLabels) as OverlayFont[]).map(font => <option key={font} value={font}>{overlayFontLabels[font]}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-bold text-slate-700">Fundo
          <select value={textOverlay.background} onChange={event => setTextOverlay(current => ({ ...current, background: event.target.value as OverlayBackground }))} className="field mt-1 px-2 text-xs">
            <option value="none">Sem fundo</option><option value="dark">Escuro</option><option value="light">Claro</option><option value="blue">Azul</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {["#ffffff", "#111827", "#2563eb", "#dc2626", "#f59e0b", "#16a34a"].map(color => <button type="button" key={color} aria-label={`Cor ${color}`} onClick={() => setTextOverlay(current => ({ ...current, color }))} className={`h-7 w-7 rounded-full border-2 ${textOverlay.color === color ? "border-blue-600 ring-2 ring-blue-100" : "border-white ring-1 ring-slate-200"}`} style={{ backgroundColor: color }}/>) }
      </div>
      <label className="mt-3 block text-[11px] font-bold text-slate-700">Tamanho<input type="range" min={0.04} max={0.16} step={0.005} value={textOverlay.size} onChange={event => setTextOverlay(current => ({ ...current, size: Number(event.target.value) }))} className="mt-1 w-full"/></label>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] font-bold text-slate-700">Horizontal<input type="range" min={0.08} max={0.92} step={0.01} value={textOverlay.x} onChange={event => setTextOverlay(current => ({ ...current, x: Number(event.target.value) }))} className="mt-1 w-full"/></label>
        <label className="text-[11px] font-bold text-slate-700">Vertical<input type="range" min={0.08} max={0.92} step={0.01} value={textOverlay.y} onChange={event => setTextOverlay(current => ({ ...current, y: Number(event.target.value) }))} className="mt-1 w-full"/></label>
      </div>
    </div>}

    {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{error}</p>}

    <button type="button" disabled={busy || (mode !== "auto" && !sourceUrl)} onClick={() => void applyCover()} className="btn-primary mt-4 w-full disabled:opacity-40">
      {busy ? "Preparando capa..." : mode === "auto" ? "Usar capa automática" : "Aplicar esta capa"}
    </button>
  </div>;
}
