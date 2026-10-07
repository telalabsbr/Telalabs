"use client";

import { CircleHelp, Minus, Plus, RotateCcw, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultTextOverlay, drawTextOverlay, type TextOverlayConfig } from "@/lib/media/text-overlay";
import { TextOverlayControls, TextOverlayLayer } from "./text-overlay-controls";

type CoverMode = "auto" | "frame" | "upload";
export type CoverAspect = "9:16" | "4:5" | "1:1" | "16:9";
type Aspect = CoverAspect;

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
    if (video.readyState >= 2) {
      resolve();
      return;
    }
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("cover_video_decode_failed"));
  });

  const maxTime = Math.max(0, (video.duration || 0) - 0.03);
  const firstRenderableTime = Math.min(maxTime, Math.max(0.06, (video.duration || 0) * 0.005));
  const requestedTime = timeSeconds <= 0.001 ? firstRenderableTime : timeSeconds;
  const safeTime = clamp(requestedTime, 0, maxTime);
  await new Promise<void>((resolve, reject) => {
    const finish = () => resolve();
    video.onseeked = finish;
    video.onerror = () => reject(new Error("cover_video_seek_failed"));
    video.currentTime = safeTime;
    if (Math.abs(video.currentTime - safeTime) < 0.001 && video.readyState >= 2) {
      requestAnimationFrame(finish);
    }
  });

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
  aspect,
  onChange,
}: {
  videoUrl: string;
  durationMs: number | null;
  aspect: CoverAspect;
  onChange: (selection: CoverSelection) => void;
}) {
  const [mode, setMode] = useState<CoverMode>("auto");
  const [frameMs, setFrameMs] = useState(0);
  const [detectedDurationMs, setDetectedDurationMs] = useState(0);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("capa");
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [busyFrame, setBusyFrame] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);
  const [error, setError] = useState("");
  const [textOverlay, setTextOverlay] = useState<TextOverlayConfig>({ ...defaultTextOverlay });
  const [coverEditMode, setCoverEditMode] = useState<"none" | "frame" | "text">("none");
  const [typingText, setTypingText] = useState(false);
  const ownedUrl = useRef<string | null>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const exportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureToken = useRef(0);
  const onChangeRef = useRef(onChange);

  const duration = Math.max(0, durationMs ?? detectedDurationMs);
  const ratio = useMemo(() => {
    const size = aspectSizes[aspect];
    return size.width / size.height;
  }, [aspect]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => () => {
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    if (exportTimer.current) clearTimeout(exportTimer.current);
  }, []);

  useEffect(() => {
    if (mode === "auto") {
      setSourceUrl(null);
      onChangeRef.current({ mode: "auto", file: null, previewUrl: null, aspect });
    }
  }, [mode, aspect]);

  useEffect(() => {
    if (mode !== "frame") return;
    const token = ++captureToken.current;
    const timer = setTimeout(() => {
      setBusyFrame(true);
      setError("");
      void captureVideoFrame(videoUrl, frameMs / 1000)
        .then(blob => {
          if (token !== captureToken.current) return;
          if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
          const url = URL.createObjectURL(blob);
          ownedUrl.current = url;
          setSourceUrl(url);
          setSourceName("frame-video");
          setZoom(1);
          setPanX(0);
          setPanY(0);
        })
        .catch(() => {
          if (token === captureToken.current) setError("Não foi possível capturar este frame. Tente outro ponto do vídeo.");
        })
        .finally(() => {
          if (token === captureToken.current) setBusyFrame(false);
        });
    }, 140);
    return () => clearTimeout(timer);
  }, [mode, frameMs, videoUrl]);

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
  }, [aspect, zoom, panX, panY, sourceSize]);

  useEffect(() => {
    if (mode === "auto" || !sourceUrl || !sourceSize.width || !sourceSize.height) return;
    if (exportTimer.current) clearTimeout(exportTimer.current);
    exportTimer.current = setTimeout(() => {
      const image = sourceImageRef.current;
      if (!image) return;
      setSavingAuto(true);
      setError("");
      try {
        const output = aspectSizes[aspect];
        const canvas = document.createElement("canvas");
        canvas.width = output.width;
        canvas.height = output.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("cover_canvas_failed");
        drawCover(context, image, output.width, output.height, zoom, panX, panY);
        drawTextOverlay(context, output.width, output.height, textOverlay);
        void canvasBlob(canvas, "image/jpeg", 0.92)
          .then(blob => {
            const file = new File([blob], `${sourceName}-${aspect.replace(":", "x")}.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            const previewUrl = URL.createObjectURL(blob);
            onChangeRef.current({ mode, file, previewUrl, aspect });
          })
          .catch(() => setError("Não foi possível gerar a capa ajustada."))
          .finally(() => setSavingAuto(false));
      } catch {
        setSavingAuto(false);
        setError("Não foi possível gerar a capa ajustada.");
      }
    }, 260);
    return () => {
      if (exportTimer.current) clearTimeout(exportTimer.current);
    };
  }, [mode, sourceUrl, sourceSize, aspect, zoom, panX, panY, textOverlay, sourceName]);

  function chooseUpload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Escolha uma imagem para a capa.");
      return;
    }
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    const url = URL.createObjectURL(file);
    ownedUrl.current = url;
    setSourceUrl(url);
    setSourceName(file.name.replace(/\.[^.]+$/, "") || "capa");
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setError("");
  }

  function resetPosition() {
    setZoom(1);
    setPanX(0);
    setPanY(0);
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
    if (coverEditMode !== "frame" || !sourceUrl || event.pointerType === "touch") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, panX, panY };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || event.pointerType === "touch") return;
    applyDrag(event.clientX, event.clientY, event.currentTarget);
  }

  function onTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (coverEditMode !== "frame") return;
    if (event.touches.length === 2) {
      const [a, b] = [event.touches[0], event.touches[1]];
      pinchRef.current = { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom };
    } else if (event.touches.length === 1) {
      const touch = event.touches[0];
      dragRef.current = { x: touch.clientX, y: touch.clientY, panX, panY };
    }
  }

  function onTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (coverEditMode !== "frame") return;
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

  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-black text-slate-900">Capa do vídeo</p>
        <details className="group relative">
          <summary className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors group-open:border-blue-600 group-open:bg-blue-600 group-open:text-white"><CircleHelp size={13}/></summary>
          <div className="absolute left-0 top-9 z-30 w-56 rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] leading-4 text-slate-600 shadow-lg">Escolha uma capa automática, um frame do vídeo ou envie uma imagem. Depois ajuste enquadramento e texto.</div>
        </details>
      </div>
      <div className="flex max-w-full rounded-lg bg-white p-1 text-xs font-bold shadow-sm">
        {(["auto", "frame", "upload"] as CoverMode[]).map(value => <button key={value} type="button" onClick={() => { setMode(value); setError(""); }} className={`rounded-md px-2.5 py-1.5 ${mode === value ? "bg-blue-600 text-white" : "text-slate-600"}`}>
          {value === "auto" ? "Automática" : value === "frame" ? "Frame" : "Enviar"}
        </button>)}
      </div>
    </div>

    {mode === "auto" && <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-center text-xs font-semibold text-slate-500">Capa automática</div>}

    {mode === "frame" && <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-700"><span>Escolher frame</span><span className="text-blue-600">{(frameMs / 1000).toFixed(1)}s</span></div>
      <input type="range" min={0} max={Math.max(0, duration)} step={100} value={Math.min(frameMs, duration)} onChange={event => setFrameMs(Number(event.target.value))} className="mt-3 w-full"/>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500"><span>0s</span><span>{duration ? `${(duration / 1000).toFixed(1)}s` : "carregando duração..."}</span></div>
    </div>}

    {mode === "upload" && !sourceUrl && <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-blue-200 bg-white px-4 py-4 text-sm font-bold text-blue-700">
      <Upload size={16}/> Enviar imagem de capa
      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={event => chooseUpload(event.target.files?.[0])}/>
    </label>}

    {mode === "upload" && sourceUrl && <div className="mt-3 flex justify-end"><label className="btn-secondary cursor-pointer !px-3 !py-2 text-xs"><Upload size={14}/> Trocar imagem<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={event => chooseUpload(event.target.files?.[0])}/></label></div>}

    {mode !== "auto" && <div className="mt-4">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => { endGesture(); setCoverEditMode(current => current === "frame" ? "none" : "frame"); }} className={`rounded-lg border px-1.5 py-2 text-[10px] font-black leading-tight sm:px-2 sm:text-xs ${coverEditMode === "frame" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
          {coverEditMode === "frame" ? "Concluir enquadramento" : "Ajustar enquadramento"}
        </button>
        <button type="button" onClick={() => { endGesture(); setCoverEditMode(current => current === "text" ? "none" : "text"); }} className={`rounded-lg border px-1.5 py-2 text-[10px] font-black leading-tight sm:px-2 sm:text-xs ${coverEditMode === "text" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
          {coverEditMode === "text" ? "Concluir texto" : "Ajustar texto"}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-center">
        <details className="group relative">
          <summary className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-full border border-slate-200 bg-white/70 text-slate-500 transition-colors group-open:border-blue-600 group-open:bg-blue-600 group-open:text-white"><CircleHelp size={13}/></summary>
          <div className="absolute left-1/2 top-9 z-30 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] leading-4 text-slate-600 shadow-lg">
            Use dois dedos para ampliar ou reduzir e arraste para reenquadrar a mídia. Para reposicionar ou redimensionar o texto, ative “Ajustar texto” e mexa diretamente no texto sobre a mídia.
          </div>
        </details>
      </div>

      <div className="mt-2 hidden items-center justify-center gap-2 sm:flex">
        <button type="button" onClick={() => setZoom(current => clamp(current - 0.1, 1, 4))} className="btn-secondary !px-3"><Minus size={15}/></button>
        <span className="min-w-16 text-center text-xs font-bold text-slate-600">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom(current => clamp(current + 0.1, 1, 4))} className="btn-secondary !px-3"><Plus size={15}/></button>
        <button type="button" onClick={resetPosition} className="btn-secondary !px-3" title="Centralizar imagem"><RotateCcw size={15}/></button>
      </div>

      <div className="mt-3 flex justify-center">
        <div
          data-overlay-stage
          className={`sticky top-2 z-10 relative overflow-hidden rounded-xl bg-black shadow-inner transition-all sm:static ${typingText ? "w-[140px] sm:w-full sm:max-w-[360px]" : "w-full max-w-[360px]"} ${coverEditMode === "frame" ? "touch-none" : "touch-pan-y"}`}
          style={{ aspectRatio: ratio }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={endGesture}
        >
          {sourceUrl ? <canvas ref={previewCanvasRef} className="pointer-events-none h-full w-full select-none"/> : <div className="grid h-full place-items-center px-6 text-center text-xs text-white/70">{busyFrame ? "Carregando frame..." : "Escolha um ponto do vídeo."}</div>}
          <TextOverlayLayer config={textOverlay} onChange={setTextOverlay} visible={!!sourceUrl} interactive={coverEditMode === "text"}/>
          <div className="pointer-events-none absolute inset-x-[7%] inset-y-[5%] rounded-lg border border-dashed border-white/40"/>
        </div>
      </div>

      <div className="mt-2 rounded-xl border border-blue-100 bg-white p-3 sm:p-4">
        <p className="mb-3 text-xs font-black text-slate-900">Texto e emojis na capa <span className="font-semibold text-slate-400">(opcional)</span></p>
        <TextOverlayControls config={textOverlay} onChange={setTextOverlay} compact onTypingChange={setTypingText}/>
      </div>

      {(savingAuto || busyFrame) && <p className="mt-3 text-center text-[11px] font-semibold text-slate-500">Atualizando capa...</p>}
    </div>}

    {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{error}</p>}
  </div>;
}
