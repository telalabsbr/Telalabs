from pathlib import Path

path = Path("src/components/publication-editor.tsx")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit("Trecho esperado não encontrado:\n" + old[:220])
    text = text.replace(old, new, 1)


replace_once(
    'import { uploadMediaFile } from "@/lib/media/upload";\n',
    'import { uploadMediaFile } from "@/lib/media/upload";\nimport { prepareMediaFile, type PreparedMediaMetadata } from "@/lib/media/compatibility";\n',
)

replace_once(
    '  const [uploadProgress, setUploadProgress] = useState<number | null>(null);\n  const [stagedMedia, setStagedMedia] = useState<{ key: string; mediaId: string } | null>(null);',
    '  const [uploadProgress, setUploadProgress] = useState<number | null>(null);\n  const [mediaNotice, setMediaNotice] = useState("");\n  const [mediaMetadata, setMediaMetadata] = useState<PreparedMediaMetadata>({ durationMs: null, width: null, height: null });\n  const [stagedMedia, setStagedMedia] = useState<{ key: string; mediaId: string } | null>(null);',
)

replace_once(
    '''  function handleFile(file?: File) {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFileName(file.name);
    setFileType(file.type.startsWith("video/") ? "video" : "image");
    setFileSize(file.size);
    setSelectedFile(file);
    setUploadProgress(null);
    setStagedMedia(null);
    setPreviewUrl(URL.createObjectURL(file));
  }''',
    '''  async function handleFile(file?: File) {
    if (!file) return;
    setSaveError("");
    setSaveMessage("Preparando mídia...");
    setMediaNotice("");

    try {
      const prepared = await prepareMediaFile(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFileName(prepared.file.name);
      setFileType(prepared.kind);
      setFileSize(prepared.file.size);
      setSelectedFile(prepared.file);
      setMediaMetadata(prepared.metadata);
      setMediaNotice(prepared.notice ?? "");
      setUploadProgress(null);
      setStagedMedia(null);
      setPreviewUrl(URL.createObjectURL(prepared.file));
      setSaveMessage(prepared.notice ? "Mídia adaptada automaticamente." : "Mídia pronta.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "unsupported_media_type";
      const messages: Record<string, string> = {
        animated_gif_requires_video_conversion: "GIF animado ainda precisa ser convertido para vídeo MP4 antes da publicação.",
        audio_requires_visual: "Áudio sozinho ainda não pode ser publicado. Na próxima etapa o Tela poderá gerar um vídeo com capa para MP3/WAV.",
        video_format_requires_conversion: "Este formato de vídeo ainda precisa ser convertido para MP4 ou MOV.",
        image_format_requires_conversion: "Este formato de imagem ainda não pode ser convertido automaticamente.",
        image_conversion_not_supported_in_browser: "Este arquivo não pôde ser convertido neste navegador. Tente JPG, PNG, WebP ou AVIF.",
        image_conversion_failed: "Não foi possível converter esta imagem automaticamente.",
        image_decode_failed: "A imagem não pôde ser lida. Verifique se o arquivo está íntegro.",
        unsupported_media_type: "Este tipo de arquivo ainda não é suportado para publicação.",
      };
      setSaveError(messages[code] ?? "Não foi possível preparar esta mídia para publicação.");
      setSaveMessage("");
    }
  }''',
)

replace_once(
    '''    setSelectedFile(null);
    setUploadProgress(null);
    setStagedMedia(null);''',
    '''    setSelectedFile(null);
    setUploadProgress(null);
    setMediaNotice("");
    setMediaMetadata({ durationMs: null, width: null, height: null });
    setStagedMedia(null);''',
)

replace_once(
    '''    if (tenant.source === "supabase" && option.status !== "connected") return { option, level: "error" as const, text: "Conta precisa ser reconectada" };

    if (option.contentIntent === "LONG_FORM") {''',
    '''    if (tenant.source === "supabase" && option.status !== "connected") return { option, level: "error" as const, text: "Conta precisa ser reconectada" };

    if (option.platform === "instagram") {
      if (!fileType && !existingMedia) return { option, level: "error" as const, text: "Adicione uma imagem ou vídeo" };
      if (fileType === "video" && mediaMetadata.durationMs !== null && mediaMetadata.durationMs < 3_000) return { option, level: "error" as const, text: "Reel precisa ter ao menos 3 segundos" };
      if (fileType === "video" && mediaMetadata.durationMs !== null && mediaMetadata.durationMs > 15 * 60 * 1000) return { option, level: "error" as const, text: "Reel ultrapassa 15 minutos" };
      if (fileType === "video" && mediaMetadata.width !== null && mediaMetadata.width > 1920) return { option, level: "error" as const, text: "Reduza a largura do Reel para até 1920 px" };
      if (fileType === "video" && fileSize > 1024 * 1024 * 1024) return { option, level: "error" as const, text: "Reel ultrapassa 1 GB" };
    }

    if (option.contentIntent === "LONG_FORM") {''',
)

replace_once(
    '''            retention,
            onProgress: progress => {''',
    '''            retention,
            metadata: mediaMetadata,
            onProgress: progress => {''',
)

replace_once(
    '''            unsupported_media_type: "Este tipo de arquivo ainda não é suportado.",
            upload_part_missing_etag:''',
    '''            unsupported_media_type: "Este tipo de arquivo ainda não é suportado.",
            invalid_media_request: "Os dados técnicos da mídia não puderam ser validados.",
            upload_part_missing_etag:''',
)

replace_once(
    '''              <p className="mt-1 text-sm leading-5 text-slate-500 sm:text-xs">
                {fileSize ? `${(fileSize / (1024 * 1024)).toFixed(fileSize >= 1024 * 1024 * 1024 ? 0 : 1)} MB` : "Arquivo selecionado"} · o envio real vai direto do navegador ao storage quando a publicação for salva.
              </p>
              {uploadProgress !== null && <div className="mt-3">''',
    '''              <p className="mt-1 text-sm leading-5 text-slate-500 sm:text-xs">
                {fileSize ? `${(fileSize / (1024 * 1024)).toFixed(fileSize >= 1024 * 1024 * 1024 ? 0 : 1)} MB` : "Arquivo selecionado"} · o envio real vai direto do navegador ao storage quando a publicação for salva.
              </p>
              {mediaNotice && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">{mediaNotice}</p>}
              {uploadProgress !== null && <div className="mt-3">''',
)

text = text.replace(
    'accept="image/*,video/*"',
    'accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,.mp4,.mov,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp,video/mp4,video/quicktime"',
)

path.write_text(text, encoding="utf-8")
print("Compatibilidade de mídia aplicada ao composer.")
