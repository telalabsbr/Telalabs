"use client";

import { Type } from "lucide-react";
import { useState } from "react";
import {
  defaultTextOverlay,
  overlayVisibleAt,
  type TextOverlayConfig,
} from "@/lib/media/text-overlay";
import {
  CollapsibleEditorShell,
  TextOverlayControls,
  TextOverlayLayer,
  TextTimingControl,
} from "./text-overlay-controls";

export function MediaTextEditor({
  sourceUrl,
  kind,
  width,
  height,
  durationMs,
  title,
  onChange,
  collapsible = false,
  defaultOpen = true,
}: {
  sourceFile: File;
  sourceUrl: string;
  kind: "image" | "video";
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  title: string;
  onChange: (file: File | null, previewUrl: string | null, config: TextOverlayConfig) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [config, setConfig] = useState<TextOverlayConfig>({ ...defaultTextOverlay });
  const [currentMs, setCurrentMs] = useState(0);

  const aspectRatio = width && height && width > 0 && height > 0
    ? width / height
    : kind === "video" ? 9 / 16 : 4 / 5;

  function update(next: TextOverlayConfig) {
    setConfig(next);
    onChange(null, null, next);
  }

  const editor = <div className="space-y-4">
    <div
      data-overlay-stage
      className="relative mx-auto w-full max-w-[360px] touch-none overflow-hidden rounded-xl bg-black shadow-sm"
      style={{ aspectRatio }}
    >
      {kind === "video"
        ? <video
            src={sourceUrl}
            muted
            playsInline
            controls
            preload="metadata"
            className="h-full w-full object-contain"
            onTimeUpdate={event => setCurrentMs(event.currentTarget.currentTime * 1000)}
            onSeeked={event => setCurrentMs(event.currentTarget.currentTime * 1000)}
          />
        : <img src={sourceUrl} alt="Prévia com texto" className="h-full w-full object-contain"/>}
      <TextOverlayLayer
        config={config}
        onChange={update}
        visible={kind !== "video" || overlayVisibleAt(config, currentMs, durationMs)}
      />
      <div className="pointer-events-none absolute inset-x-[6%] inset-y-[4%] rounded-lg border border-dashed border-white/35"/>
    </div>

    <TextOverlayControls config={config} onChange={update} compact/>

    {kind === "video" && <TextTimingControl config={config} durationMs={durationMs} onChange={update}/>} 

    <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-4 text-slate-500">
      As mudanças acima ficam definidas automaticamente. A mídia final só é processada ao salvar ou publicar, para manter o editor leve no celular.
    </p>
  </div>;

  if (collapsible) {
    return <CollapsibleEditorShell
      title={title}
      subtitle="Toque para adicionar ou editar texto e emojis"
      defaultOpen={defaultOpen}
      configured={!!config.text.trim()}
    >
      {editor}
    </CollapsibleEditorShell>;
  }

  return <div className="rounded-xl border border-blue-100 bg-blue-50/35 p-3 sm:p-4">
    <div className="mb-4">
      <p className="flex items-center gap-2 text-sm font-black text-slate-900"><Type size={16} className="text-blue-600"/>{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Edite diretamente sobre a mídia. Arraste e redimensione com o mouse ou com o dedo.</p>
    </div>
    {editor}
  </div>;
}
