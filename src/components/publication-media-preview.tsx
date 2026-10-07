"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { overlayVisibleAtEdge, type TextOverlayConfig, type TextOverlayEdge } from "@/lib/media/text-overlay";
import { TextOverlayLayer } from "./text-overlay-controls";
import { defaultImageTransform, drawImageTransform, type ImageTransform, type MediaAspect } from "@/lib/media/image-transform";

export type CarouselPreviewItem = { id: string; previewUrl: string; transform?: ImageTransform; adjusted?: boolean };

function aspectRatio(aspect: MediaAspect) {
  if (aspect === "9:16") return 9 / 16;
  if (aspect === "4:5") return 4 / 5;
  if (aspect === "3:4") return 3 / 4;
  if (aspect === "1:1") return 1;
  return 16 / 9;
}

function TransformedCarouselImage({
  url,
  transform,
  aspect,
}: {
  url: string;
  transform: ImageTransform;
  aspect: MediaAspect;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      imageRef.current = image;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      const width = aspect === "16:9" ? 720 : 540;
      const height = Math.round(width / aspectRatio(aspect));
      canvas.width = width;
      canvas.height = height;
      drawImageTransform(context, image, image.naturalWidth, image.naturalHeight, width, height, transform);
    };
    image.src = url;
    return () => { active = false; };
  }, [url, aspect]);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!image || !canvas || !context) return;
    drawImageTransform(context, image, image.naturalWidth, image.naturalHeight, canvas.width, canvas.height, transform);
  }, [transform.zoom, transform.panX, transform.panY]);

  return <canvas ref={canvasRef} className="pointer-events-none h-full w-full select-none"/>;
}

export function PublicationMediaPreview({
  previewUrl,
  fileType,
  textConfig,
  textEdge = "both",
  secondaryTextConfig,
  secondaryTextEdge = "both",
  durationMs,
  posterUrl,
  carouselItems = [],
  interactive = false,
  onTextChange,
  fit = "cover",
  aspect = "9:16",
}: {
  previewUrl: string | null;
  fileType: "image" | "video" | null;
  textConfig: TextOverlayConfig;
  textEdge?: TextOverlayEdge;
  secondaryTextConfig?: TextOverlayConfig;
  secondaryTextEdge?: TextOverlayEdge;
  durationMs?: number | null;
  posterUrl?: string | null;
  carouselItems?: CarouselPreviewItem[];
  interactive?: boolean;
  onTextChange?: (config: TextOverlayConfig) => void;
  fit?: "cover" | "contain";
  aspect?: MediaAspect;
}) {
  const [currentMs, setCurrentMs] = useState(0);
  const [index, setIndex] = useState(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const isCarousel = carouselItems.length > 1;
  const safeIndex = Math.min(index, Math.max(0, carouselItems.length - 1));
  const activeCarouselItem = isCarousel ? carouselItems[safeIndex] : undefined;
  const activeUrl = activeCarouselItem?.previewUrl ?? previewUrl;
  const visible = fileType !== "video" || interactive || overlayVisibleAtEdge(textConfig, currentMs, durationMs, textEdge);
  const secondaryVisible = !!secondaryTextConfig && (fileType !== "video" || overlayVisibleAtEdge(secondaryTextConfig, currentMs, durationMs, secondaryTextEdge));

  useEffect(() => {
    if (index >= carouselItems.length && carouselItems.length) setIndex(carouselItems.length - 1);
  }, [carouselItems.length, index]);

  const dots = useMemo(() => carouselItems.map(item => item.id), [carouselItems]);

  function moveCarousel(delta: -1 | 1) {
    if (!carouselItems.length) return;
    setIndex(current => (current + delta + carouselItems.length) % carouselItems.length);
  }

  return <div
    data-overlay-stage
    className="relative h-full w-full touch-pan-y overflow-hidden"
    onTouchStart={event => {
      if (!isCarousel || interactive || event.touches.length !== 1) return;
      swipeStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }}
    onTouchEnd={event => {
      const start = swipeStart.current;
      swipeStart.current = null;
      if (!start || !isCarousel || interactive) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return;
      moveCarousel(dx < 0 ? 1 : -1);
    }}
  >
    {activeUrl && (fileType === "video" && !isCarousel
      ? <video
          src={activeUrl}
          poster={posterUrl || undefined}
          className={`h-full w-full ${interactive ? "pointer-events-none" : "touch-pan-y"} ${fit === "contain" ? "object-contain" : "object-cover"}`}
          controls
          playsInline
          preload="metadata"
          onTimeUpdate={event => setCurrentMs(event.currentTarget.currentTime * 1000)}
          onSeeked={event => setCurrentMs(event.currentTarget.currentTime * 1000)}
        />
      : activeCarouselItem?.adjusted
        ? <TransformedCarouselImage url={activeUrl} transform={activeCarouselItem.transform ?? defaultImageTransform} aspect={aspect}/>
        : <img src={activeUrl} alt="Prévia final da mídia" className={`h-full w-full ${interactive ? "pointer-events-none" : "touch-pan-y"} ${fit === "contain" ? "object-contain" : "object-cover"}`}/>)}

    {activeUrl && secondaryTextConfig && <TextOverlayLayer config={secondaryTextConfig} onChange={() => {}} visible={secondaryVisible} interactive={false}/>}
    {activeUrl && <TextOverlayLayer config={textConfig} onChange={onTextChange ?? (() => {})} visible={visible} interactive={interactive}/>} 

    {isCarousel && <>
      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-950/55 px-1.5 py-1">
        <button type="button" aria-label="Imagem anterior" onClick={() => moveCarousel(-1)} className="grid h-7 w-7 place-items-center rounded-full text-white"><ChevronLeft size={16}/></button>
        <div className="flex items-center gap-1">
          {dots.map((id, dotIndex) => <button key={id} type="button" aria-label={`Ver imagem ${dotIndex + 1}`} onClick={() => setIndex(dotIndex)} className={`h-1.5 w-1.5 rounded-full ${dotIndex === safeIndex ? "bg-white" : "bg-white/45"}`}/>) }
        </div>
        <button type="button" aria-label="Próxima imagem" onClick={() => moveCarousel(1)} className="grid h-7 w-7 place-items-center rounded-full text-white"><ChevronRight size={16}/></button>
      </div>
      <span className="absolute right-2 top-2 z-10 rounded-full bg-slate-950/65 px-2 py-1 text-[10px] font-black text-white">{safeIndex + 1}/{carouselItems.length}</span>
    </>}
  </div>;
}
