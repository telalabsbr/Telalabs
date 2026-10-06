"use client";

import { ChevronLeft, ChevronRight, CircleHelp, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultImageTransform,
  drawImageTransform,
  type ImageTransform,
  type MediaAspect,
} from "@/lib/media/image-transform";

type AdjustableItem = {
  id: string;
  previewUrl: string;
  transform: ImageTransform;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function aspectRatio(aspect: MediaAspect) {
  if (aspect === "9:16") return 9 / 16;
  if (aspect === "4:5") return 4 / 5;
  if (aspect === "1:1") return 1;
  return 16 / 9;
}

type TouchCollection = {\n  length: number;\n  [index: number]: { clientX: number; clientY: number };\n};\n\nfunction distance(touches: TouchCollection) {\n  if (touches.length < 2) return 0;\n  const dx = touches[0].clientX - touches[1].clientX;\n  const dy = touches[0].clientY - touches[1].clientY;\n  return Math.hypot(dx, dy);\n}

export function CarouselImageAdjuster({
  items,
  aspect,
  onChange,
  onDone,
}: {
  items: AdjustableItem[];
  aspect: MediaAspect;
  onChange: (id: string, transform: ImageTransform) => void;
  onDone?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const safeIndex = Math.min(index, Math.max(0, items.length - 1));
  const item = items[safeIndex];
  const transform = item?.transform ?? defaultImageTransform;
  const ratio = useMemo(() => aspectRatio(aspect), [aspect]);

  useEffect(() => {
    if (index >= items.length && items.length) setIndex(items.length - 1);
  }, [index, items.length]);

  useEffect(() => {
    if (!item?.previewUrl) {
      imageRef.current = null;
      return;
    }
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      imageRef.current = image;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      const width = aspect === "16:9" ? 720 : 540;
      const height = Math.round(width / ratio);
      canvas.width = width;
      canvas.height = height;
      drawImageTransform(context, image, image.naturalWidth, image.naturalHeight, width, height, transform);
    };
    image.src = item.previewUrl;
    return () => { active = false; };
  }, [item?.previewUrl, aspect, ratio]);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!image || !canvas || !context) return;
    drawImageTransform(context, image, image.naturalWidth, image.naturalHeight, canvas.width, canvas.height, transform);
  }, [transform.zoom, transform.panX, transform.panY]);

  function update(next: ImageTransform) {
    if (!item) return;
    onChange(item.id, {
      zoom: clamp(next.zoom, 1, 4),
      panX: clamp(next.panX, -1, 1),
      panY: clamp(next.panY, -1, 1),
    });
  }

  function applyDrag(clientX: number, clientY: number, element: HTMLElement) {
    const active = dragRef.current;
    if (!active) return;
    const rect = element.getBoundingClientRect();
    const dx = (clientX - active.x) / Math.max(1, rect.width);
    const dy = (clientY - active.y) / Math.max(1, rect.height);
    update({
      ...transform,
      panX: active.panX + dx * 2.1,
      panY: active.panY + dy * 2.1,
    });
  }

  return <div className="space-y-3">
    <div
      className="relative mx-auto w-full max-w-[360px] touch-none overflow-hidden rounded-xl bg-black shadow-sm"
      style={{ aspectRatio: ratio }}
      onPointerDown={event => {
        if (event.pointerType === "touch") return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { x: event.clientX, y: event.clientY, panX: transform.panX, panY: transform.panY };
      }}
      onPointerMove={event => applyDrag(event.clientX, event.clientY, event.currentTarget)}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerCancel={() => { dragRef.current = null; }}
      onTouchStart={event => {
        if (event.touches.length === 2) {
          pinchRef.current = { distance: distance(event.touches), zoom: transform.zoom };
          dragRef.current = null;
          return;
        }
        const touch = event.touches[0];
        if (touch) dragRef.current = { x: touch.clientX, y: touch.clientY, panX: transform.panX, panY: transform.panY };
      }}
      onTouchMove={event => {
        if (event.touches.length === 2 && pinchRef.current) {
          event.preventDefault();
          const currentDistance = distance(event.touches);
          if (currentDistance > 0 && pinchRef.current.distance > 0) {
            update({ ...transform, zoom: pinchRef.current.zoom * (currentDistance / pinchRef.current.distance) });
          }
          return;
        }
        const touch = event.touches[0];
        if (!touch) return;
        event.preventDefault();
        applyDrag(touch.clientX, touch.clientY, event.currentTarget);
      }}
      onTouchEnd={() => {
        dragRef.current = null;
        pinchRef.current = null;
      }}
    >
      <canvas ref={canvasRef} className="pointer-events-none h-full w-full select-none"/>
      {items.length > 1 && <>
        <button type="button" aria-label="Imagem anterior" onClick={event => { event.stopPropagation(); setIndex(current => (current - 1 + items.length) % items.length); }} className="absolute left-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-slate-950/65 text-white shadow"><ChevronLeft size={17}/></button>
        <button type="button" aria-label="Próxima imagem" onClick={event => { event.stopPropagation(); setIndex(current => (current + 1) % items.length); }} className="absolute right-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-slate-950/65 text-white shadow"><ChevronRight size={17}/></button>
      </>}
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-slate-950/65 px-2 py-1 text-[10px] font-black text-white">{safeIndex + 1}/{items.length}</span>
    </div>

    <div className="flex items-center justify-between gap-2">
      <details className="group relative">
        <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full border border-slate-200 bg-white text-slate-500"><CircleHelp size={15}/></summary>
        <div className="absolute left-0 top-10 z-30 w-56 rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] leading-4 text-slate-600 shadow-lg">
          Arraste para reenquadrar. No celular, use dois dedos para aproximar ou reduzir.
        </div>
      </details>
      <div className="flex gap-2">
        <button type="button" onClick={() => update({ ...defaultImageTransform })} className="btn-secondary !px-3 !py-2 text-xs"><RotateCcw size={14}/> Redefinir</button>
        {onDone && <button type="button" onClick={onDone} className="btn-primary !px-3 !py-2 text-xs">Concluir</button>}
      </div>
    </div>

    {items.length > 1 && <div className="flex justify-center gap-1.5">
      {items.map((entry, dotIndex) => <button key={entry.id} type="button" aria-label={`Ajustar imagem ${dotIndex + 1}`} onClick={() => setIndex(dotIndex)} className={`h-2 w-2 rounded-full ${dotIndex === safeIndex ? "bg-blue-600" : "bg-slate-300"}`}/>)}
    </div>}
  </div>;
}
