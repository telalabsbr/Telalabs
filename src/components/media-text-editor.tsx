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
  showPreview = true,
  open,
  onOpenChange,
  onEditingChange,
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
  showPreview?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [config, setConfig] = useState<TextOverlayConfig>({ ...defaultTextOverlay });
  const [currentMs, setCurrentMs] = useState(0);
  const [positionEditing, setPositionEditing] = useState(false);

  const aspectRatio = width && height && width > 0 && height > 0
    ? width / height
    : kind === "video" ? 9 / 16 : 4 / 5;

  function update(next: TextOverlayConfig) {
    setConfig(next);
    onChange(null, null, next);
  }

  function toggleEditing() {
    const next = !positionEditing;
    setPositionEditing(next);
    onEditingChange?.(next);
  }

  const editor = <div className="space-y-4">
    {showPreview && <div
      data-overlay-stage
      className={`sticky top-2 z-10 mx-auto w-full max-w-[360px] overflow-hidden rounded-xl bg-black shadow-sm sm:static ${positionEditing ? "touch-none" : "touch-pan-y"}`}
      style={{ aspectRatio }}
    >
      {kind === "video"
        ? <video
            src={sourceUrl}
            muted
            playsInline
            controls
            preload="metadata"
            className="h-full w-full touch-pan-y object-contain"
            onTimeUpdate={event => setCurrentMs(event.currentTarget.currentTime * 1000)}
            onSeeked={event => setCurrentMs(event.currentTarget.currentTime * 1000)}
          />
        : <img src={sourceUrl} alt="Prévia com texto" className="h-full w-full touch-pan-y object-contain"/>}
      <TextOverlayLayer
        config={config}
        onChange={update}
        visible={kind !== "video" || overlayVisibleAt(config, currentMs, durationMs)}
        interactive={positionEditing}
      />
      <div className="pointer-events-none absolute inset-x-[6%] inset-y-[4%] rounded-lg border border-dashed border-white/35"/>
    </div>}

    <div className="flex justify-center">
      <button
        type="button"
        onClick={toggleEditing}
        className={`rounded-lg border px-3 py-2 text-xs font-black ${positionEditing ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}
      >
        {positionEditing ? "Concluir ajuste" : "Ajustar texto na mídia"}
      </button>
    </div>
    <p className="text-center text-[11px] leading-4 text-slate-500">{positionEditing ? "Enquanto ajusta, arraste o texto e use o canto para redimensionar." : "A mídia está bloqueada para edição por toque; você pode rolar a página normalmente sobre ela."}</p>

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
      open={open}
      onOpenChange={next => {
        if (!next && positionEditing) {
          setPositionEditing(false);
          onEditingChange?.(false);
        }
        onOpenChange?.(next);
      }}
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
