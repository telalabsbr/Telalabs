from pathlib import Path

path = Path("src/components/publication-editor.tsx")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str):
    global text
    if old not in text:
        raise SystemExit(f"trecho não encontrado: {label}")
    text = text.replace(old, new, 1)


replace_once(
    'import { prepareMediaFile, type PreparedMediaMetadata } from "@/lib/media/compatibility";\nimport { VideoCoverEditor, type CoverSelection } from "./video-cover-editor";\nimport { MediaTextEditor } from "./media-text-editor";',
    'import { prepareMediaFile, type PreparedMediaMetadata } from "@/lib/media/compatibility";\nimport { composeTextOnMedia, defaultTextOverlay, type TextOverlayConfig } from "@/lib/media/text-overlay";\nimport { VideoCoverEditor, type CoverSelection } from "./video-cover-editor";\nimport { MediaTextEditor } from "./media-text-editor";',
    "imports",
)

replace_once(
    '  const [feedEditedFile, setFeedEditedFile] = useState<File | null>(null);\n  const [feedEditedPreviewUrl, setFeedEditedPreviewUrl] = useState<string | null>(null);\n  const [storyEditedFile, setStoryEditedFile] = useState<File | null>(null);\n  const [storyEditedPreviewUrl, setStoryEditedPreviewUrl] = useState<string | null>(null);\n  const [stagedStoryMedia, setStagedStoryMedia] = useState<{ key: string; mediaId: string } | null>(null);',
    '  const [feedTextConfig, setFeedTextConfig] = useState<TextOverlayConfig>({ ...defaultTextOverlay });\n  const [storyTextConfig, setStoryTextConfig] = useState<TextOverlayConfig>({ ...defaultTextOverlay });\n  const [stagedStoryMedia, setStagedStoryMedia] = useState<{ key: string; mediaId: string } | null>(null);',
    "text states",
)

replace_once(
    '    if (feedEditedPreviewUrl) URL.revokeObjectURL(feedEditedPreviewUrl);\n    if (storyEditedPreviewUrl) URL.revokeObjectURL(storyEditedPreviewUrl);\n    setFeedEditedFile(null);\n    setFeedEditedPreviewUrl(null);\n    setStoryEditedFile(null);\n    setStoryEditedPreviewUrl(null);',
    '    setFeedTextConfig({ ...defaultTextOverlay });\n    setStoryTextConfig({ ...defaultTextOverlay });',
    "handleFile reset",
)

replace_once(
    '    if (feedEditedPreviewUrl) URL.revokeObjectURL(feedEditedPreviewUrl);\n    if (storyEditedPreviewUrl) URL.revokeObjectURL(storyEditedPreviewUrl);\n    setFeedEditedFile(null);\n    setFeedEditedPreviewUrl(null);\n    setStoryEditedFile(null);\n    setStoryEditedPreviewUrl(null);',
    '    setFeedTextConfig({ ...defaultTextOverlay });\n    setStoryTextConfig({ ...defaultTextOverlay });',
    "removeFile reset",
)

replace_once(
    '''    const baseMediaFile = selectedFile
      ? (instagramPlacement === "story" ? selectedFile : (feedEditedFile ?? selectedFile))
      : null;

    let mediaId: string | null = null;
''',
    '''    const selectedKind: "image" | "video" = fileType ?? (selectedFile?.type.startsWith("video/") ? "video" : "image");
    let baseMediaFile = selectedFile;
    let storyMediaFile: File | null = null;

    try {
      if (selectedFile && instagramPlacement === "story" && storyTextConfig.text.trim()) {
        setSaveMessage(selectedKind === "video" ? "Preparando texto no Story..." : "Preparando imagem do Story...");
        baseMediaFile = await composeTextOnMedia(selectedFile, selectedKind, storyTextConfig, (progress, message) => {
          setUploadProgress(progress);
          setSaveMessage(message);
        });
      } else if (selectedFile && instagramPlacement !== "story" && feedTextConfig.text.trim()) {
        setSaveMessage(selectedKind === "video" ? "Preparando texto no vídeo..." : "Preparando texto na imagem...");
        baseMediaFile = await composeTextOnMedia(selectedFile, selectedKind, feedTextConfig, (progress, message) => {
          setUploadProgress(progress);
          setSaveMessage(message);
        });
      }

      if (selectedFile && instagramPlacement === "both" && (storyTextConfig.text.trim() || feedTextConfig.text.trim())) {
        if (storyTextConfig.text.trim()) {
          setSaveMessage(selectedKind === "video" ? "Preparando versão dos Stories..." : "Preparando imagem dos Stories...");
          storyMediaFile = await composeTextOnMedia(selectedFile, selectedKind, storyTextConfig, (progress, message) => {
            setUploadProgress(progress);
            setSaveMessage(message);
          });
        } else {
          storyMediaFile = selectedFile;
        }
      }
    } catch (overlayError) {
      const code = overlayError instanceof Error ? overlayError.message : "text_overlay_failed";
      setSaveError(code === "text_overlay_video_too_large"
        ? "Este vídeo é grande demais para aplicar texto no navegador. Remova o texto do vídeo ou use um arquivo menor."
        : "Não foi possível preparar o texto sobre a mídia. Revise a edição e tente novamente.");
      setSaveMessage("");
      setUploadProgress(null);
      setSaving(false);
      return;
    }

    let mediaId: string | null = null;
''',
    "compose before upload",
)

replace_once(
    '''    if (storyEditedFile && hasInstagram && instagramPlacement !== "feed" && postId) {
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
''',
    '''    if (storyMediaFile && hasInstagram && instagramPlacement === "both" && postId) {
      const storyKey = [storyMediaFile.name, storyMediaFile.size, storyMediaFile.lastModified, retention].join(":");
      let storyMediaId = stagedStoryMedia?.key === storyKey ? stagedStoryMedia.mediaId : null;

      if (!storyMediaId) {
        setSaveMessage("Enviando versão dos Stories...");
        try {
          const uploadedStory = await uploadMediaFile({
            file: storyMediaFile,
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
''',
    "story surface file",
)

old_editors = '''          {fileType === "image" && previewUrl && selectedFile && instagramPlacement !== "story" && <div className="mt-4">
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
new_editors = '''          {previewUrl && selectedFile && instagramPlacement !== "story" && <div className="mt-4">
            <MediaTextEditor
              sourceFile={selectedFile}
              sourceUrl={previewUrl}
              kind={fileType === "video" ? "video" : "image"}
              width={mediaMetadata.width}
              height={mediaMetadata.height}
              durationMs={mediaMetadata.durationMs}
              title={fileType === "video" ? "Texto no vídeo" : "Texto na imagem do Feed"}
              collapsible={fileType === "video"}
              defaultOpen={fileType !== "video"}
              onChange={(_file, _nextPreviewUrl, config) => {
                setFeedTextConfig(config);
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
              durationMs={mediaMetadata.durationMs}
              title="Texto nos Stories"
              collapsible
              defaultOpen={false}
              onChange={(_file, _nextPreviewUrl, config) => {
                setStoryTextConfig(config);
                setStagedStoryMedia(null);
              }}
            />
          </div>}
'''
replace_once(old_editors, new_editors, "media editors")

path.write_text(text, encoding="utf-8")
print("publication-editor.tsx atualizado")
