"use client";

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
