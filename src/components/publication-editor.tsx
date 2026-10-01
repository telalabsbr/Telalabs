"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Heart,
  ImagePlus,
  Library,
  MessageCircle,
  MoreHorizontal,
  Play,
  Repeat2,
  Send,
  Share2,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { platformLabels, socialPlatforms, type ConnectionStatus, type SocialPlatform } from "@/domain/social";
import { PlatformIcon } from "./ui/platform-icon";
import { useTenantData } from "@/components/tenant-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { uploadMediaFile } from "@/lib/media/upload";
import { prepareMediaFile, type PreparedMediaMetadata } from "@/lib/media/compatibility";

type PublishMode = "now" | "schedule";
type RetentionMode = "delete" | "library";
type SaveIntent = "draft" | "publish_now" | "schedule";

interface DestinationOption {
  id: string;
  platform: SocialPlatform;
  label: string;
  handle: string;
  status: ConnectionStatus;
  connectionId?: string;
  surface?: "short" | "video";
  contentIntent?: "SHORT_FORM" | "LONG_FORM";
}

const aiSuffixPlain: Partial<Record<SocialPlatform, string>> = {
  instagram: "\n\nSalve para ver depois. #conteudo #socialmedia",
  facebook: "\n\nO que você acha? Conte para a gente nos comentários.",
  tiktok: "\n\n#paravoce #conteudo",
  youtube: "\n\nInscreva-se para acompanhar os próximos conteúdos.",
  linkedin: "\n\nComo você aplica isso na sua rotina profissional?",
  x: "\n\n#conteudo",
  kwai: "\n\n#dicas #criadores",
};

const aiSuffixEmoji: Partial<Record<SocialPlatform, string>> = {
  instagram: "\n\n✨ Salve para ver depois. 💾 #conteudo #socialmedia",
  facebook: "\n\n💬 O que você acha? Conte para a gente nos comentários.",
  tiktok: "\n\n✨ #paravoce #conteudo",
  youtube: "\n\n▶️ Inscreva-se para acompanhar os próximos conteúdos.",
  linkedin: "\n\n💡 Como você aplica isso na sua rotina profissional?",
  x: "\n\n✨ #conteudo",
  kwai: "\n\n🔥 #dicas #criadores",
};

function PreviewChrome({ platform }: { platform: SocialPlatform }) {
  if (platform === "instagram") {
    return <div className="flex items-center justify-between px-3 py-2 text-slate-700"><div className="flex gap-3"><Heart size={18}/><MessageCircle size={18}/><Send size={18}/></div><span className="text-[11px] font-bold">Instagram</span></div>;
  }
  if (platform === "facebook") {
    return <div className="grid grid-cols-3 border-t border-slate-100 text-center text-[11px] font-semibold text-slate-500"><span className="py-2">Curtir</span><span className="py-2">Comentar</span><span className="py-2">Compartilhar</span></div>;
  }
  if (platform === "tiktok" || platform === "kwai") {
    return <div className="absolute bottom-3 right-3 flex flex-col gap-3 text-white drop-shadow"><Heart size={19}/><MessageCircle size={19}/><Share2 size={19}/></div>;
  }
  if (platform === "youtube") {
    return <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2"><span className="text-[11px] font-bold text-slate-600">YouTube</span><div className="flex gap-3 text-slate-500"><Heart size={17}/><Share2 size={17}/></div></div>;
  }
  if (platform === "linkedin") {
    return <div className="grid grid-cols-4 border-t border-slate-100 text-center text-[10px] font-semibold text-slate-500"><span className="py-2">Gostei</span><span className="py-2">Comentar</span><span className="py-2">Republicar</span><span className="py-2">Enviar</span></div>;
  }
  return <div className="flex items-center gap-4 border-t border-slate-100 px-3 py-2 text-slate-500"><MessageCircle size={16}/><Repeat2 size={16}/><Heart size={16}/><Share2 size={16}/></div>;
}

function toIso(date: string, time: string) {
  const parsed = new Date(date + "T" + time + ":00");
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function PublicationEditor() {
  const tenant = useTenantData();
  const initialized = useRef(false);

  const destinationOptions = useMemo<DestinationOption[]>(() => {
    if (tenant.source === "supabase") {
      return tenant.connections.flatMap(connection => {
        const baseOption = {
          platform: connection.platform,
          handle: connection.handle ?? connection.displayName ?? platformLabels[connection.platform],
          status: connection.status,
          connectionId: connection.id,
        };

        if (connection.platform === "youtube") {
          return [
            {
              ...baseOption,
              id: connection.id + ":short",
              label: "YouTube Shorts",
              surface: "short" as const,
              contentIntent: "SHORT_FORM" as const,
            },
            {
              ...baseOption,
              id: connection.id + ":video",
              label: "YouTube — Vídeo",
              surface: "video" as const,
              contentIntent: "LONG_FORM" as const,
            },
          ];
        }

        return [{
          ...baseOption,
          id: connection.id,
          label: connection.displayName ?? platformLabels[connection.platform],
        }];
      });
    }

    return socialPlatforms.flatMap<DestinationOption>(platform => {
      if (platform === "youtube") {
        return [
          {
            id: "demo:youtube:short",
            platform,
            label: "YouTube Shorts",
            handle: "@conta",
            status: "connected" as const,
            surface: "short" as const,
            contentIntent: "SHORT_FORM" as const,
          },
          {
            id: "demo:youtube:video",
            platform,
            label: "YouTube — Vídeo",
            handle: "@conta",
            status: "connected" as const,
            surface: "video" as const,
            contentIntent: "LONG_FORM" as const,
          },
        ];
      }

      return [{
        id: "demo:" + platform,
        platform,
        label: platformLabels[platform],
        handle: "@conta",
        status: "connected" as const,
      }];
    });
  }, [tenant.source, tenant.connections]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState("");
  const [base, setBase] = useState("");
  const [customize, setCustomize] = useState(false);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<PublishMode>("schedule");
  const [differentTimes, setDifferentTimes] = useState(false);
  const [destinationTimes, setDestinationTimes] = useState<Record<string, string>>({});
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [retention, setRetention] = useState<RetentionMode>("delete");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState<"image" | "video" | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [mediaNotice, setMediaNotice] = useState("");
  const [mediaMetadata, setMediaMetadata] = useState<PreparedMediaMetadata>({ durationMs: null, width: null, height: null });
  const [stagedMedia, setStagedMedia] = useState<{ key: string; mediaId: string } | null>(null);
  const [existingMedia, setExistingMedia] = useState<{ id: string; name: string; type: "image" | "video"; size: number } | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [date, setDate] = useState("2026-09-25");
  const [time, setTime] = useState("18:30");

  useEffect(() => {
    if (tenant.loading || initialized.current) return;
    initialized.current = true;
    const preferred = tenant.source === "supabase"
      ? destinationOptions
          .filter(option => option.status === "connected" && option.contentIntent !== "LONG_FORM")
          .map(option => option.id)
      : destinationOptions
          .filter(option => ["instagram", "tiktok", "facebook", "youtube"].includes(option.platform) && option.contentIntent !== "LONG_FORM")
          .map(option => option.id);
    setSelectedIds(preferred);
    setActiveId(preferred[0] ?? destinationOptions[0]?.id ?? "");
  }, [tenant.loading, tenant.source, destinationOptions]);

  useEffect(() => {
    if (tenant.loading || tenant.source !== "supabase" || tenant.activeBrand.id === "unconfigured" || !destinationOptions.length) return;

    const editId = new URLSearchParams(window.location.search).get("edit");
    if (!editId) return;

    let active = true;

    async function loadEdit() {
      const client = createSupabaseBrowserClient();
      if (!client) return;

      setLoadingEdit(true);
      setSaveError("");

      const postResult = await client
        .from("posts")
        .select("id,brand_id,internal_title,base_caption,deleted_at")
        .eq("id", editId!)
        .eq("brand_id", tenant.activeBrand.id)
        .is("deleted_at", null)
        .single();

      if (!active) return;
      if (postResult.error || !postResult.data) {
        setSaveError("Não foi possível abrir esta publicação para edição.");
        setLoadingEdit(false);
        return;
      }

      const targetResult = await client
        .from("post_targets")
        .select("id,social_connection_id,provider,state,scheduled_at,caption_override,title_override,content_intent_override,provider_config")
        .eq("post_id", editId!)
        .order("scheduled_at", { ascending: true });

      if (!active) return;
      if (targetResult.error) {
        setSaveError(targetResult.error.message);
        setLoadingEdit(false);
        return;
      }

      const targets = targetResult.data ?? [];
      if (targets.some(target => !["DRAFT", "SCHEDULED", "CANCELLED"].includes(target.state))) {
        setSaveError("Esta publicação já entrou no fluxo de envio e não pode mais ser editada com segurança.");
        setLoadingEdit(false);
        return;
      }

      const selected: string[] = [];
      const nextTexts: Record<string, string> = {};
      const nextTitles: Record<string, string> = {};
      const nextTimes: Record<string, string> = {};
      const clockValues: string[] = [];

      for (const target of targets) {
        const optionId = target.provider === "youtube" && target.content_intent_override === "SHORT_FORM"
          ? target.social_connection_id + ":short"
          : target.provider === "youtube" && target.content_intent_override === "LONG_FORM"
            ? target.social_connection_id + ":video"
            : target.social_connection_id;

        if (!destinationOptions.some(option => option.id === optionId)) continue;
        selected.push(optionId);

        if (target.caption_override) nextTexts[optionId] = target.caption_override;
        if (target.title_override) nextTitles[optionId] = target.title_override;

        if (target.scheduled_at) {
          const scheduled = new Date(target.scheduled_at);
          const hh = String(scheduled.getHours()).padStart(2, "0");
          const mm = String(scheduled.getMinutes()).padStart(2, "0");
          const clock = hh + ":" + mm;
          nextTimes[optionId] = clock;
          clockValues.push(clock);
        }
      }

      setEditingPostId(editId);
      setBase(postResult.data.base_caption ?? postResult.data.internal_title);
      setSelectedIds(selected);
      setActiveId(selected[0] ?? "");
      setTexts(nextTexts);
      setTitles(nextTitles);

      const firstScheduled = targets.find(target => target.scheduled_at)?.scheduled_at;
      if (firstScheduled) {
        const scheduled = new Date(firstScheduled);
        const yyyy = scheduled.getFullYear();
        const mm = String(scheduled.getMonth() + 1).padStart(2, "0");
        const dd = String(scheduled.getDate()).padStart(2, "0");
        const hh = String(scheduled.getHours()).padStart(2, "0");
        const min = String(scheduled.getMinutes()).padStart(2, "0");
        setDate(yyyy + "-" + mm + "-" + dd);
        setTime(hh + ":" + min);
        setMode("schedule");
      }

      setDestinationTimes(nextTimes);
      setDifferentTimes(new Set(clockValues).size > 1);

      const firstConfig = targets[0]?.provider_config;
      if (firstConfig && typeof firstConfig === "object" && !Array.isArray(firstConfig)) {
        const retentionValue = (firstConfig as Record<string, unknown>).retention;
        if (retentionValue === "library" || retentionValue === "delete") setRetention(retentionValue);
      }

      const targetIds = targets.map(target => target.id);
      if (targetIds.length) {
        const linkResult = await client
          .from("post_target_media")
          .select("media_asset_id")
          .in("post_target_id", targetIds)
          .eq("position", 0)
          .limit(1)
          .maybeSingle();

        const mediaId = linkResult.data?.media_asset_id;
        if (mediaId) {
          const mediaResult = await client
            .from("media_assets")
            .select("id,filename,mime_type,size_bytes")
            .eq("id", mediaId)
            .is("deleted_at", null)
            .maybeSingle();

          if (mediaResult.data) {
            const type = mediaResult.data.mime_type.startsWith("video/") ? "video" as const : "image" as const;
            const media = {
              id: mediaResult.data.id,
              name: mediaResult.data.filename,
              type,
              size: mediaResult.data.size_bytes,
            };
            setExistingMedia(media);
            setFileName(media.name);
            setFileType(media.type);
            setFileSize(media.size);
          }
        }
      }

      setLoadingEdit(false);
    }

    void loadEdit();
    return () => { active = false; };
  }, [tenant.loading, tenant.source, tenant.activeBrand.id, destinationOptions]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const shortOptions = destinationOptions.filter(option => option.contentIntent !== "LONG_FORM");
  const longYouTubeOptions = destinationOptions.filter(option => option.contentIntent === "LONG_FORM");
  const selectedOptions = destinationOptions.filter(option => selectedIds.includes(option.id));
  const activeOption = selectedOptions.find(option => option.id === activeId) ?? selectedOptions[0] ?? destinationOptions[0];

  async function handleFile(file?: File) {
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
  }

  function removeFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setUploadProgress(null);
    setMediaNotice("");
    setMediaMetadata({ durationMs: null, width: null, height: null });
    setStagedMedia(null);

    if (existingMedia) {
      setFileName(existingMedia.name);
      setFileType(existingMedia.type);
      setFileSize(existingMedia.size);
    } else {
      setFileName("");
      setFileType(null);
      setFileSize(0);
    }
  }

  function toggle(option: DestinationOption) {
    setSelectedIds(current => {
      if (current.includes(option.id)) {
        const next = current.filter(item => item !== option.id);
        if (activeId === option.id) setActiveId(next[0] ?? "");
        return next;
      }
      setActiveId(option.id);
      return [...current, option.id];
    });
    setSaveMessage("");
  }

  function adaptAll() {
    const suffixes = includeEmojis ? aiSuffixEmoji : aiSuffixPlain;
    const next = { ...texts };
    const nextTitles = { ...titles };
    selectedOptions.forEach(option => {
      next[option.id] = base + (suffixes[option.platform] ?? "");
      if (option.platform === "youtube" && option.contentIntent === "LONG_FORM" && !nextTitles[option.id]) {
        nextTitles[option.id] = base.slice(0, 80) || "Novo vídeo";
      }
    });
    setTexts(next);
    setTitles(nextTitles);
    setCustomize(true);
    setSaveMessage("");
  }

  const effectiveText = (option: DestinationOption) => texts[option.id] ?? base;

  const checks = selectedOptions.map(option => {
    if (!base.trim()) return { option, level: "error" as const, text: "Adicione a descrição base" };
    if (tenant.source === "supabase" && option.status !== "connected") return { option, level: "error" as const, text: "Conta precisa ser reconectada" };

    if (option.platform === "instagram") {
      if (!fileType && !existingMedia) return { option, level: "error" as const, text: "Adicione uma imagem ou vídeo" };
      if (fileType === "video" && mediaMetadata.durationMs !== null && mediaMetadata.durationMs < 3_000) return { option, level: "error" as const, text: "Reel precisa ter ao menos 3 segundos" };
      if (fileType === "video" && mediaMetadata.durationMs !== null && mediaMetadata.durationMs > 15 * 60 * 1000) return { option, level: "error" as const, text: "Reel ultrapassa 15 minutos" };
      if (fileType === "video" && mediaMetadata.width !== null && mediaMetadata.width > 1920) return { option, level: "error" as const, text: "Reduza a largura do Reel para até 1920 px" };
      if (fileType === "video" && fileSize > 1024 * 1024 * 1024) return { option, level: "error" as const, text: "Reel ultrapassa 1 GB" };
    }

    if (option.contentIntent === "LONG_FORM") {
      if (fileType !== "video") return { option, level: "error" as const, text: "Adicione um vídeo para o YouTube" };
      if (fileSize > 10 * 1024 * 1024 * 1024) return { option, level: "error" as const, text: "O limite inicial é 10 GB" };
      if (!(titles[option.id]?.trim())) return { option, level: "warning" as const, text: "Adicione um título ao vídeo" };
    }

    if (effectiveText(option).length > 2000) return { option, level: "warning" as const, text: "Revise o tamanho da descrição" };
    return { option, level: "ok" as const, text: "Pronto" };
  });

  const canSubmit = !!base.trim() && selectedOptions.length > 0 && !checks.some(check => check.level === "error");

  async function persist(intent: SaveIntent) {
    setSaving(true);
    setSaveError("");
    setSaveMessage("");

    if (tenant.source !== "supabase") {
      setSaveMessage("Salvo no modo demonstração. Nenhuma rede externa foi acionada.");
      setSaving(false);
      return;
    }

    if (!tenant.user || !tenant.organization || tenant.activeBrand.id === "unconfigured") {
      setSaveError("Conclua a configuração da conta antes de salvar uma publicação.");
      setSaving(false);
      return;
    }

    if (!selectedOptions.length || selectedOptions.some(option => !option.connectionId)) {
      setSaveError("Selecione pelo menos uma conta social conectada.");
      setSaving(false);
      return;
    }

    const client = createSupabaseBrowserClient();
    if (!client) {
      setSaveError("Supabase não está configurado neste ambiente.");
      setSaving(false);
      return;
    }

    let mediaId: string | null = null;
    if (selectedFile) {
      const mediaKey = [selectedFile.name, selectedFile.size, selectedFile.lastModified, retention].join(":");

      if (stagedMedia?.key === mediaKey) {
        mediaId = stagedMedia.mediaId;
      } else {
        setUploadProgress(0);
        setSaveMessage("Enviando mídia para o staging seguro...");

        try {
          const uploaded = await uploadMediaFile({
            file: selectedFile,
            brandId: tenant.activeBrand.id,
            retention,
            metadata: mediaMetadata,
            onProgress: progress => {
              setUploadProgress(progress.percent);
              setSaveMessage(`Enviando mídia: ${progress.percent}%`);
            },
          });
          mediaId = uploaded.mediaId;
          setStagedMedia({ key: mediaKey, mediaId: uploaded.mediaId });
          setUploadProgress(100);
        } catch (uploadError) {
          const code = uploadError instanceof Error ? uploadError.message : "upload_failed";
          const messages: Record<string, string> = {
            object_storage_not_configured: "O storage de mídia ainda não está configurado neste ambiente.",
            file_too_large: "O arquivo ultrapassa o limite inicial de 10 GB.",
            unsupported_media_type: "Este tipo de arquivo ainda não é suportado.",
            invalid_media_request: "Os dados técnicos da mídia não puderam ser validados.",
            upload_part_missing_etag: "Não foi possível confirmar o upload. A configuração CORS do storage precisa expor o cabeçalho ETag.",
          };
          setSaveError(messages[code] ?? "Não foi possível concluir o upload da mídia. Tente novamente.");
          setSaveMessage("");
          setUploadProgress(null);
          setSaving(false);
          return;
        }
      }
    }

    const timezone = tenant.activeBrand.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const targets = selectedOptions.map(option => {
      const targetTime = differentTimes ? (destinationTimes[option.id] || time) : time;
      return {
        connection_id: option.connectionId as string,
        provider: option.platform,
        scheduled_at: intent === "publish_now" ? new Date().toISOString() : toIso(date, targetTime),
        scheduled_timezone: timezone,
        caption_override: effectiveText(option) === base ? "" : effectiveText(option),
        title_override: titles[option.id] ?? "",
        requested_action: intent,
        retention: retention,
        surface: option.surface ?? null,
        content_intent: option.contentIntent ?? "AUTO",
        file_size_bytes: fileSize || null,
      };
    });

    const postPayload = {
      p_internal_title: base.trim().slice(0, 80) || "Nova publicação",
      p_base_caption: base.trim(),
      p_targets: targets,
    };

    const result = editingPostId
      ? await client.rpc("update_post_plan", {
          p_post_id: editingPostId,
          ...postPayload,
        })
      : await client.rpc("save_post_draft", {
          p_brand_id: tenant.activeBrand.id,
          ...postPayload,
        });

    if (result.error) {
      setSaveError(result.error.message);
      setSaving(false);
      return;
    }

    const postId = typeof result.data === "string" ? result.data : editingPostId;

    if (mediaId && postId) {
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

    if (intent === "publish_now" && postId) {
      setSaveMessage("Mídia pronta. Enviando para as redes habilitadas...");

      let publishResponse: Response;
      try {
        publishResponse = await fetch("/api/publications/publish-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: postId }),
        });
      } catch {
        setSaveError("A publicação foi salva, mas o envio externo não pôde ser iniciado agora.");
        setSaving(false);
        return;
      }

      const publishResult = await publishResponse.json().catch(() => null) as null | {
        claimed?: number;
        succeeded?: number;
        needsRetry?: number;
        failed?: number;
        message?: string;
        error?: string;
        results?: Array<{ provider: string; outcome: string; errorMessage?: string | null }>;
      };

      if (!publishResponse.ok) {
        setSaveError(publishResult?.message ?? "A publicação foi salva, mas o worker não conseguiu iniciar o envio externo.");
        setSaving(false);
        return;
      }

      const succeeded = publishResult?.succeeded ?? 0;
      const needsRetry = publishResult?.needsRetry ?? 0;
      const failed = publishResult?.failed ?? 0;

      if (failed > 0) {
        const firstFailure = publishResult?.results?.find(item => !["SUCCEEDED", "TRANSIENT_FAILURE", "RATE_LIMIT", "UNKNOWN"].includes(item.outcome));
        setSaveError(firstFailure?.errorMessage ?? "A publicação foi processada, mas um dos destinos recusou o conteúdo.");
      } else if (needsRetry > 0) {
        setSaveMessage("Envio iniciado. A rede ainda está processando a mídia e o worker fará a próxima verificação automaticamente.");
      } else if (succeeded > 0) {
        setSaveMessage(succeeded === 1 ? "Publicado." : `${succeeded} destinos publicados.`);
      } else if ((publishResult?.claimed ?? 0) === 0) {
        setSaveMessage("Publicação salva. Não havia destino habilitado aguardando envio neste instante.");
      } else {
        setSaveMessage("Publicação processada pelo worker.");
      }
    } else if (editingPostId) {
      setSaveMessage("Alterações salvas no Supabase real.");
    } else if (intent === "draft") {
      setSaveMessage("Rascunho salvo no Supabase real.");
    } else {
      setSaveMessage("Agendamento salvo. O worker enviará cada destino no horário configurado.");
    }

    setSaving(false);
    if (selectedFile) setUploadProgress(100);
  }

  return <div className="w-full max-w-full space-y-5 overflow-x-hidden">
    <section>
      <p className="eyebrow">{editingPostId ? "Edição" : "Publicação"}</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{editingPostId ? "Editar publicação" : "Criar publicação"}</h1>
      <p className="mt-1 text-sm leading-6 text-slate-500">{editingPostId ? "Altere conteúdo, destinos e horário antes da primeira tentativa de envio." : "Mídia, descrição, destinos e horário em um único fluxo."}</p>
      {loadingEdit && <p className="mt-2 text-xs font-bold text-indigo-600">Carregando publicação...</p>}
      {tenant.source === "supabase" && <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Dados reais da marca: {tenant.activeBrand.name}</p>}
    </section>

    <div className="grid w-full max-w-full gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <section className="card p-4 sm:p-5">
          <div>
            <h2 className="text-base font-bold text-slate-950 sm:text-sm">1. Mídia</h2>
            <p className="mt-1 text-sm text-slate-500 sm:text-xs">Envie um arquivo ou escolha algo que já está na biblioteca.</p>
          </div>

          {previewUrl || existingMedia ? <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-100">
              {previewUrl
                ? (fileType === "video" ? <video src={previewUrl} className="h-full w-full object-cover" muted playsInline/> : <img src={previewUrl} alt="Prévia da mídia" className="h-full w-full object-cover"/> )
                : <div className="grid h-full place-items-center text-center text-slate-400"><div><Play className="mx-auto" size={28}/><p className="mt-2 px-3 text-xs font-bold">Mídia já vinculada</p></div></div>}
              <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/75 px-2 py-1 text-xs font-bold text-white">{fileType === "video" ? "VÍDEO" : "IMAGEM"}</span>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="truncate text-sm font-bold text-slate-900">{fileName}</p>
              <p className="mt-1 text-sm leading-5 text-slate-500 sm:text-xs">
                {fileSize ? `${(fileSize / (1024 * 1024)).toFixed(fileSize >= 1024 * 1024 * 1024 ? 0 : 1)} MB` : "Arquivo selecionado"} · o envio real vai direto do navegador ao storage quando a publicação for salva.
              </p>
              {mediaNotice && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">{mediaNotice}</p>}
              {uploadProgress !== null && <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: uploadProgress + "%" }}/></div>
                <p className="mt-1 text-xs font-bold text-slate-500">{uploadProgress < 100 ? `Upload ${uploadProgress}%` : "Mídia pronta"}</p>
              </div>}
              <div className="mt-4 flex flex-wrap gap-2">
                <label className="btn-secondary cursor-pointer"><UploadCloud size={15}/> Substituir<input type="file" accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,.mp4,.mov,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp,video/mp4,video/quicktime" className="sr-only" onChange={event => handleFile(event.target.files?.[0])}/></label>
                {selectedFile && <button onClick={removeFile} className="btn-secondary !text-red-600"><Trash2 size={15}/> Cancelar substituição</button>}
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-sm font-bold text-slate-700 sm:text-xs">Depois de concluir todos os destinos</p>
                <div className="mt-2 flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:gap-4 sm:text-xs">
                  <label className="flex items-center gap-2"><input type="radio" checked={retention === "delete"} onChange={() => setRetention("delete")}/> Excluir automaticamente</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={retention === "library"} onChange={() => setRetention("library")}/> Manter na biblioteca</label>
                </div>
              </div>
            </div>
          </div> : <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-5 text-center transition-colors hover:bg-indigo-50">
              <ImagePlus className="text-indigo-600" size={26}/>
              <span className="mt-2 text-base font-bold text-slate-900 sm:text-sm">Adicionar imagem ou vídeo</span>
              <span className="mt-1 text-sm text-slate-500 sm:text-xs">Clique para selecionar</span>
              <input type="file" accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,.mp4,.mov,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp,video/mp4,video/quicktime" className="sr-only" onChange={event => handleFile(event.target.files?.[0])}/>
            </label>
            <button className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-5 text-center hover:bg-slate-100">
              <Library className="text-slate-600" size={26}/>
              <span className="mt-2 text-base font-bold text-slate-900 sm:text-sm">Escolher da biblioteca</span>
              <span className="mt-1 text-sm text-slate-500 sm:text-xs">Mídias que você decidiu guardar</span>
            </button>
          </div>}
        </section>

        <section className="card min-w-0 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-950 sm:text-sm">2. Onde publicar?</h2>
              <p className="mt-1 text-sm text-slate-500 sm:text-xs">{tenant.source === "supabase" ? "Cada conta conectada é um destino independente." : "Modo demonstração: escolha as redes para simular o fluxo."}</p>
            </div>
            {!!shortOptions.length && <button onClick={() => {
              const shortIds = shortOptions.map(option => option.id);
              const allShortSelected = shortIds.every(id => selectedIds.includes(id));
              setSelectedIds(current => allShortSelected
                ? current.filter(id => !shortIds.includes(id))
                : Array.from(new Set([...current, ...shortIds])));
            }} className="shrink-0 text-sm font-bold text-indigo-600 sm:text-xs">
              {shortOptions.every(option => selectedIds.includes(option.id)) ? "Limpar sociais" : "Selecionar todos"}
            </button>}
          </div>

          {tenant.source === "supabase" && !destinationOptions.length ? <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <p className="text-sm font-bold text-slate-900">Nenhuma conta social conectada ainda.</p>
            <p className="mt-1 text-sm text-slate-500">Conecte pelo menos uma conta antes de criar destinos reais.</p>
            <Link href="/conexoes" className="btn-secondary mt-3">Ir para Contas</Link>
          </div> : <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Conteúdo curto / social</p>
              <div className="mt-2 grid w-full max-w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {shortOptions.map(option => {
                  const active = selectedIds.includes(option.id);
                  const blocked = tenant.source === "supabase" && option.status !== "connected";
                  return <button key={option.id} onClick={() => toggle(option)} aria-pressed={active} className={`focusable flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors ${active ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                    <PlatformIcon platform={option.platform} small/>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900 sm:text-xs">{option.label}</span>
                      <span className={`block truncate text-sm sm:text-xs ${blocked ? "text-amber-600" : "text-slate-500"}`}>{blocked ? "Reconexão necessária" : option.handle}</span>
                    </span>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>{active && <Check size={12}/>}</span>
                  </button>;
                })}
              </div>
            </div>

            {!!longYouTubeOptions.length && <div className="border-t border-slate-200 pt-4">
              <div className="mb-2">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Vídeo longo</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">YouTube tradicional fica separado dos destinos curtos. Até <strong>10 GB por vídeo</strong>; arquivos grandes podem levar mais tempo para processar e publicar.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {longYouTubeOptions.map(option => {
                  const active = selectedIds.includes(option.id);
                  const blocked = tenant.source === "supabase" && option.status !== "connected";
                  return <button key={option.id} onClick={() => toggle(option)} aria-pressed={active} className={`focusable flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors ${active ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                    <PlatformIcon platform="youtube" small/>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900 sm:text-xs">YouTube — Vídeo</span>
                      <span className={`block truncate text-sm sm:text-xs ${blocked ? "text-amber-600" : "text-slate-500"}`}>{blocked ? "Reconexão necessária" : option.handle}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-slate-400">Até 10 GB</span>
                    </span>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>{active && <Check size={12}/>}</span>
                  </button>;
                })}
              </div>
            </div>}
          </div>}
        </section>

        <section className="card min-w-0 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-950 sm:text-sm">3. Descrição</h2>
              <p className="mt-1 text-sm text-slate-500 sm:text-xs">Use uma descrição base e personalize somente quando quiser.</p>
            </div>
            <div className="flex max-w-full rounded-lg bg-slate-100 p-1 text-sm font-bold sm:text-xs">
              <button onClick={() => setCustomize(false)} className={`rounded-md px-3 py-2 ${!customize ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Descrição base</button>
              <button onClick={() => setCustomize(true)} className={`rounded-md px-3 py-2 ${customize ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Por destino</button>
            </div>
          </div>

          {!customize ? <div className="mt-4">
            <textarea value={base} onChange={event => { setBase(event.target.value); setSaveMessage(""); }} placeholder="Escreva a descrição principal aqui..." className="field min-h-36 resize-y p-4 text-base sm:text-sm"/>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-500 sm:text-xs">{base.length} caracteres</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 sm:text-xs">
                  <input type="checkbox" checked={includeEmojis} onChange={event => setIncludeEmojis(event.target.checked)}/>
                  Usar emojis
                </label>
                <button onClick={adaptAll} disabled={!base.trim() || !selectedOptions.length} className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"><Sparkles size={16}/> Adaptar para todas</button>
              </div>
            </div>
          </div> : <div className="mt-4 min-w-0">
            {selectedOptions.length ? <>
              <div className="app-scrollbar flex max-w-full gap-1 overflow-x-auto border-b border-slate-200">
                {selectedOptions.map(option => <button key={option.id} onClick={() => setActiveId(option.id)} className={`flex max-w-44 shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-bold sm:text-xs ${activeId === option.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}><PlatformIcon platform={option.platform} small/><span className="truncate">{option.label}</span></button>)}
              </div>
              {activeOption && <div className="mt-4">
                {activeOption.platform === "youtube" && activeOption.contentIntent === "LONG_FORM" && <label className="mb-3 block text-sm font-bold text-slate-700 sm:text-xs">Título do YouTube<input value={titles[activeOption.id] ?? ""} onChange={event => setTitles(current => ({ ...current, [activeOption.id]: event.target.value }))} className="field mt-1 px-3 text-base sm:text-sm" placeholder="Título do vídeo"/></label>}
                <textarea value={effectiveText(activeOption)} onChange={event => setTexts(current => ({ ...current, [activeOption.id]: event.target.value }))} className="field min-h-36 resize-y p-4 text-base sm:text-sm"/>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-500 sm:text-xs">Personalização de {activeOption.label}.</p>
                  <button onClick={() => setTexts(current => ({ ...current, [activeOption.id]: base }))} className="text-sm font-bold text-indigo-600 sm:text-xs">Usar descrição base</button>
                </div>
              </div>}
            </> : <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Selecione ao menos uma conta para personalizar.</p>}
          </div>}
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="text-base font-bold text-slate-950 sm:text-sm">4. Quando publicar?</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button onClick={() => setMode("now")} className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${mode === "now" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-700"}`}><Send size={16}/> Publicar agora</button>
            <button onClick={() => setMode("schedule")} className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${mode === "schedule" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-700"}`}><CalendarClock size={16}/> Agendar</button>
          </div>

          {mode === "schedule" && <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-700 sm:text-xs">Data<input type="date" value={date} onChange={event => setDate(event.target.value)} className="field mt-1 px-3 text-base sm:text-sm"/></label>
              <label className="text-sm font-bold text-slate-700 sm:text-xs">Horário<input type="time" value={time} onChange={event => setTime(event.target.value)} className="field mt-1 px-3 text-base sm:text-sm"/></label>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700 sm:text-xs">
              <input type="checkbox" checked={differentTimes} onChange={event => setDifferentTimes(event.target.checked)}/>
              Usar horários diferentes por destino
            </label>
            {differentTimes && <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {selectedOptions.map(option => <label key={option.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-700 sm:text-xs"><PlatformIcon platform={option.platform} small/><span className="min-w-0 flex-1 truncate">{option.label}</span><input type="time" value={destinationTimes[option.id] ?? time} onChange={event => setDestinationTimes(current => ({ ...current, [option.id]: event.target.value }))} className="w-28 shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-base sm:text-xs"/></label>)}
            </div>}
          </div>}
        </section>

        <section className="card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-600" size={18}/>
            <h2 className="text-base font-bold text-slate-950 sm:text-sm">5. Verificação</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500 sm:text-xs">Avisos por destino antes de publicar.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map(check => <button key={check.option.id} onClick={() => { setCustomize(true); setActiveId(check.option.id); }} className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left ${check.level === "error" ? "border-red-200 bg-red-50" : check.level === "warning" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
              <PlatformIcon platform={check.option.platform} small/>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900 sm:text-xs">{check.option.label}</span>
                <span className={`block truncate text-sm sm:text-xs ${check.level === "error" ? "text-red-700" : check.level === "warning" ? "text-amber-700" : "text-emerald-700"}`}>{check.text}</span>
              </span>
              {check.level === "ok" ? <CheckCircle2 size={15} className="shrink-0 text-emerald-600"/> : <CircleAlert size={15} className={`shrink-0 ${check.level === "error" ? "text-red-600" : "text-amber-600"}`}/>} 
            </button>)}
          </div>
        </section>
      </div>

      <aside className="min-w-0 space-y-4 xl:sticky xl:top-20 xl:self-start">
        <section className="card min-w-0 overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <p className="font-bold text-slate-950">Prévia da publicação</p>
            <p className="mt-1 text-sm leading-5 text-slate-500 sm:text-xs">Simulação aproximada por rede. A interface oficial pode mudar.</p>
          </div>

          {selectedOptions.length ? <>
            <div className="app-scrollbar flex max-w-full gap-1 overflow-x-auto border-b border-slate-200 px-3 pt-2">
              {selectedOptions.map(option => <button key={option.id} onClick={() => setActiveId(option.id)} className={`flex min-w-12 shrink-0 items-center justify-center border-b-2 px-3 py-2 ${activeId === option.id ? "border-indigo-600" : "border-transparent"}`}><PlatformIcon platform={option.platform} small/></button>)}
            </div>
            {activeOption && <div className="bg-slate-50 p-3 sm:p-4">
              <div className={`relative mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm ${activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "bg-slate-950 text-white" : "bg-white"}`}>
                <div className="flex items-center gap-2 px-3 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-[10px] font-black text-indigo-700">{tenant.activeBrand.initials}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-xs font-bold ${activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "text-white" : "text-slate-900"}`}>{activeOption.handle}</p>
                    <p className={`text-[11px] ${activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "text-white/70" : "text-slate-400"}`}>{platformLabels[activeOption.platform]}</p>
                  </div>
                  <MoreHorizontal size={17} className={activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "text-white/70" : "text-slate-400"}/>
                </div>
                <div className={`relative bg-gradient-to-br from-indigo-50 via-slate-100 to-violet-100 ${activeOption.platform === "youtube" && activeOption.contentIntent === "LONG_FORM" ? "aspect-video" : "aspect-[4/5]"}`}>
                  {previewUrl && (fileType === "video" ? <video src={previewUrl} className="h-full w-full object-cover" muted playsInline/> : <img src={previewUrl} alt="" className="h-full w-full object-cover"/>)}
                  {!previewUrl && <div className="grid h-full place-items-center text-slate-400"><Play size={30}/></div>}
                  {(activeOption.platform === "tiktok" || activeOption.platform === "kwai") && <PreviewChrome platform={activeOption.platform}/>} 
                </div>
                <div className="p-3">
                  {activeOption.platform === "youtube" && activeOption.contentIntent === "LONG_FORM" && titles[activeOption.id] && <p className="mb-1 text-base font-black text-slate-950">{titles[activeOption.id]}</p>}
                  <p className={`whitespace-pre-line text-sm leading-5 ${activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "text-white" : "text-slate-700"}`}>{effectiveText(activeOption) || "Sua descrição aparecerá aqui."}</p>
                </div>
                {activeOption.platform !== "tiktok" && activeOption.platform !== "kwai" && <PreviewChrome platform={activeOption.platform}/>} 
              </div>
            </div>}
          </> : <div className="p-6 text-center text-sm text-slate-500">Selecione ao menos um destino para ver a prévia.</div>}
        </section>

        <section className="card p-4">
          <div className="flex items-center justify-between text-sm sm:text-xs">
            <span className="text-slate-500">Destinos</span><strong className="text-slate-900">{selectedOptions.length}</strong>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm sm:text-xs">
            <span className="text-slate-500">Envio</span><strong className="text-slate-900">{mode === "now" ? "Agora" : "Agendado"}</strong>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm sm:text-xs">
            <span className="text-slate-500">Arquivo após publicar</span><strong className="text-right text-slate-900">{retention === "delete" ? "Excluir" : "Biblioteca"}</strong>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <button disabled={saving || !base.trim()} onClick={() => void persist("draft")} className="btn-secondary w-full disabled:opacity-50">Salvar rascunho</button>
            <button disabled={saving || !canSubmit} onClick={() => void persist(mode === "now" ? "publish_now" : "schedule")} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40">{mode === "now" ? <Send size={16}/> : <Clock3 size={16}/>} {saving ? (mode === "now" ? "Publicando..." : "Salvando...") : mode === "now" ? "Publicar agora" : "Agendar publicação"}</button>
          </div>
          {saveMessage && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold leading-5 text-emerald-700 sm:text-xs">{saveMessage}</p>}
          {saveError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold leading-5 text-red-700 sm:text-xs">{saveError}</p>}
          {tenant.source === "supabase" && <p className="mt-3 text-xs leading-5 text-slate-500">O Instagram já publica pelo worker real. Destinos futuros entram aqui conforme cada adapter for validado.</p>}
        </section>
      </aside>
    </div>
  </div>;
}
