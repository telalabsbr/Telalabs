"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { overlayVisibleAt, type TextOverlayConfig } from "@/lib/media/text-overlay";
import { TextOverlayLayer } from "./text-overlay-controls";
import { defaultImageTransform, drawImageTransform, type ImageTransform, type MediaAspect } from "@/lib/media/image-transform";

export type CarouselPreviewItem = { id: string; previewUrl: string; transform?: ImageTransform; adjusted?: boolean };

function aspectRatio(aspect: MediaAspect) {
  if (aspect === "9:16") return 9 / 16;
  if (aspect === "4:5") return 4 / 5;
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
  const isCarousel = carouselItems.length > 1;
  const safeIndex = Math.min(index, Math.max(0, carouselItems.length - 1));
  const activeCarouselItem = isCarousel ? carouselItems[safeIndex] : undefined;
  const activeUrl = activeCarouselItem?.previewUrl ?? previewUrl;
  const visible = fileType !== "video" || overlayVisibleAt(textConfig, currentMs, durationMs);

  useEffect(() => {
    if (index >= carouselItems.length && carouselItems.length) setIndex(carouselItems.length - 1);
  }, [carouselItems.length, index]);

  const dots = useMemo(() => carouselItems.map(item => item.id), [carouselItems]);

  return <div data-overlay-stage className="relative h-full w-full touch-pan-y overflow-hidden">
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

    {activeUrl && <TextOverlayLayer config={textConfig} onChange={onTextChange ?? (() => {})} visible={visible} interactive={interactive}/>} 

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
