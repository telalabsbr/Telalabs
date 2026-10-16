from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: esperado 1 ocorrência, encontrado {count}")
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# Composer
# -----------------------------------------------------------------------------
path = Path("src/components/publication-editor.tsx")
text = path.read_text()

text = replace_once(
    text,
    'import { VideoCoverEditor, type CoverSelection } from "./video-cover-editor";\n',
    'import { VideoCoverEditor, type CoverSelection } from "./video-cover-editor";\nimport { MediaTextEditor } from "./media-text-editor";\n',
    "import MediaTextEditor",
)

text = replace_once(
    text,
    '  const [instagramPlacement, setInstagramPlacement] = useState<InstagramPlacement>("feed");\n  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);',
    '  const [instagramPlacement, setInstagramPlacement] = useState<InstagramPlacement>("feed");\n  const [feedEditedFile, setFeedEditedFile] = useState<File | null>(null);\n  const [feedEditedPreviewUrl, setFeedEditedPreviewUrl] = useState<string | null>(null);\n  const [storyEditedFile, setStoryEditedFile] = useState<File | null>(null);\n  const [storyEditedPreviewUrl, setStoryEditedPreviewUrl] = useState<string | null>(null);\n  const [stagedStoryMedia, setStagedStoryMedia] = useState<{ key: string; mediaId: string } | null>(null);\n  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);',
    "overlay states",
)

text = replace_once(
    text,
    '    setStagedCover(null);\n    if (coverSelection.previewUrl) URL.revokeObjectURL(coverSelection.previewUrl);\n    setCoverSelection({ mode: "auto", file: null, previewUrl: null, aspect: "9:16" });',
    '    setStagedCover(null);\n    setStagedStoryMedia(null);\n    if (feedEditedPreviewUrl) URL.revokeObjectURL(feedEditedPreviewUrl);\n    if (storyEditedPreviewUrl) URL.revokeObjectURL(storyEditedPreviewUrl);\n    setFeedEditedFile(null);\n    setFeedEditedPreviewUrl(null);\n    setStoryEditedFile(null);\n    setStoryEditedPreviewUrl(null);\n    if (coverSelection.previewUrl) URL.revokeObjectURL(coverSelection.previewUrl);\n    setCoverSelection({ mode: "auto", file: null, previewUrl: null, aspect: "9:16" });',
    "handle file reset overlays",
)

text = replace_once(
    text,
    '    setStagedMedia(null);\n    setStagedCover(null);\n    setPublishComplete(false);',
    '    setStagedMedia(null);\n    setStagedCover(null);\n    setStagedStoryMedia(null);\n    if (feedEditedPreviewUrl) URL.revokeObjectURL(feedEditedPreviewUrl);\n    if (storyEditedPreviewUrl) URL.revokeObjectURL(storyEditedPreviewUrl);\n    setFeedEditedFile(null);\n    setFeedEditedPreviewUrl(null);\n    setStoryEditedFile(null);\n    setStoryEditedPreviewUrl(null);\n    setPublishComplete(false);',
    "remove file reset overlays",
)

text = replace_once(
    text,
    '    let mediaId: string | null = null;\n    if (selectedFile) {\n      const mediaKey = [selectedFile.name, selectedFile.size, selectedFile.lastModified, retention].join(":");',
    '    const baseMediaFile = selectedFile\n      ? (instagramPlacement === "story" ? selectedFile : (feedEditedFile ?? selectedFile))\n      : null;\n\n    let mediaId: string | null = null;\n    if (baseMediaFile) {\n      const mediaKey = [baseMediaFile.name, baseMediaFile.size, baseMediaFile.lastModified, retention].join(":");',
    "base edited media",
)

text = replace_once(
    text,
    '            file: selectedFile,\n            brandId: tenant.activeBrand.id,',
    '            file: baseMediaFile,\n            brandId: tenant.activeBrand.id,',
    "upload edited base",
)

anchor = '''    if (mediaId && postId) {
      const mediaResult = await client.rpc("attach_media_to_post", {
        p_post_id: postId,
        p_media_asset_id: mediaId,
      });

      if (mediaResult.error) {
        setSaveError("A publicação foi salva, mas não conseguimos vincular a mídia. Tente novamente antes de publicar.");
        setSaving(false);
        return;
      }
    }
'''
replacement = anchor + '''
    if (storyEditedFile && hasInstagram && instagramPlacement !== "feed" && postId) {
      const storyKey = [storyEditedFile.name, storyEditedFile.size, storyEditedFile.lastModified, retention].join(":");
      let storyMediaId = stagedStoryMedia?.key === storyKey ? stagedStoryMedia.mediaId : null;

      if (!storyMediaId) {
        setSaveMessage("Enviando versão dos Stories...");
        try {
          const uploadedStory = await uploadMediaFile({
            file: storyEditedFile,
            brandId: tenant.activeBrand.id,
            retention,
            metadata: mediaMetadata,
          });
          storyMediaId = uploadedStory.mediaId;
          setStagedStoryMedia({ key: storyKey, mediaId: uploadedStory.mediaId });
        } catch {
          setSaveError("A publicação foi salva, mas não conseguimos enviar a versão editada dos Stories.");
          setSaving(false);
          return;
        }
      }

      const storyMediaResult = await client.rpc("attach_media_to_surface_targets", {
        p_post_id: postId,
        p_provider: "instagram",
        p_surface: "story",
        p_media_asset_id: storyMediaId,
      });
      if (storyMediaResult.error) {
        setSaveError("A publicação foi salva, mas não conseguimos vincular a versão editada aos Stories.");
        setSaving(false);
        return;
      }
    }
'''
text = replace_once(text, anchor, replacement, "story specific media upload")

cover_block = '''          {fileType === "video" && previewUrl && hasInstagram && instagramPlacement !== "story" && <div className="mt-4">
            <VideoCoverEditor
              videoUrl={previewUrl}
              durationMs={mediaMetadata.durationMs}
              onChange={selection => {
                if (coverSelection.previewUrl && coverSelection.previewUrl !== selection.previewUrl) URL.revokeObjectURL(coverSelection.previewUrl);
                setCoverSelection(selection);
                setStagedCover(null);
                setSaveMessage(selection.mode === "auto" ? "Capa automática selecionada." : "Capa personalizada pronta.");
              }}
            />
          </div>}
'''
cover_replacement = cover_block + '''
          {fileType === "image" && previewUrl && selectedFile && instagramPlacement !== "story" && <div className="mt-4">
            <MediaTextEditor
              sourceFile={selectedFile}
              sourceUrl={previewUrl}
              kind="image"
              width={mediaMetadata.width}
              height={mediaMetadata.height}
              title="Texto na imagem do Feed"
              onChange={(file, nextPreviewUrl) => {
                if (feedEditedPreviewUrl && feedEditedPreviewUrl !== nextPreviewUrl) URL.revokeObjectURL(feedEditedPreviewUrl);
                setFeedEditedFile(file);
                setFeedEditedPreviewUrl(nextPreviewUrl);
                setStagedMedia(null);
              }}
            />
          </div>}

          {previewUrl && selectedFile && hasInstagram && instagramPlacement !== "feed" && <div className="mt-4">
            <MediaTextEditor
              sourceFile={selectedFile}
              sourceUrl={previewUrl}
              kind={fileType === "video" ? "video" : "image"}
              width={mediaMetadata.width}
              height={mediaMetadata.height}
              title="Texto nos Stories"
              onChange={(file, nextPreviewUrl) => {
                if (storyEditedPreviewUrl && storyEditedPreviewUrl !== nextPreviewUrl) URL.revokeObjectURL(storyEditedPreviewUrl);
                setStoryEditedFile(file);
                setStoryEditedPreviewUrl(nextPreviewUrl);
                setStagedStoryMedia(null);
              }}
            />
          </div>}
'''
text = replace_once(text, cover_block, cover_replacement, "media text editors")

old_format = '''          {hasInstagram && <div className="mt-4 rounded-xl border border-fuchsia-100 bg-fuchsia-50/60 p-4">
            <div>
              <p className="text-sm font-black text-slate-900">Instagram — onde publicar?</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Escolha como o conteúdo será enviado para todos os Instagrams selecionados.</p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {([
                { value: "feed" as const, label: "Feed / Reels", detail: "Só no perfil" },
                { value: "story" as const, label: "Stories", detail: "Só nos Stories" },
                { value: "both" as const, label: "Ambos", detail: "Feed/Reels + Stories" },
              ]).map(item => <button key={item.value} type="button" onClick={() => { setInstagramPlacement(item.value); setSaveMessage(""); }} aria-pressed={instagramPlacement === item.value} className={`rounded-xl border px-3 py-3 text-left transition-colors ${instagramPlacement === item.value ? "border-fuchsia-400 bg-white shadow-sm" : "border-fuchsia-100 bg-white/60 hover:bg-white"}`}>
                <span className={`block text-sm font-black ${instagramPlacement === item.value ? "text-fuchsia-800" : "text-slate-800"}`}>{item.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{item.detail}</span>
              </button>)}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">Cada formato vira um destino independente no envio. Se escolher <strong>Ambos</strong>, Feed/Reels e Stories terão status e retentativas separados.</p>
          </div>}
'''
new_format = '''          {hasInstagram && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <div>
              <p className="text-sm font-black text-slate-900">Formato da publicação</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Escolha onde o conteúdo deve aparecer.</p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {([
                { value: "feed" as const, label: "Feed / Reels", detail: "Só no perfil" },
                { value: "story" as const, label: "Stories", detail: "Só nos Stories" },
                { value: "both" as const, label: "Ambos", detail: "Feed/Reels + Stories" },
              ]).map(item => <button key={item.value} type="button" onClick={() => { setInstagramPlacement(item.value); setSaveMessage(""); }} aria-pressed={instagramPlacement === item.value} className={`rounded-xl border px-3 py-3 text-left transition-colors ${instagramPlacement === item.value ? "border-blue-500 bg-blue-600 shadow-sm" : "border-blue-100 bg-white hover:border-blue-200 hover:bg-blue-50"}`}>
                <span className={`block text-sm font-black ${instagramPlacement === item.value ? "text-white" : "text-slate-800"}`}>{item.label}</span>
                <span className={`mt-0.5 block text-xs ${instagramPlacement === item.value ? "text-blue-100" : "text-slate-500"}`}>{item.detail}</span>
              </button>)}
            </div>
          </div>}
'''
text = replace_once(text, old_format, new_format, "generic blue format selector")

text = replace_once(
    text,
    '<button onClick={() => setMode("now")} className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${mode === "now" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-700"}`}><Send size={16}/> Publicar agora</button>',
    '<button onClick={() => setMode("now")} className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${mode === "now" ? "border-blue-400 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700"}`}><Send size={16}/> Imediatamente</button>',
    "immediately label",
)

text = text.replace(
    'rounded-xl border border-fuchsia-100 bg-fuchsia-50 p-4 text-sm leading-6 text-fuchsia-800',
    'rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800',
)
text = text.replace(
    'rounded-xl border border-fuchsia-100 bg-fuchsia-50 p-3 text-xs font-semibold leading-5 text-fuchsia-800',
    'rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-800',
)

path.write_text(text)


# -----------------------------------------------------------------------------
# Video cover: text/emoji overlay is baked into the generated cover image.
# -----------------------------------------------------------------------------
path = Path("src/components/video-cover-editor.tsx")
text = path.read_text()

text = replace_once(
    text,
    'import { useEffect, useMemo, useRef, useState } from "react";\n',
    'import { useEffect, useMemo, useRef, useState } from "react";\nimport { defaultTextOverlay, drawTextOverlay, overlayFontLabels, type OverlayBackground, type OverlayFont, type TextOverlayConfig } from "@/lib/media/text-overlay";\n',
    "cover overlay imports",
)

text = replace_once(
    text,
    '  const [busy, setBusy] = useState(false);\n  const [error, setError] = useState("");',
    '  const [busy, setBusy] = useState(false);\n  const [error, setError] = useState("");\n  const [textOverlay, setTextOverlay] = useState<TextOverlayConfig>({ ...defaultTextOverlay });',
    "cover overlay state",
)

text = replace_once(
    text,
    '    drawCover(context, image, output.width, output.height, zoom, panX, panY);\n  }, [aspect, zoom, panX, panY, sourceSize]);',
    '    drawCover(context, image, output.width, output.height, zoom, panX, panY);\n    drawTextOverlay(context, output.width, output.height, textOverlay);\n  }, [aspect, zoom, panX, panY, sourceSize, textOverlay]);',
    "cover preview draw text",
)

text = replace_once(
    text,
    '      drawCover(context, image, output.width, output.height, zoom, panX, panY);\n\n      const blob = await canvasBlob(canvas, "image/jpeg", 0.92);',
    '      drawCover(context, image, output.width, output.height, zoom, panX, panY);\n      drawTextOverlay(context, output.width, output.height, textOverlay);\n\n      const blob = await canvasBlob(canvas, "image/jpeg", 0.92);',
    "cover export draw text",
)

insert_before_error = '''    {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{error}</p>}
'''
editor = '''    {mode !== "auto" && sourceUrl && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
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

'''
text = replace_once(text, insert_before_error, editor + insert_before_error, "cover text controls")
path.write_text(text)


# -----------------------------------------------------------------------------
# Supabase generated typing for the new surface-specific attachment RPC.
# -----------------------------------------------------------------------------
path = Path("src/lib/supabase/database.types.ts")
text = path.read_text()
text = replace_once(
    text,
    '''      attach_media_to_post: {
        Args: { p_media_asset_id: string; p_post_id: string }
        Returns: number
      }
''',
    '''      attach_media_to_post: {
        Args: { p_media_asset_id: string; p_post_id: string }
        Returns: number
      }
      attach_media_to_surface_targets: {
        Args: {
          p_media_asset_id: string
          p_post_id: string
          p_provider: string
          p_surface: string
        }
        Returns: number
      }
''',
    "database rpc type",
)
path.write_text(text)
