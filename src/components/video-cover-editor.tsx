"use client";

import { Minus, Move, Plus, RotateCcw, Upload, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("capa");
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ownedUrl = useRef<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);

  const duration = Math.max(0, durationMs ?? 0);
  const ratio = useMemo(() => {
    const size = aspectSizes[aspect];
    return size.width / size.height;
  }, [aspect]);

  useEffect(() => () => {
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
  }, []);

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
      setError(mode === "frame" ? "Capture um frame antes de aplicar." : "Envie uma imagem antes de aplicar.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const image = await imageFromUrl(sourceUrl);
      const output = aspectSizes[aspect];
      const canvas = document.createElement("canvas");
      canvas.width = output.width;
      canvas.height = output.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("cover_canvas_failed");

      context.fillStyle = "#000000";
      context.fillRect(0, 0, output.width, output.height);

      const baseScale = Math.max(output.width / image.naturalWidth, output.height / image.naturalHeight);
      const scale = baseScale * zoom;
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const overflowX = Math.max(0, (drawWidth - output.width) / 2);
      const overflowY = Math.max(0, (drawHeight - output.height) / 2);
      const dx = (output.width - drawWidth) / 2 + panX * overflowX;
      const dy = (output.height - drawHeight) / 2 + panY * overflowY;
      context.drawImage(image, dx, dy, drawWidth, drawHeight);

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

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!sourceUrl || event.pointerType === "touch") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, panX, panY };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPanX(clamp(drag.panX + ((event.clientX - drag.x) / Math.max(1, rect.width)) * 2, -1, 1));
    setPanY(clamp(drag.panY + ((event.clientY - drag.y) / Math.max(1, rect.height)) * 2, -1, 1));
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
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.touches.length === 2 && pinchRef.current) {
      const [a, b] = [event.touches[0], event.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      setZoom(clamp(pinchRef.current.zoom * (distance / Math.max(1, pinchRef.current.distance)), 1, 3));
      return;
    }
    if (event.touches.length === 1 && dragRef.current) {
      const touch = event.touches[0];
      setPanX(clamp(dragRef.current.panX + ((touch.clientX - dragRef.current.x) / Math.max(1, rect.width)) * 2, -1, 1));
      setPanY(clamp(dragRef.current.panY + ((touch.clientY - dragRef.current.y) / Math.max(1, rect.height)) * 2, -1, 1));
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
        <p className="mt-1 text-xs leading-5 text-slate-500">Automática, frame do vídeo ou imagem personalizada. Arraste para posicionar e use pinça ou −/+ para zoom.</p>
      </div>
      <div className="flex rounded-lg bg-white p-1 text-xs font-bold shadow-sm">
        {(["auto", "frame", "upload"] as CoverMode[]).map(value => <button key={value} type="button" onClick={() => { setMode(value); setError(""); }} className={`rounded-md px-2.5 py-1.5 ${mode === value ? "bg-indigo-600 text-white" : "text-slate-600"}`}>
          {value === "auto" ? "Automática" : value === "frame" ? "Frame" : "Enviar"}
        </button>)}
      </div>
    </div>

    {mode === "frame" && <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-700"><Video size={15}/> Escolher frame</div>
      <input type="range" min={0} max={Math.max(0, duration)} step={100} value={Math.min(frameMs, duration)} onChange={event => setFrameMs(Number(event.target.value))} className="mt-3 w-full"/>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500"><span>{(frameMs / 1000).toFixed(1)}s</span><span>{duration ? `${(duration / 1000).toFixed(1)}s` : "arraste e capture"}</span></div>
      <button type="button" disabled={busy} onClick={() => void chooseFrame()} className="btn-secondary mt-2 w-full disabled:opacity-50">Usar este frame</button>
    </div>}

    {mode === "upload" && <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-200 bg-white px-4 py-4 text-sm font-bold text-indigo-700">
      <Upload size={16}/> Enviar imagem de capa
      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={event => chooseUpload(event.target.files?.[0])}/>
    </label>}

    {mode !== "auto" && sourceUrl && <>
      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(aspectSizes) as Aspect[]).map(value => <button type="button" key={value} onClick={() => setAspect(value)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${aspect === value ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"}`}>{value}</button>)}
      </div>

      <div className="mt-3 flex justify-center">
        <div
          className="relative w-full max-w-[280px] touch-none cursor-move overflow-hidden rounded-xl bg-black shadow-inner"
          style={{ aspectRatio: ratio }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={endGesture}
        >
          <img src={sourceUrl} alt="Ajuste da capa" className="pointer-events-none h-full w-full select-none object-cover" style={{ transform: `translate(${panX * 14}%, ${panY * 14}%) scale(${zoom})`, transformOrigin: "center" }}/>
          <div className="pointer-events-none absolute inset-0 border border-white/40"/>
          <div className="pointer-events-none absolute inset-x-[9%] inset-y-[7%] rounded-lg border border-dashed border-white/50"/>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <button type="button" onClick={() => setZoom(current => clamp(current - 0.1, 1, 3))} className="btn-secondary !px-3"><Minus size={15}/></button>
        <span className="min-w-16 text-center text-xs font-bold text-slate-600">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom(current => clamp(current + 0.1, 1, 3))} className="btn-secondary !px-3"><Plus size={15}/></button>
        <button type="button" onClick={resetPosition} className="btn-secondary !px-3" title="Centralizar"><RotateCcw size={15}/></button>
      </div>
      <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-slate-500"><Move size={12}/> Arraste a imagem dentro da moldura para reposicionar.</p>
    </>}

    {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{error}</p>}

    <button type="button" disabled={busy || (mode !== "auto" && !sourceUrl)} onClick={() => void applyCover()} className="btn-primary mt-4 w-full disabled:opacity-40">
      {busy ? "Preparando capa..." : mode === "auto" ? "Usar capa automática" : "Aplicar capa"}
    </button>
  </div>;
}
