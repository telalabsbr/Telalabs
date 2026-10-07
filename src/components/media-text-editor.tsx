"use client";

import { CircleHelp, Type } from "lucide-react";
import { useState, type ReactNode } from "react";
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
  onTypingChange,
  value,
  showTimingControl = true,
  allowPositionToggle = true,
  editorAccessory,
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
  onTypingChange?: (typing: boolean) => void;
  value?: TextOverlayConfig;
  showTimingControl?: boolean;
  allowPositionToggle?: boolean;
  editorAccessory?: ReactNode;
}) {
  const [internalConfig, setInternalConfig] = useState<TextOverlayConfig>({ ...defaultTextOverlay });
  const config = value ?? internalConfig;
  const [currentMs, setCurrentMs] = useState(0);
  const [positionEditing, setPositionEditing] = useState(false);
  const [typing, setTyping] = useState(false);

  const aspectRatio = width && height && width > 0 && height > 0
    ? width / height
    : kind === "video" ? 9 / 16 : 4 / 5;

  function update(next: TextOverlayConfig) {
    if (value === undefined) setInternalConfig(next);
    onChange(null, null, next);
  }

  function toggleEditing() {
    const next = !positionEditing;
    setPositionEditing(next);
    onEditingChange?.(next);
  }

  const editor = <div className="space-y-3">
    {showPreview && <div
      data-overlay-stage
      className={`sticky top-2 z-20 mx-auto overflow-hidden rounded-xl bg-black shadow-sm transition-all sm:static ${typing ? "w-[140px] sm:w-full sm:max-w-[360px]" : "w-full max-w-[360px]"}`}
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

    {kind === "video" && showTimingControl && <TextTimingControl config={config} durationMs={durationMs} onChange={update}/>}

    <TextOverlayControls
      config={config}
      onChange={update}
      compact
      onTypingChange={next => {
        setTyping(next);
        onTypingChange?.(next);
      }}
      afterEmoji={editorAccessory}
    />

    {allowPositionToggle && <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={toggleEditing}
        className={`rounded-lg border px-3 py-2 text-xs font-black ${positionEditing ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}
      >
        {positionEditing ? "Concluir ajuste" : "Ajustar texto"}
      </button>
      <details className="group relative">
        <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors group-open:border-blue-600 group-open:bg-blue-600 group-open:text-white"><CircleHelp size={14}/></summary>
        <div className="absolute bottom-10 right-0 z-30 w-56 rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] leading-4 text-slate-600 shadow-lg">
          Ative para arrastar ou redimensionar o texto. Fora do texto, a página continua rolando normalmente.
        </div>
      </details>
    </div>}
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
    {title && <div className="mb-4">
      <p className="flex items-center gap-2 text-sm font-black text-slate-900"><Type size={16} className="text-blue-600"/>{title}</p>
    </div>}
    {editor}
  </div>;
}
