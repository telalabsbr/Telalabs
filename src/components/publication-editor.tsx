"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  ExternalLink,
  Eye,
  Heart,
  ImagePlus,
  Library,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  Repeat2,
  Send,
  Share2,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { platformLabels, socialPlatforms, type ConnectionStatus, type SocialPlatform } from "@/domain/social";
import { PlatformIcon } from "./ui/platform-icon";
import { useTenantData } from "@/components/tenant-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { uploadMediaFile } from "@/lib/media/upload";
import { prepareMediaFile, type PreparedMediaMetadata } from "@/lib/media/compatibility";
import { composeTextOnMedia, composeTimedTextLayersOnVideo, defaultTextOverlay, type TextOverlayConfig } from "@/lib/media/text-overlay";
import { VideoCoverEditor, type CoverAspect, type CoverSelection } from "./video-cover-editor";
import { MediaTextEditor } from "./media-text-editor";
import { InlineEmojiPicker, TextTimingControl } from "./text-overlay-controls";
import { PublicationMediaPreview } from "./publication-media-preview";
import { CarouselImageAdjuster } from "./carousel-image-adjuster";
import {
  InstagramMusicEditor,
  type InstagramAudioSelection,
} from "./instagram-music-editor";
import { applyImageTransform, defaultImageTransform, mediaAspectSizes, type ImageTransform } from "@/lib/media/image-transform";
import { transcodeVideoToAspect } from "@/lib/media/transcode";

type PublishMode = "now" | "schedule";
type RetentionMode = "delete" | "library";
type SaveIntent = "draft" | "publish_now" | "schedule";
type InstagramPlacement = "feed" | "story" | "both";
type MediaEditorTab = "media" | "cover" | "text" | "music" | "stories";
type StoryTextEdge = "start" | "end";

const mediaAspects: CoverAspect[] = ["9:16", "4:5", "3:4", "1:1", "16:9"];

function mediaAspectRatio(aspect: CoverAspect) {
  if (aspect === "9:16") return 9 / 16;
  if (aspect === "4:5") return 4 / 5;
  if (aspect === "3:4") return 3 / 4;
  if (aspect === "1:1") return 1;
  return 16 / 9;
}

function mediaMatchesAspect(metadata: PreparedMediaMetadata, aspect: CoverAspect) {
  if (!metadata.width || !metadata.height) return false;
  return Math.abs(metadata.width / metadata.height - mediaAspectRatio(aspect)) < 0.01;
}

function metadataForAspect(metadata: PreparedMediaMetadata, aspect: CoverAspect): PreparedMediaMetadata {
  const size = mediaAspectSizes[aspect];
  return { ...metadata, width: size.width, height: size.height };
}

function loadedAspectLabel(width: number | null | undefined, height: number | null | undefined) {
  if (!width || !height) return null;
  const ratio = width / height;
  const known: Array<[CoverAspect, number]> = [["9:16", 9 / 16], ["4:5", 4 / 5], ["3:4", 3 / 4], ["1:1", 1], ["16:9", 16 / 9]];
  const nearest = known.reduce((best, current) => Math.abs(current[1] - ratio) < Math.abs(best[1] - ratio) ? current : best);
  return Math.abs(nearest[1] - ratio) < 0.045 ? nearest[0] : `${width}×${height}`;
}

function formatMediaSize(bytes: number) {
  if (!bytes) return "Arquivo selecionado";
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

interface DestinationOption {
  id: string;
  platform: SocialPlatform;
  label: string;
  handle: string;
  status: ConnectionStatus;
  connectionId?: string;
  surface?: "short" | "video";
  contentIntent?: "SHORT_FORM" | "LONG_FORM";
  advancedEnabled?: boolean;
}

interface PublishAttemptResult {
  postTargetId?: string;
  provider: string;
  contentIntent?: string;
  surface?: string | null;
  outcome: string;
  errorMessage?: string | null;
  publicUrl?: string | null;
}

interface ComposerCheck {
  option: DestinationOption;
  level: "error" | "warning" | "ok";
  text: string;
}

interface CarouselItem {
  id: string;
  file: File;
  previewUrl: string;
  metadata: PreparedMediaMetadata;
  transform: ImageTransform;
  adjusted: boolean;
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

function defaultScheduleParts() {
  const future = new Date(Date.now() + 10 * 60 * 1000);
  const yyyy = future.getFullYear();
  const mm = String(future.getMonth() + 1).padStart(2, "0");
  const dd = String(future.getDate()).padStart(2, "0");
  const hh = String(future.getHours()).padStart(2, "0");
  const min = String(future.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

function resultLabel(result: PublishAttemptResult) {
  if (result.provider === "instagram" && result.surface === "story") return "Instagram Story";
  if (result.provider === "instagram") return "Instagram";
  if (result.provider === "facebook") return "Facebook";
  if (result.provider === "youtube" && result.contentIntent === "LONG_FORM") return "YouTube — Vídeo";
  if (result.provider === "youtube") return "YouTube Shorts";
  if (result.provider === "tiktok") return "TikTok";
  if (result.provider === "linkedin") return "LinkedIn";
  if (result.provider === "kwai") return "Kwai";
  if (result.provider === "x") return "X";
  return result.provider;
}

function resultPresentation(outcome: string) {
  if (outcome === "SUCCEEDED") return { text: "Publicado", className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (["TRANSIENT_FAILURE", "RATE_LIMIT", "UNKNOWN"].includes(outcome)) {
    return { text: "Aguardando nova tentativa", className: "border-amber-200 bg-amber-50 text-amber-800" };
  }
  if (outcome === "AUTH_REQUIRED") return { text: "Reconexão necessária", className: "border-red-200 bg-red-50 text-red-800" };
  return { text: "Falhou", className: "border-red-200 bg-red-50 text-red-800" };
}

function ContextualChecks({ checks, onSelect }: { checks: ComposerCheck[]; onSelect?: (check: ComposerCheck) => void }) {
  if (!checks.length) return null;
  return <div className="mt-4 space-y-2">
    {checks.map(check => <button
      key={`${check.option.id}:${check.text}`}
      type="button"
      onClick={() => onSelect?.(check)}
      className={`flex w-full min-w-0 items-center gap-3 rounded-xl border p-3 text-left ${check.level === "error" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}
    >
      <PlatformIcon platform={check.option.platform} small/>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-black text-slate-900">{check.option.label}</span>
        <span className={`mt-0.5 block text-xs leading-5 ${check.level === "error" ? "text-red-700" : "text-amber-700"}`}>{check.text}</span>
      </span>
      <CircleAlert size={16} className={`shrink-0 ${check.level === "error" ? "text-red-600" : "text-amber-600"}`}/>
    </button>)}
  </div>;
}

export function PublicationEditor() {
  const tenant = useTenantData();
  const initialized = useRef(false);
  const defaultSchedule = useRef(defaultScheduleParts()).current;

  const destinationOptions = useMemo<DestinationOption[]>(() => {
    if (tenant.source === "supabase") {
      return tenant.connections.flatMap(connection => {
        const baseOption = {
          platform: connection.platform,
          handle: connection.handle ?? connection.displayName ?? platformLabels[connection.platform],
          status: connection.status,
          connectionId: connection.id,
          advancedEnabled: connection.platform === "instagram" && connection.metadata?.meta_advanced_enabled === true,
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
  const [networksOpen, setNetworksOpen] = useState(false);
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
  const [stagedCover, setStagedCover] = useState<{ key: string; mediaId: string } | null>(null);
  const [coverSelection, setCoverSelection] = useState<CoverSelection>({ mode: "auto", file: null, previewUrl: null, aspect: "9:16" });
  const [instagramPlacement, setInstagramPlacement] = useState<InstagramPlacement>("both");
  const [outputAspect, setOutputAspect] = useState<CoverAspect>("9:16");
  const [mediaTab, setMediaTab] = useState<MediaEditorTab>("media");
  const [mediaTextTyping, setMediaTextTyping] = useState(false);
  const [carouselMode, setCarouselMode] = useState(false);
  const [carouselAdjusting, setCarouselAdjusting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [feedTextConfig, setFeedTextConfig] = useState<TextOverlayConfig>({ ...defaultTextOverlay });
  const [storyTextConfig, setStoryTextConfig] = useState<TextOverlayConfig>({ ...defaultTextOverlay });
  const [storyStartTextConfig, setStoryStartTextConfig] = useState<TextOverlayConfig>({ ...defaultTextOverlay });
  const [storyEndTextConfig, setStoryEndTextConfig] = useState<TextOverlayConfig>({ ...defaultTextOverlay });
  const [storyTextEdge, setStoryTextEdge] = useState<StoryTextEdge>("end");
  const [instagramAudioSelections, setInstagramAudioSelections] = useState<Record<string, InstagramAudioSelection | null>>({});
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([]);
  const [stagedCarouselMedia, setStagedCarouselMedia] = useState<Record<string, { key: string; mediaId: string }>>({});
  const carouselUrlsRef = useRef<Set<string>>(new Set());
  const [stagedStoryMedia, setStagedStoryMedia] = useState<{ key: string; mediaId: string } | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishComplete, setPublishComplete] = useState(false);
  const [publishResults, setPublishResults] = useState<PublishAttemptResult[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [existingMedia, setExistingMedia] = useState<{ id: string; name: string; type: "image" | "video"; size: number } | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [date, setDate] = useState(defaultSchedule.date);
  const [time, setTime] = useState(defaultSchedule.time);

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
      const nextAudioSelections: Record<string, InstagramAudioSelection | null> = {};
      const nextTimes: Record<string, string> = {};
      const clockValues: string[] = [];
      let hasInstagramFeedTarget = false;
      let hasInstagramStoryTarget = false;

      for (const target of targets) {
        const targetConfig = target.provider_config && typeof target.provider_config === "object" && !Array.isArray(target.provider_config)
          ? target.provider_config as Record<string, unknown>
          : {};
        const isInstagramStory = target.provider === "instagram" && targetConfig.surface === "story";
        if (target.provider === "instagram") {
          if (isInstagramStory) {
            hasInstagramStoryTarget = true;
          } else {
            hasInstagramFeedTarget = true;
            const rawAudio = targetConfig.audio_configuration && typeof targetConfig.audio_configuration === "object" && !Array.isArray(targetConfig.audio_configuration)
              ? targetConfig.audio_configuration as Record<string, unknown>
              : null;
            const audioId = typeof rawAudio?.audio_id === "string" ? rawAudio.audio_id : "";
            if (audioId && target.social_connection_id) {
              const numericVolume = (value: unknown) => {
                const parsed = typeof value === "number" ? value : Number(value);
                return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 100;
              };
              nextAudioSelections[target.social_connection_id] = {
                audioId,
                title: typeof targetConfig.audio_title === "string" && targetConfig.audio_title ? targetConfig.audio_title : "Música do Instagram",
                artist: typeof targetConfig.audio_artist === "string" ? targetConfig.audio_artist : null,
                audioType: targetConfig.audio_type === "original_sound" ? "original_sound" : "music",
                durationMs: null,
                coverUrl: null,
                previewUrl: null,
                audioVolume: numericVolume(rawAudio?.audio_volume),
                videoVolume: numericVolume(rawAudio?.video_volume),
              };
            }
          }
        }

        const optionId = target.provider === "youtube" && target.content_intent_override === "SHORT_FORM"
          ? target.social_connection_id + ":short"
          : target.provider === "youtube" && target.content_intent_override === "LONG_FORM"
            ? target.social_connection_id + ":video"
            : target.social_connection_id;

        if (!destinationOptions.some(option => option.id === optionId)) continue;
        if (!selected.includes(optionId)) selected.push(optionId);

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
      setInstagramAudioSelections(nextAudioSelections);
      setInstagramPlacement(hasInstagramStoryTarget ? (hasInstagramFeedTarget ? "both" : "story") : "feed");

      const firstScheduled = targets.find(target => {
        if (!target.scheduled_at) return false;
        const config = target.provider_config && typeof target.provider_config === "object" && !Array.isArray(target.provider_config)
          ? target.provider_config as Record<string, unknown>
          : {};
        return config.surface !== "story";
      })?.scheduled_at ?? targets.find(target => !!target.scheduled_at)?.scheduled_at;
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

  useEffect(() => () => {
    for (const url of carouselUrlsRef.current) URL.revokeObjectURL(url);
    carouselUrlsRef.current.clear();
  }, []);

  useEffect(() => () => {
    if (coverSelection.previewUrl) URL.revokeObjectURL(coverSelection.previewUrl);
  }, [coverSelection.previewUrl]);

  useEffect(() => {
    if (!isDirty || publishComplete) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const protectNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin || next.href === window.location.href) return;
      if (!window.confirm("Há alterações nesta publicação que podem ser perdidas. Deseja sair mesmo assim?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", protectNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", protectNavigation, true);
    };
  }, [isDirty, publishComplete]);

  const shortOptions = destinationOptions.filter(option => option.contentIntent !== "LONG_FORM");
  const longYouTubeOptions = destinationOptions.filter(option => option.contentIntent === "LONG_FORM");
  const selectedOptions = destinationOptions.filter(option => selectedIds.includes(option.id));
  const activeOption = selectedOptions.find(option => option.id === activeId) ?? selectedOptions[0] ?? destinationOptions[0];
  const hasInstagram = selectedOptions.some(option => option.platform === "instagram");
  const isCarousel = carouselMode && carouselItems.length > 0;
  const carouselPreviewItems = carouselItems.map(item => ({ id: item.id, previewUrl: item.previewUrl, transform: item.transform, adjusted: item.adjusted }));
  const requiresDescription = selectedOptions.some(option => !(option.platform === "instagram" && instagramPlacement === "story"));
  const canSaveDraft = selectedOptions.length > 0 && (!requiresDescription || !!base.trim());
  const canCoverTab = fileType === "video" && !!previewUrl && hasInstagram && instagramPlacement !== "story";
  const canTextTab = !!previewUrl && !!selectedFile && instagramPlacement !== "story";
  const canMusicTab = fileType === "video" && hasInstagram && instagramPlacement !== "story" && !isCarousel;
  const canStoriesTab = !isCarousel && !!previewUrl && !!selectedFile && hasInstagram && instagramPlacement !== "feed";
  const instagramMusicAccounts = selectedOptions
    .filter(option => option.platform === "instagram" && !!option.connectionId)
    .map(option => ({
      id: option.connectionId as string,
      label: option.label,
      handle: option.handle,
      advancedEnabled: option.advancedEnabled === true,
    }));
  const storyPreviewTiming = {
    timingMode: storyTextConfig.timingMode,
    startMs: storyTextConfig.startMs,
    endMs: storyTextConfig.endMs,
  } as const;
  const storyStartPreviewConfig: TextOverlayConfig = { ...storyStartTextConfig, ...storyPreviewTiming };
  const storyEndPreviewConfig: TextOverlayConfig = { ...storyEndTextConfig, ...storyPreviewTiming };

  const mediaTabs: Array<{ id: MediaEditorTab; label: string }> = [
    { id: "media", label: "Mídia" },
    ...(canCoverTab ? [{ id: "cover" as const, label: "Capa" }] : []),
    ...(canTextTab ? [{ id: "text" as const, label: "Texto" }] : []),
    ...(canMusicTab ? [{ id: "music" as const, label: "Música" }] : []),
    ...(canStoriesTab ? [{ id: "stories" as const, label: "Stories" }] : []),
  ];

  useEffect(() => {
    if (mediaTabs.some(item => item.id === mediaTab)) return;
    setMediaTab("media");
    setMediaTextTyping(false);
  }, [mediaTab, canCoverTab, canTextTab, canMusicTab, canStoriesTab]);

  async function handleFile(file?: File) {
    if (!file) return;
    setIsDirty(true);
    setSaveError("");
    setSaveMessage("Preparando mídia...");
    setMediaNotice("");
    setPublishComplete(false);
    setPublishResults([]);
    setPublishedUrl(null);
    setStagedCover(null);
    setStagedStoryMedia(null);
    setStagedCarouselMedia({});
    setCarouselMode(false);
    setCarouselAdjusting(false);
    for (const url of carouselUrlsRef.current) URL.revokeObjectURL(url);
    carouselUrlsRef.current.clear();
    setCarouselItems([]);
    setMediaTab("media");
    setFeedTextConfig({ ...defaultTextOverlay });
    setStoryTextConfig({ ...defaultTextOverlay });
    setStoryStartTextConfig({ ...defaultTextOverlay });
    setStoryEndTextConfig({ ...defaultTextOverlay });
    setStoryTextEdge("end");
    setInstagramAudioSelections({});
    setOutputAspect("9:16");
    if (coverSelection.previewUrl) URL.revokeObjectURL(coverSelection.previewUrl);
    setCoverSelection({ mode: "auto", file: null, previewUrl: null, aspect: "9:16" });

    try {
      const prepared = await prepareMediaFile(file, {
        onProgress: progress => {
          const suffix = progress.progress > 0 && progress.progress < 100 ? ` ${progress.progress}%` : "";
          setSaveMessage(`${progress.message}${suffix}`);
        },
      });
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
      setSaveMessage(prepared.notice ? "Mídia adaptada automaticamente." : "");
    } catch (error) {
      const code = error instanceof Error ? error.message : "unsupported_media_type";
      const messages: Record<string, string> = {
        media_conversion_too_large: "Este arquivo é grande demais para conversão automática no navegador. Arquivos que já estejam em MP4 continuam aceitos normalmente.",
        audio_conversion_too_large: "Este áudio é grande demais para ser transformado automaticamente em vídeo neste navegador.",
        media_conversion_failed: "Não foi possível converter esta mídia para MP4. Tente outro arquivo ou um MP4 já pronto.",
        audio_cover_failed: "Não foi possível gerar a capa automática para este áudio.",
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


  async function handleCarouselFiles(files?: FileList | null) {
    if (!files?.length) return;
    setIsDirty(true);
    const incoming = Array.from(files).slice(0, 10);

    setSaveError("");
    setSaveMessage("Preparando imagens do carrossel...");
    setPublishComplete(false);
    setPublishResults([]);
    setPublishedUrl(null);
    setStagedMedia(null);
    setStagedCarouselMedia({});
    setStagedCover(null);
    setStagedStoryMedia(null);
    setFeedTextConfig({ ...defaultTextOverlay });
    setStoryTextConfig({ ...defaultTextOverlay });
    setStoryStartTextConfig({ ...defaultTextOverlay });
    setStoryEndTextConfig({ ...defaultTextOverlay });
    setStoryTextEdge("end");
    setInstagramAudioSelections({});
    setOutputAspect("4:5");
    setMediaTab("media");
    setInstagramPlacement("feed");
    setCarouselMode(true);
    setCarouselAdjusting(false);

    try {
      const prepared = await Promise.all(incoming.map(file => prepareMediaFile(file)));
      if (prepared.some(item => item.kind !== "image")) {
        throw new Error("carousel_images_only");
      }

      for (const url of carouselUrlsRef.current) URL.revokeObjectURL(url);
      carouselUrlsRef.current.clear();
      const nextItems = prepared.map((item, index) => {
        const itemUrl = URL.createObjectURL(item.file);
        carouselUrlsRef.current.add(itemUrl);
        return { id: `${item.file.name}-${item.file.lastModified}-${index}`, file: item.file, previewUrl: itemUrl, metadata: item.metadata, transform: { ...defaultImageTransform }, adjusted: false } satisfies CarouselItem;
      });

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const primaryPreview = URL.createObjectURL(nextItems[0].file);
      setPreviewUrl(primaryPreview);
      setSelectedFile(nextItems[0].file);
      setFileName(nextItems.length === 1 ? "1 imagem no carrossel" : `${nextItems.length} imagens no carrossel`);
      setFileType("image");
      setFileSize(nextItems.reduce((sum, item) => sum + item.file.size, 0));
      setMediaMetadata(nextItems[0].metadata);
      setCarouselItems(nextItems);
      setMediaNotice(prepared.some(item => item.notice) ? "Algumas imagens foram adaptadas automaticamente para JPEG." : "");
      setUploadProgress(null);
      setSaveMessage("");
    } catch (error) {
      const code = error instanceof Error ? error.message : "carousel_failed";
      setSaveError(code === "carousel_images_only"
        ? "O carrossel aceita imagens. Selecione de 2 a 10 fotos."
        : "Não foi possível preparar uma das imagens do carrossel.");
      setSaveMessage("");
    }
  }

  async function handleAddCarouselFiles(files?: FileList | null) {
    if (!files?.length || !carouselMode) return;
    const capacity = Math.max(0, 10 - carouselItems.length);
    if (!capacity) {
      setSaveError("O carrossel aceita no máximo 10 imagens.");
      return;
    }
    const incoming = Array.from(files).slice(0, capacity);
    setIsDirty(true);
    setSaveError("");
    setSaveMessage("Adicionando imagens...");

    try {
      const prepared = await Promise.all(incoming.map(file => prepareMediaFile(file)));
      if (prepared.some(item => item.kind !== "image")) throw new Error("carousel_images_only");
      const added = prepared.map((item, index) => {
        const itemUrl = URL.createObjectURL(item.file);
        carouselUrlsRef.current.add(itemUrl);
        return {
          id: `${item.file.name}-${item.file.lastModified}-add-${Date.now()}-${index}`,
          file: item.file,
          previewUrl: itemUrl,
          metadata: item.metadata,
          transform: { ...defaultImageTransform },
          adjusted: false,
        } satisfies CarouselItem;
      });
      const next = [...carouselItems, ...added];
      setCarouselItems(next);
      setStagedCarouselMedia({});
      syncCarouselPrimary(next);
      setSaveMessage("");
    } catch {
      setSaveError("Não foi possível adicionar uma das imagens ao carrossel.");
      setSaveMessage("");
    }
  }

  function updateCarouselTransform(id: string, transform: ImageTransform) {
    setCarouselItems(current => current.map(item => item.id === id ? { ...item, transform, adjusted: true } : item));
    setStagedCarouselMedia({});
    setIsDirty(true);
  }

  function syncCarouselPrimary(items: CarouselItem[]) {
    if (!items.length) {
      removeFile();
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(items[0].file));
    setSelectedFile(items[0].file);
    setFileType("image");
    setMediaMetadata(items[0].metadata);
    setFileSize(items.reduce((sum, item) => sum + item.file.size, 0));
    setFileName(items.length === 1 ? "1 imagem no carrossel" : `${items.length} imagens no carrossel`);
  }

  function moveCarouselItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= carouselItems.length) return;
    const next = [...carouselItems];
    [next[index], next[target]] = [next[target], next[index]];
    setCarouselItems(next);
    setStagedCarouselMedia({});
    syncCarouselPrimary(next);
  }

  function removeCarouselItem(index: number) {
    const removed = carouselItems[index];
    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
      carouselUrlsRef.current.delete(removed.previewUrl);
    }
    const next = carouselItems.filter((_, itemIndex) => itemIndex !== index);
    setCarouselItems(next);
    if (!next.length) setCarouselMode(false);
    setStagedCarouselMedia({});
    syncCarouselPrimary(next);
  }

  function removeFile() {
    setIsDirty(true);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setUploadProgress(null);
    setMediaNotice("");
    setMediaMetadata({ durationMs: null, width: null, height: null });
    setStagedMedia(null);
    setStagedCover(null);
    setStagedStoryMedia(null);
    setStagedCarouselMedia({});
    for (const url of carouselUrlsRef.current) URL.revokeObjectURL(url);
    carouselUrlsRef.current.clear();
    setCarouselItems([]);
    setCarouselMode(false);
    setCarouselAdjusting(false);
    setMediaTextTyping(false);
    setFeedTextConfig({ ...defaultTextOverlay });
    setStoryTextConfig({ ...defaultTextOverlay });
    setStoryStartTextConfig({ ...defaultTextOverlay });
    setStoryEndTextConfig({ ...defaultTextOverlay });
    setStoryTextEdge("end");
    setInstagramAudioSelections({});
    setPublishComplete(false);
    setPublishResults([]);
    setPublishedUrl(null);
    if (coverSelection.previewUrl) URL.revokeObjectURL(coverSelection.previewUrl);
    setCoverSelection({ mode: "auto", file: null, previewUrl: null, aspect: "9:16" });

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
    setIsDirty(true);
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
    setIsDirty(true);
    const suffixes = includeEmojis ? aiSuffixEmoji : aiSuffixPlain;
    const next = { ...texts };
    const nextTitles = { ...titles };
    selectedOptions.forEach(option => {
      if (option.platform === "instagram" && instagramPlacement === "story") return;
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

  const checks: ComposerCheck[] = selectedOptions.map(option => {
    const storyOnly = option.platform === "instagram" && instagramPlacement === "story";
    if (!storyOnly && !base.trim()) return { option, level: "error" as const, text: "Adicione a descrição base" };
    if (tenant.source === "supabase" && option.status !== "connected") return { option, level: "error" as const, text: "Conta precisa ser reconectada" };

    if (mode === "schedule") {
      const targetTime = differentTimes ? (destinationTimes[option.id] || time) : time;
      const scheduled = new Date(`${date}T${targetTime}:00`);
      if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now() + 60_000) {
        return { option, level: "error" as const, text: "Escolha um horário pelo menos 1 minuto no futuro" };
      }
    }

    if (isCarousel && carouselItems.length < 2) {
      return { option, level: "error" as const, text: "Adicione pelo menos 2 imagens ao carrossel" };
    }
    if (isCarousel && !["instagram", "facebook"].includes(option.platform)) {
      return { option, level: "error" as const, text: "Carrossel disponível no Instagram e Facebook nesta etapa" };
    }
    if (isCarousel && option.platform === "instagram" && instagramPlacement !== "feed") {
      return { option, level: "error" as const, text: "Carrossel do Instagram usa Feed / Reels" };
    }

    if (option.platform === "instagram") {
      if (!fileType && !existingMedia) return { option, level: "error" as const, text: "Adicione uma imagem ou vídeo" };
      if (!storyOnly && fileType === "video" && mediaMetadata.durationMs !== null && mediaMetadata.durationMs < 3_000) return { option, level: "error" as const, text: "Reel precisa ter ao menos 3 segundos" };
      if (!storyOnly && fileType === "video" && mediaMetadata.durationMs !== null && mediaMetadata.durationMs > 15 * 60 * 1000) return { option, level: "error" as const, text: "Reel ultrapassa 15 minutos" };
      if (!storyOnly && fileType === "video" && mediaMetadata.width !== null && mediaMetadata.width > 1920) return { option, level: "error" as const, text: "Reduza a largura do Reel para até 1920 px" };
      if (fileType === "video" && fileSize > 1024 * 1024 * 1024) return { option, level: "error" as const, text: "Vídeo do Instagram ultrapassa 1 GB" };
    }

    if (option.contentIntent === "LONG_FORM") {
      if (fileType !== "video") return { option, level: "error" as const, text: "Adicione um vídeo para o YouTube" };
      if (fileSize > 10 * 1024 * 1024 * 1024) return { option, level: "error" as const, text: "O limite inicial é 10 GB" };
      if (!(titles[option.id]?.trim())) return { option, level: "warning" as const, text: "Adicione um título ao vídeo" };
    }

    if (!storyOnly && effectiveText(option).length > 2000) return { option, level: "warning" as const, text: "Revise o tamanho da descrição" };
    return { option, level: "ok" as const, text: storyOnly ? "Pronto para Story" : "Pronto" };
  });

  const actionableChecks = checks.filter(check => check.level !== "ok");
  const whereChecks = actionableChecks.filter(check => check.text === "Conta precisa ser reconectada");
  const scheduleChecks = actionableChecks.filter(check => check.text.startsWith("Escolha um horário"));
  const descriptionChecks = actionableChecks.filter(check =>
    check.text.includes("descrição") || check.text.includes("título")
  );
  const mediaChecks = actionableChecks.filter(check =>
    !whereChecks.includes(check) && !scheduleChecks.includes(check) && !descriptionChecks.includes(check)
  );

  const canSubmit = selectedOptions.length > 0 && (!requiresDescription || !!base.trim()) && !checks.some(check => check.level === "error");

  async function persist(intent: SaveIntent) {
    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    setPublishComplete(false);
    setPublishResults([]);
    setPublishedUrl(null);

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

    const sharedStoryTiming = {
      timingMode: storyTextConfig.timingMode,
      startMs: storyTextConfig.startMs,
      endMs: storyTextConfig.endMs,
    } as const;
    const storyStartConfig: TextOverlayConfig = { ...storyStartTextConfig, ...sharedStoryTiming };
    const storyEndConfig: TextOverlayConfig = { ...storyEndTextConfig, ...sharedStoryTiming };
    const storyRangeHasText = storyTextConfig.timingMode === "range"
      && (!!storyStartConfig.text.trim() || !!storyEndConfig.text.trim());

    const selectedKind: "image" | "video" = fileType ?? (selectedFile?.type.startsWith("video/") ? "video" : "image");
    let baseMediaFile = selectedFile;
    let baseMediaMetadata = mediaMetadata;
    let storyMediaFile: File | null = null;
    let storyMediaMetadata = metadataForAspect(mediaMetadata, "9:16");
    let carouselMediaFiles: File[] = [];

    try {
      if (isCarousel) {
        setSaveMessage("Preparando imagens do carrossel...");
        carouselMediaFiles = await Promise.all(carouselItems.map(async item => {
          const adjustedFile = await applyImageTransform(item.file, outputAspect, item.transform);
          return composeTextOnMedia(adjustedFile, "image", feedTextConfig);
        }));
        baseMediaFile = null;
      } else if (selectedFile) {
        const prepareVariant = async (
          aspect: CoverAspect,
          textConfig: TextOverlayConfig,
          label: string,
        ) => {
          if (selectedKind === "image") {
            setSaveMessage(label);
            const framed = await applyImageTransform(selectedFile, aspect, defaultImageTransform);
            return composeTextOnMedia(framed, "image", textConfig);
          }

          if (textConfig.text.trim()) {
            setSaveMessage(label);
            return composeTextOnMedia(selectedFile, "video", textConfig, (progress, message) => {
              setUploadProgress(progress);
              setSaveMessage(message);
            }, aspect);
          }

          if (mediaMatchesAspect(mediaMetadata, aspect)) return selectedFile;

          setSaveMessage("Ajustando o vídeo ao formato selecionado...");
          return transcodeVideoToAspect(selectedFile, aspect, progress => {
            setUploadProgress(progress.progress);
            setSaveMessage(progress.message);
          });
        };

        const prepareStoryVariant = async () => {
          if (selectedKind !== "video" || storyTextConfig.timingMode !== "range") {
            return prepareVariant("9:16", storyTextConfig, "Preparando versão dos Stories...");
          }

          if (storyRangeHasText) {
            setSaveMessage("Preparando textos do início e fim dos Stories...");
            return composeTimedTextLayersOnVideo(
              selectedFile,
              [
                { config: storyStartConfig, edge: "start" },
                { config: storyEndConfig, edge: "end" },
              ],
              (progress, message) => {
                setUploadProgress(progress);
                setSaveMessage(message);
              },
              "9:16",
            );
          }

          if (mediaMatchesAspect(mediaMetadata, "9:16")) return selectedFile;
          setSaveMessage("Ajustando o vídeo dos Stories para 9:16...");
          return transcodeVideoToAspect(selectedFile, "9:16", progress => {
            setUploadProgress(progress.progress);
            setSaveMessage(progress.message);
          });
        };

        const baseAspect: CoverAspect = instagramPlacement === "story" ? "9:16" : outputAspect;
        const baseText = instagramPlacement === "story" ? storyTextConfig : feedTextConfig;
        baseMediaFile = instagramPlacement === "story"
          ? await prepareStoryVariant()
          : await prepareVariant(
              baseAspect,
              baseText,
              "Preparando mídia no formato selecionado...",
            );
        baseMediaMetadata = baseMediaFile === selectedFile ? mediaMetadata : metadataForAspect(mediaMetadata, baseAspect);

        if (instagramPlacement === "both") {
          const storyNeedsOwnFile = outputAspect !== "9:16"
            || storyRangeHasText
            || JSON.stringify(feedTextConfig) !== JSON.stringify(storyTextConfig);
          if (storyNeedsOwnFile) {
            storyMediaFile = await prepareStoryVariant();
            storyMediaMetadata = storyMediaFile === selectedFile ? mediaMetadata : metadataForAspect(mediaMetadata, "9:16");
          }
        }
      }
    } catch (overlayError) {
      const code = overlayError instanceof Error ? overlayError.message : "media_prepare_failed";
      const message = code === "text_overlay_video_too_large"
        ? "Este vídeo é grande demais para aplicar texto no navegador. Remova o texto do vídeo ou use um arquivo menor."
        : code === "media_conversion_too_large"
          ? "Este vídeo é grande demais para ajustar o formato no navegador. Use um arquivo menor ou mantenha uma proporção compatível com o original."
          : code === "media_conversion_failed"
            ? "Não foi possível ajustar este vídeo ao formato escolhido. Tente outro arquivo ou um MP4 já compatível."
            : "Não foi possível preparar a mídia no formato escolhido. Revise a edição e tente novamente.";
      setSaveError(message);
      setSaveMessage("");
      setUploadProgress(null);
      setSaving(false);
      return;
    }

    let mediaId: string | null = null;
    const carouselMediaIds: string[] = [];
    if (isCarousel && carouselMediaFiles.length) {
      const nextStaged = { ...stagedCarouselMedia };
      for (let index = 0; index < carouselMediaFiles.length; index += 1) {
        const carouselFile = carouselMediaFiles[index];
        const sourceItem = carouselItems[index];
        const mediaKey = [carouselFile.name, carouselFile.size, carouselFile.lastModified, retention].join(":");
        const cached = nextStaged[sourceItem.id];
        if (cached?.key === mediaKey) {
          carouselMediaIds.push(cached.mediaId);
          continue;
        }
        setUploadProgress(Math.round((index / carouselMediaFiles.length) * 100));
        setSaveMessage(`Enviando imagem ${index + 1} de ${carouselMediaFiles.length}...`);
        try {
          const uploaded = await uploadMediaFile({
            file: carouselFile,
            brandId: tenant.activeBrand.id,
            retention,
            metadata: metadataForAspect(sourceItem.metadata, outputAspect),
          });
          nextStaged[sourceItem.id] = { key: mediaKey, mediaId: uploaded.mediaId };
          carouselMediaIds.push(uploaded.mediaId);
        } catch {
          setSaveError(`Não foi possível enviar a imagem ${index + 1} do carrossel.`);
          setSaveMessage("");
          setUploadProgress(null);
          setSaving(false);
          return;
        }
      }
      setStagedCarouselMedia(nextStaged);
      setUploadProgress(100);
    }

    if (baseMediaFile) {
      const mediaKey = [baseMediaFile.name, baseMediaFile.size, baseMediaFile.lastModified, retention].join(":");

      if (stagedMedia?.key === mediaKey) {
        mediaId = stagedMedia.mediaId;
      } else {
        setUploadProgress(0);
        setSaveMessage("Enviando mídia para o staging seguro...");

        try {
          const uploaded = await uploadMediaFile({
            file: baseMediaFile,
            brandId: tenant.activeBrand.id,
            retention,
            metadata: baseMediaMetadata,
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
      const storyOnly = option.platform === "instagram" && instagramPlacement === "story";
      return {
        connection_id: option.connectionId as string,
        provider: option.platform,
        scheduled_at: intent === "publish_now" ? new Date().toISOString() : toIso(date, targetTime),
        scheduled_timezone: timezone,
        caption_override: storyOnly ? "" : effectiveText(option) === base ? "" : effectiveText(option),
        title_override: titles[option.id] ?? "",
        requested_action: intent,
        retention: retention,
        surface: storyOnly ? "story" : option.surface ?? null,
        content_intent: isCarousel ? "CAROUSEL" : option.contentIntent ?? "AUTO",
        file_size_bytes: fileSize || null,
      };
    });

    const postPayload = {
      p_internal_title: base.trim().slice(0, 80) || (hasInstagram && instagramPlacement === "story" ? "Story do Instagram" : "Nova publicação"),
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

    if (!isCarousel && instagramPlacement === "both" && hasInstagram && postId) {
      const storyResult = await client.rpc("add_instagram_story_targets", { p_post_id: postId });
      if (storyResult.error) {
        setSaveError("A publicação foi salva, mas não conseguimos preparar a cópia para os Stories. Tente novamente antes de publicar.");
        setSaving(false);
        return;
      }
    }

    if (postId && !isCarousel && instagramPlacement !== "story") {
      for (const option of selectedOptions.filter(item => item.platform === "instagram" && !!item.connectionId)) {
        const connectionId = option.connectionId as string;
        const audio = instagramAudioSelections[connectionId] ?? null;
        const audioResult = await client.rpc("set_instagram_audio_config", {
          p_post_id: postId,
          p_connection_id: connectionId,
          p_audio_id: audio?.audioId ?? null,
          p_audio_volume: audio?.audioVolume ?? 100,
          p_video_volume: audio?.videoVolume ?? 100,
          p_audio_title: audio?.title ?? null,
          p_audio_artist: audio?.artist ?? null,
          p_audio_type: audio?.audioType ?? "music",
        });
        if (audioResult.error) {
          setSaveError("A publicação foi salva, mas não conseguimos registrar a música do Instagram. Tente novamente antes de publicar.");
          setSaving(false);
          return;
        }
      }
    }

    if (carouselMediaIds.length > 1 && postId) {
      const mediaResult = await client.rpc("attach_media_items_to_post", {
        p_post_id: postId,
        p_media_asset_ids: carouselMediaIds,
      });
      if (mediaResult.error) {
        setSaveError("A publicação foi salva, mas não conseguimos vincular as imagens do carrossel.");
        setSaving(false);
        return;
      }
    } else if (mediaId && postId) {
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

    if (storyMediaFile && hasInstagram && instagramPlacement === "both" && postId) {
      const storyKey = [storyMediaFile.name, storyMediaFile.size, storyMediaFile.lastModified, retention].join(":");
      let storyMediaId = stagedStoryMedia?.key === storyKey ? stagedStoryMedia.mediaId : null;

      if (!storyMediaId) {
        setSaveMessage("Enviando versão dos Stories...");
        try {
          const uploadedStory = await uploadMediaFile({
            file: storyMediaFile,
            brandId: tenant.activeBrand.id,
            retention,
            metadata: storyMediaMetadata,
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

    if (coverSelection.file && fileType === "video" && hasInstagram && instagramPlacement !== "story" && postId) {
      const coverKey = [coverSelection.file.name, coverSelection.file.size, coverSelection.file.lastModified, retention].join(":");
      let coverMediaId = stagedCover?.key === coverKey ? stagedCover.mediaId : null;

      if (!coverMediaId) {
        setSaveMessage("Enviando capa do vídeo...");
        try {
          const uploadedCover = await uploadMediaFile({
            file: coverSelection.file,
            brandId: tenant.activeBrand.id,
            retention,
          });
          coverMediaId = uploadedCover.mediaId;
          setStagedCover({ key: coverKey, mediaId: uploadedCover.mediaId });
        } catch {
          setSaveError("A publicação foi salva, mas não conseguimos enviar a capa personalizada.");
          setSaving(false);
          return;
        }
      }

      const coverResult = await client.rpc("attach_cover_to_post", {
        p_post_id: postId,
        p_media_asset_id: coverMediaId,
      });
      if (coverResult.error) {
        setSaveError("A publicação foi salva, mas não conseguimos vincular a capa ao vídeo.");
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
        results?: PublishAttemptResult[];
      };

      if (!publishResponse.ok) {
        setSaveError(publishResult?.message ?? "A publicação foi salva, mas o worker não conseguiu iniciar o envio externo.");
        setSaving(false);
        return;
      }

      const results = publishResult?.results ?? [];
      setPublishResults(results);

      const succeeded = publishResult?.succeeded ?? 0;
      const needsRetry = publishResult?.needsRetry ?? 0;
      const failed = publishResult?.failed ?? 0;

      if (failed > 0) {
        const firstFailure = results.find(item => !["SUCCEEDED", "TRANSIENT_FAILURE", "RATE_LIMIT", "UNKNOWN"].includes(item.outcome));
        if (succeeded > 0) setSaveMessage(`${succeeded} destino${succeeded === 1 ? " publicado" : "s publicados"}.`);
        setSaveError(firstFailure?.errorMessage ?? "A publicação foi processada, mas um dos destinos recusou o conteúdo.");
      } else if (needsRetry > 0) {
        setSaveMessage(succeeded > 0
          ? `${succeeded} destino${succeeded === 1 ? " publicado" : "s publicados"}. ${needsRetry} aguardando nova tentativa automática.`
          : "Envio iniciado. Os destinos abaixo aguardam nova tentativa automática.");
      } else if (succeeded > 0) {
        const directUrl = results.find(item => item.outcome === "SUCCEEDED" && item.publicUrl)?.publicUrl ?? null;
        setPublishedUrl(directUrl);
        setPublishComplete(true);
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

    setIsDirty(false);
    setSaving(false);
    if (selectedFile) setUploadProgress(100);
  }

  return <div className="w-full max-w-full space-y-5 overflow-x-hidden">
    <section>
      <p className="eyebrow">Marca: {tenant.activeBrand.name}</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{editingPostId ? "Editar publicação" : "Criar publicação"}</h1>
      <p className="mt-1 text-sm leading-6 text-slate-500">{editingPostId ? "Altere conteúdo, destinos e horário antes da primeira tentativa de envio." : "Destinos, mídia, descrição e horário em um único fluxo."}</p>
      {loadingEdit && <p className="mt-2 text-xs font-bold text-indigo-600">Carregando publicação...</p>}
    </section>

    <div className="grid w-full max-w-full gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <section className="card min-w-0 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-950 sm:text-sm">1. Onde publicar?</h2>
            <p className="mt-1 text-sm text-slate-500 sm:text-xs">Escolha primeiro os destinos. O Tela Social adapta as próximas etapas ao que você selecionar.</p>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button type="button" onClick={() => setNetworksOpen(current => !current)} aria-expanded={networksOpen} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
              <span className="min-w-0">
                <span className="block text-sm font-black text-slate-900">Redes sociais conectadas</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{selectedOptions.length ? `${selectedOptions.length} destino${selectedOptions.length === 1 ? " selecionado" : "s selecionados"}` : "Toque para escolher onde publicar"}</span>
              </span>
              <ChevronDown size={18} className={`shrink-0 text-blue-600 transition-transform ${networksOpen ? "rotate-180" : ""}`}/>
            </button>
            {networksOpen && <div className="border-t border-slate-200 p-3 sm:p-4">
              {!!shortOptions.length && <button type="button" onClick={() => {
                setIsDirty(true);
                const shortIds = shortOptions.map(option => option.id);
                const allShortSelected = shortIds.every(id => selectedIds.includes(id));
                setSelectedIds(current => allShortSelected
                  ? current.filter(id => !shortIds.includes(id))
                  : Array.from(new Set([...current, ...shortIds])));
              }} className="mb-3 text-sm font-bold text-blue-700 sm:text-xs">
                {shortOptions.every(option => selectedIds.includes(option.id)) ? "Limpar seleção" : "Selecionar todos"}
              </button>}
          {tenant.source === "supabase" && !destinationOptions.length ? <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <p className="text-sm font-bold text-slate-900">Nenhuma conta social conectada ainda.</p>
            <p className="mt-1 text-sm text-slate-500">Conecte pelo menos uma conta antes de criar destinos reais.</p>
            <Link href="/conexoes" className="btn-secondary mt-3">Ir para Contas</Link>
          </div> : <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Redes sociais conectadas</p>
              <div className="mt-2 grid w-full max-w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {shortOptions.map(option => {
                  const active = selectedIds.includes(option.id);
                  const blocked = tenant.source === "supabase" && option.status !== "connected";
                  return <button key={option.id} onClick={() => toggle(option)} aria-pressed={active} className={`focusable flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors ${active ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                    <PlatformIcon platform={option.platform} small/>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900 sm:text-xs">{option.label}</span>
                      <span className={`block truncate text-sm sm:text-xs ${blocked ? "text-amber-600" : "text-slate-500"}`}>{blocked ? "Reconexão necessária" : option.handle}</span>
                      {option.platform === "instagram" && <span className={`mt-0.5 block text-[10px] font-bold ${option.advancedEnabled ? "text-indigo-600" : "text-slate-400"}`}>{option.advancedEnabled ? "Recursos avançados ativos" : "Recursos avançados não ativados"}</span>}
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

            </div>}
          </div>

          {hasInstagram && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <div>
              <p className="text-sm font-black text-slate-900">Formato da publicação</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Escolha onde o conteúdo deve aparecer.</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([
                { value: "feed" as const, label: "Feed" },
                { value: "story" as const, label: "Stories" },
                { value: "both" as const, label: "Ambos" },
              ]).map(item => <button key={item.value} type="button" onClick={() => { setInstagramPlacement(item.value); setSaveMessage(""); setIsDirty(true); }} aria-pressed={instagramPlacement === item.value} className={`min-w-0 rounded-xl border px-2 py-2.5 text-center transition-colors sm:px-3 sm:py-3 ${instagramPlacement === item.value ? "border-blue-500 bg-blue-600 shadow-sm" : "border-blue-100 bg-white hover:border-blue-200 hover:bg-blue-50"}`}>
                <span className={`block truncate text-xs font-black sm:text-sm ${instagramPlacement === item.value ? "text-white" : "text-slate-800"}`}>{item.label}</span>
              </button>)}
            </div>
          </div>}
          <ContextualChecks checks={whereChecks} onSelect={check => { setNetworksOpen(true); setActiveId(check.option.id); }}/>
        </section>

        <section className="card p-4 sm:p-5">
          <div>
            <h2 className="text-base font-bold text-slate-950 sm:text-sm">2. Mídia</h2>
            <p className="mt-1 text-sm text-slate-500 sm:text-xs">Envie um arquivo ou escolha algo que já está na biblioteca.</p>
          </div>

          {previewUrl || existingMedia ? <div className="mt-4 min-w-0">
            <div className="grid gap-1 rounded-xl bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${mediaTabs.length}, minmax(0, 1fr))` }}>
              {mediaTabs.map(item => <button
                key={item.id}
                type="button"
                onClick={() => { setMediaTab(item.id); setMediaTextTyping(false); setCarouselAdjusting(false); }}
                className={`min-w-0 rounded-lg px-1.5 py-2 text-center text-[11px] font-black transition-colors sm:px-3 sm:text-xs ${mediaTab === item.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
              >{item.label}</button>)}
            </div>

            {mediaTab === "media" && <div className="mt-3">
              {isCarousel && carouselAdjusting
                ? <CarouselImageAdjuster
                    items={carouselItems.map(item => ({ id: item.id, previewUrl: item.previewUrl, transform: item.transform }))}
                    aspect={outputAspect}
                    onChange={updateCarouselTransform}
                    onDone={() => setCarouselAdjusting(false)}
                  />
                : <div
                    className="mx-auto w-full max-w-[360px] overflow-hidden rounded-xl bg-black shadow-sm"
                    style={{ aspectRatio: mediaAspectRatio(outputAspect) }}
                  >
                    {previewUrl ? <PublicationMediaPreview
                      previewUrl={previewUrl}
                      fileType={fileType}
                      textConfig={{ ...defaultTextOverlay }}
                      durationMs={mediaMetadata.durationMs}
                      carouselItems={carouselPreviewItems}
                      fit="cover"
                      aspect={outputAspect}
                    /> : <div className="grid h-full place-items-center text-center text-slate-400"><div><Play className="mx-auto" size={28}/><p className="mt-2 px-3 text-xs font-bold">Mídia já vinculada</p></div></div>}
                  </div>}
              {isCarousel && !carouselAdjusting && <div className="mt-2 flex justify-center">
                <button type="button" onClick={() => setCarouselAdjusting(true)} className="btn-secondary !px-3 !py-2 text-xs">Ajustar imagens</button>
              </div>}

              <div className="mt-3 min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="truncate text-sm font-bold text-slate-900">{fileName}</p>
                <p className="mt-1 text-sm text-slate-500 sm:text-xs">{formatMediaSize(fileSize)}</p>
                {mediaNotice && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">{mediaNotice}</p>}
                {uploadProgress !== null && uploadProgress < 100 && <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: uploadProgress + "%" }}/></div>
                  <p className="mt-1 text-xs font-bold text-slate-500">Upload {uploadProgress}%</p>
                </div>}

                <div className={`mt-4 ${isCarousel ? "grid grid-cols-3 gap-1.5" : "flex flex-wrap gap-2"}`}>
                  {isCarousel ? <>
                    <label className="btn-secondary w-full cursor-pointer justify-center !px-1.5 !py-2 text-[11px] sm:text-xs"><UploadCloud size={14}/> Substituir<input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp" className="sr-only" onChange={event => void handleCarouselFiles(event.target.files)}/></label>
                    <label className="btn-secondary w-full cursor-pointer justify-center !px-1.5 !py-2 text-[11px] sm:text-xs"><Plus size={14}/> Adicionar<input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp" className="sr-only" onChange={event => void handleAddCarouselFiles(event.target.files)}/></label>
                  </> : <label className="btn-secondary cursor-pointer"><UploadCloud size={15}/> Substituir<input type="file" accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,.gif,.mp4,.mov,.webm,.avi,.mkv,.mpeg,.mpg,.m4v,.3gp,.ogv,.mp3,.wav,.m4a,.aac,.ogg,.flac,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp,image/gif,video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,video/mpeg,video/x-m4v,video/3gpp,video/ogg,audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,audio/flac" className="sr-only" onChange={event => handleFile(event.target.files?.[0])}/></label>}
                  {selectedFile && <button type="button" onClick={removeFile} className={`btn-secondary !text-red-600 ${isCarousel ? "w-full justify-center !px-1.5 !py-2 text-[11px] sm:text-xs" : ""}`}><Trash2 size={isCarousel ? 14 : 15}/> Cancelar</button>}
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="text-xs font-black text-slate-700">Formato da mídia</p>
                  <div className="mt-2 grid grid-cols-5 gap-1.5">
                    {mediaAspects.map(aspect => <button key={aspect} type="button" onClick={() => { setOutputAspect(aspect); setCoverSelection(current => ({ ...current, aspect })); setStagedMedia(null); setStagedCover(null); setStagedCarouselMedia({}); setIsDirty(true); }} className={`rounded-lg border px-1.5 py-2 text-xs font-black ${outputAspect === aspect ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{aspect}</button>)}
                  </div>
                  {loadedAspectLabel(mediaMetadata.width, mediaMetadata.height) && loadedAspectLabel(mediaMetadata.width, mediaMetadata.height) !== outputAspect && <p className="mt-2 text-[11px] font-semibold text-slate-500">Formato carregado: {loadedAspectLabel(mediaMetadata.width, mediaMetadata.height)}</p>}
                </div>

                {isCarousel && <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="text-xs font-black text-slate-700">Ordem do carrossel</p>
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {carouselItems.map((item, index) => <div key={item.id} className="w-24 shrink-0 rounded-lg border border-slate-200 bg-white p-1.5">
                      <div className="relative aspect-square overflow-hidden rounded-md bg-slate-100"><img src={item.previewUrl} alt={`Imagem ${index + 1}`} className="h-full w-full object-cover"/><span className="absolute left-1 top-1 rounded bg-slate-950/70 px-1.5 py-0.5 text-[9px] font-black text-white">{index + 1}</span></div>
                      <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] font-black">
                        <button type="button" onClick={() => { moveCarouselItem(index, -1); setIsDirty(true); }} disabled={index === 0} className="rounded bg-slate-100 py-1 disabled:opacity-30">←</button>
                        <button type="button" aria-label={`Excluir imagem ${index + 1}`} title="Excluir imagem" onClick={() => { removeCarouselItem(index); setIsDirty(true); }} className="grid place-items-center rounded bg-red-50 py-1 text-red-600"><Trash2 size={13}/></button>
                        <button type="button" onClick={() => { moveCarouselItem(index, 1); setIsDirty(true); }} disabled={index === carouselItems.length - 1} className="rounded bg-slate-100 py-1 disabled:opacity-30">→</button>
                      </div>
                    </div>)}
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">De 2 a 10 imagens. A primeira imagem será a capa visual do carrossel.</p>
                </div>}

                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="text-sm font-bold text-slate-700 sm:text-xs">Depois de concluir todas as publicações</p>
                  <label className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-600 sm:text-xs"><input type="checkbox" checked={retention === "library"} onChange={event => { setRetention(event.target.checked ? "library" : "delete"); setIsDirty(true); }}/> Manter na biblioteca do Tela Social</label>
                </div>
              </div>
            </div>}

            {mediaTab === "cover" && canCoverTab && previewUrl && <div className="mt-3">
              <VideoCoverEditor
                videoUrl={previewUrl}
                durationMs={mediaMetadata.durationMs}
                aspect={outputAspect}
                onChange={selection => {
                  if (coverSelection.previewUrl && coverSelection.previewUrl !== selection.previewUrl) URL.revokeObjectURL(coverSelection.previewUrl);
                  setCoverSelection(selection);
                  setStagedCover(null);
                  if (selection.mode !== "auto" || coverSelection.mode !== "auto") setIsDirty(true);
                }}
              />
            </div>}

            {mediaTab === "text" && canTextTab && previewUrl && selectedFile && <div className="mt-3 space-y-2">
              {fileType === "video" && <TextTimingControl config={feedTextConfig} durationMs={mediaMetadata.durationMs} onChange={config => { setFeedTextConfig(config); setStagedMedia(null); setIsDirty(true); }}/>}
              <div className={`sticky top-2 z-20 mx-auto overflow-hidden rounded-xl bg-black shadow-sm transition-all sm:static ${mediaTextTyping ? "w-[140px] sm:w-full sm:max-w-[360px]" : "w-full max-w-[360px]"}`} style={{ aspectRatio: mediaAspectRatio(outputAspect) }}>
                <PublicationMediaPreview
                  previewUrl={previewUrl}
                  fileType={fileType}
                  textConfig={feedTextConfig}
                  durationMs={mediaMetadata.durationMs}
                  posterUrl={coverSelection.previewUrl}
                  carouselItems={carouselPreviewItems}
                  fit="cover"
                  aspect={outputAspect}
                  interactive
                  onTextChange={config => { setFeedTextConfig(config); setStagedMedia(null); setStagedCarouselMedia({}); setIsDirty(true); }}
                />
              </div>
              <MediaTextEditor
                sourceFile={selectedFile}
                sourceUrl={previewUrl}
                kind={fileType === "video" ? "video" : "image"}
                width={mediaMetadata.width}
                height={mediaMetadata.height}
                durationMs={mediaMetadata.durationMs}
                title=""
                value={feedTextConfig}
                showPreview={false}
                showTimingControl={false}
                allowPositionToggle={false}
                onTypingChange={setMediaTextTyping}
                onChange={(_file, _nextPreviewUrl, config) => { setFeedTextConfig(config); setStagedMedia(null); setStagedCarouselMedia({}); setIsDirty(true); }}
              />
            </div>}

            {mediaTab === "music" && canMusicTab && <div className="mt-3">
              {instagramPlacement === "both" && <p className="mb-3 rounded-lg border border-blue-100 bg-blue-50 p-2.5 text-[11px] font-semibold leading-4 text-blue-800">A música será aplicada ao Reel do Feed. A cópia publicada nos Stories mantém o áudio original do vídeo.</p>}
              <InstagramMusicEditor
                brandId={tenant.activeBrand.id}
                accounts={instagramMusicAccounts}
                selections={instagramAudioSelections}
                onChange={(connectionId, value) => {
                  setInstagramAudioSelections(current => ({ ...current, [connectionId]: value }));
                  setSaveMessage("");
                  setIsDirty(true);
                }}
              />
            </div>}

            {mediaTab === "stories" && canStoriesTab && previewUrl && selectedFile && <div className="mt-3 space-y-2">
              {fileType === "video" && <TextTimingControl
                config={storyTextConfig}
                durationMs={mediaMetadata.durationMs}
                onChange={config => {
                  setStoryTextConfig(config);
                  setStoryStartTextConfig(current => ({ ...current, timingMode: config.timingMode, startMs: config.startMs, endMs: config.endMs }));
                  setStoryEndTextConfig(current => ({ ...current, timingMode: config.timingMode, startMs: config.startMs, endMs: config.endMs }));
                  setStagedStoryMedia(null);
                  setIsDirty(true);
                }}
              />}
              {(() => {
                const sharedTiming = { timingMode: storyTextConfig.timingMode, startMs: storyTextConfig.startMs, endMs: storyTextConfig.endMs } as const;
                const startConfig: TextOverlayConfig = { ...storyStartTextConfig, ...sharedTiming };
                const endConfig: TextOverlayConfig = { ...storyEndTextConfig, ...sharedTiming };
                const activeConfig = storyTextConfig.timingMode === "range"
                  ? (storyTextEdge === "start" ? startConfig : endConfig)
                  : storyTextConfig;
                const secondaryConfig = storyTextConfig.timingMode === "range"
                  ? (storyTextEdge === "start" ? endConfig : startConfig)
                  : undefined;
                const activeEdge = storyTextConfig.timingMode === "range" ? storyTextEdge : "both";
                const secondaryEdge = storyTextEdge === "start" ? "end" : "start";

                const updateActiveStoryText = (config: TextOverlayConfig) => {
                  if (storyTextConfig.timingMode !== "range") {
                    setStoryTextConfig(config);
                  } else if (storyTextEdge === "start") {
                    setStoryStartTextConfig(config);
                  } else {
                    setStoryEndTextConfig(config);
                  }
                  setStagedStoryMedia(null);
                  setIsDirty(true);
                };

                const edgeSelector = storyTextConfig.timingMode === "range" ? <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-bold text-slate-600">
                  <span className="text-slate-400">Editar:</span>
                  {(["start", "end"] as StoryTextEdge[]).map(edge => <label key={edge} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="story-text-edge"
                      value={edge}
                      checked={storyTextEdge === edge}
                      onChange={() => setStoryTextEdge(edge)}
                      className="accent-blue-600"
                    />
                    {edge === "start" ? "Início" : "Fim"}
                  </label>)}
                </div> : undefined;

                return <>
                  <div className={`sticky top-2 z-20 mx-auto aspect-[9/16] overflow-hidden rounded-xl bg-black shadow-sm transition-all sm:static ${mediaTextTyping ? "w-[140px] sm:w-full sm:max-w-[360px]" : "w-full max-w-[360px]"}`}>
                    <PublicationMediaPreview
                      previewUrl={previewUrl}
                      fileType={fileType}
                      textConfig={activeConfig}
                      textEdge={activeEdge}
                      secondaryTextConfig={secondaryConfig}
                      secondaryTextEdge={secondaryEdge}
                      durationMs={mediaMetadata.durationMs}
                      fit="cover"
                      aspect="9:16"
                      interactive
                      onTextChange={updateActiveStoryText}
                    />
                  </div>
                  <MediaTextEditor
                    sourceFile={selectedFile}
                    sourceUrl={previewUrl}
                    kind={fileType === "video" ? "video" : "image"}
                    width={mediaMetadata.width}
                    height={mediaMetadata.height}
                    durationMs={mediaMetadata.durationMs}
                    title=""
                    value={activeConfig}
                    showPreview={false}
                    showTimingControl={false}
                    allowPositionToggle={false}
                    editorAccessory={edgeSelector}
                    onTypingChange={setMediaTextTyping}
                    onChange={(_file, _nextPreviewUrl, config) => updateActiveStoryText(config)}
                  />
                </>;
              })()}
            </div>}

          </div> : <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-3">
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-5 text-center transition-colors hover:bg-indigo-50">
              <ImagePlus className="text-indigo-600" size={26}/>
              <span className="mt-2 text-base font-bold text-slate-900 sm:text-sm">Adicionar mídia</span>
              <span className="mt-1 text-sm text-slate-500 sm:text-xs">Imagem, vídeo, GIF ou áudio · o Tela adapta quando necessário</span>
              <input type="file" accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,.gif,.mp4,.mov,.webm,.avi,.mkv,.mpeg,.mpg,.m4v,.3gp,.ogv,.mp3,.wav,.m4a,.aac,.ogg,.flac,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp,image/gif,video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,video/mpeg,video/x-m4v,video/3gpp,video/ogg,audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,audio/flac" className="sr-only" onChange={event => handleFile(event.target.files?.[0])}/>
            </label>
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-5 text-center transition-colors hover:bg-blue-50">
              <ImagePlus className="text-blue-600" size={26}/>
              <span className="mt-2 text-base font-bold text-slate-900 sm:text-sm">Criar carrossel</span>
              <span className="mt-1 text-sm text-slate-500 sm:text-xs">Selecione de 2 a 10 imagens de uma vez</span>
              <input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp" className="sr-only" onChange={event => void handleCarouselFiles(event.target.files)}/>
            </label>
            <button type="button" className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-5 text-center hover:bg-slate-100">
              <Library className="text-slate-600" size={26}/>
              <span className="mt-2 text-base font-bold text-slate-900 sm:text-sm">Escolher da biblioteca</span>
              <span className="mt-1 text-sm text-slate-500 sm:text-xs">Mídias que você decidiu guardar</span>
            </button>
          </div>}
          <ContextualChecks checks={mediaChecks} onSelect={check => setActiveId(check.option.id)}/>
        </section>

        <section className="card min-w-0 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-950 sm:text-sm">3. Descrição</h2>
              <p className="mt-1 text-sm text-slate-500 sm:text-xs">{requiresDescription ? "Use uma descrição base e personalize somente quando quiser." : "Para publicação somente em Stories, a descrição é opcional."}</p>
            </div>
            <div className="flex max-w-full rounded-lg bg-slate-100 p-1 text-sm font-bold sm:text-xs">
              <button onClick={() => setCustomize(false)} className={`rounded-md px-3 py-2 ${!customize ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Descrição base</button>
              <button onClick={() => setCustomize(true)} className={`rounded-md px-3 py-2 ${customize ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Por destino</button>
            </div>
          </div>

          {!customize ? <div className="mt-4">
            <textarea value={base} onChange={event => { setBase(event.target.value); setSaveMessage(""); setIsDirty(true); }} onInput={event => { event.currentTarget.style.height = "0px"; event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`; }} placeholder={requiresDescription ? "Escreva a descrição principal aqui..." : "Descrição opcional para organizar esta publicação..."} className="field min-h-36 touch-pan-y resize-none overflow-hidden p-4 text-base sm:text-sm"/>
            <div className="mt-2"><InlineEmojiPicker value={base} onChange={value => { setBase(value); setSaveMessage(""); setIsDirty(true); }}/></div>
            <div className="mt-3">
              <span className="text-sm text-slate-500 sm:text-xs">{base.length} caracteres</span>
              <div className="mt-3 flex flex-col items-center gap-2">
                <button onClick={adaptAll} disabled={!base.trim() || !selectedOptions.some(option => !(option.platform === "instagram" && instagramPlacement === "story"))} className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"><Sparkles size={16}/> Adaptar para todas as redes</button>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 sm:text-xs">
                  <input type="checkbox" checked={includeEmojis} onChange={event => { setIncludeEmojis(event.target.checked); setIsDirty(true); }}/>
                  Usar emojis
                </label>
              </div>
            </div>
          </div> : <div className="mt-4 min-w-0">
            {selectedOptions.length ? <>
              <div className="app-scrollbar flex max-w-full gap-1 overflow-x-auto border-b border-slate-200">
                {selectedOptions.map(option => <button key={option.id} onClick={() => setActiveId(option.id)} className={`flex max-w-44 shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-bold sm:text-xs ${activeId === option.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}><PlatformIcon platform={option.platform} small/><span className="truncate">{option.label}</span></button>)}
              </div>
              {activeOption && <div className="mt-4">
                {activeOption.platform === "youtube" && activeOption.contentIntent === "LONG_FORM" && <label className="mb-3 block text-sm font-bold text-slate-700 sm:text-xs">Título do YouTube<input value={titles[activeOption.id] ?? ""} onChange={event => { setTitles(current => ({ ...current, [activeOption.id]: event.target.value })); setIsDirty(true); }} className="field mt-1 px-3 text-base sm:text-sm" placeholder="Título do vídeo"/></label>}
                {activeOption.platform === "instagram" && instagramPlacement === "story" ? <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">Este Instagram está configurado para publicar somente em Stories. A descrição não é enviada para o Story.</div> : <>
                  <textarea value={effectiveText(activeOption)} onChange={event => { setTexts(current => ({ ...current, [activeOption.id]: event.target.value })); setIsDirty(true); }} onInput={event => { event.currentTarget.style.height = "0px"; event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`; }} className="field min-h-36 touch-pan-y resize-none overflow-hidden p-4 text-base sm:text-sm"/>
                  <div className="mt-2"><InlineEmojiPicker value={effectiveText(activeOption)} onChange={value => { setTexts(current => ({ ...current, [activeOption.id]: value })); setIsDirty(true); }}/></div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-500 sm:text-xs">Personalização de {activeOption.label}.</p>
                    <button onClick={() => { setTexts(current => ({ ...current, [activeOption.id]: base })); setIsDirty(true); }} className="text-sm font-bold text-indigo-600 sm:text-xs">Usar descrição base</button>
                  </div>
                </>}
              </div>}
            </> : <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Selecione ao menos uma conta para personalizar.</p>}
          </div>}
          <ContextualChecks checks={descriptionChecks} onSelect={check => { setCustomize(true); setActiveId(check.option.id); }}/>
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="text-base font-bold text-slate-950 sm:text-sm">4. Quando publicar?</h2>
          <p className="mt-1 text-xs text-slate-500">Horários salvos no fuso da marca: <strong>{tenant.activeBrand.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"}</strong>.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button onClick={() => { setMode("now"); setIsDirty(true); }} className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${mode === "now" ? "border-blue-400 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700"}`}><Send size={16}/> Imediatamente</button>
            <button onClick={() => { setMode("schedule"); setIsDirty(true); }} className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${mode === "schedule" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-700"}`}><CalendarClock size={16}/> Agendar</button>
          </div>

          {mode === "schedule" && <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-700 sm:text-xs">Data<input type="date" value={date} onChange={event => { setDate(event.target.value); setIsDirty(true); }} className="field mt-1 px-3 text-base sm:text-sm"/></label>
              <label className="text-sm font-bold text-slate-700 sm:text-xs">Horário<input type="time" value={time} onChange={event => { setTime(event.target.value); setIsDirty(true); }} className="field mt-1 px-3 text-base sm:text-sm"/></label>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700 sm:text-xs">
              <input type="checkbox" checked={differentTimes} onChange={event => { setDifferentTimes(event.target.checked); setIsDirty(true); }}/>
              Usar horários diferentes por destino
            </label>
            {differentTimes && <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {selectedOptions.map(option => <label key={option.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-700 sm:text-xs"><PlatformIcon platform={option.platform} small/><span className="min-w-0 flex-1 truncate">{option.label}</span><input type="time" value={destinationTimes[option.id] ?? time} onChange={event => { setDestinationTimes(current => ({ ...current, [option.id]: event.target.value })); setIsDirty(true); }} className="w-28 shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-base sm:text-xs"/></label>)}
            </div>}
          </div>}
          <ContextualChecks checks={scheduleChecks} onSelect={check => setActiveId(check.option.id)}/>
        </section>


      </div>

      <aside className="min-w-0 space-y-4 xl:sticky xl:top-20 xl:self-start">
        <section className="card min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div>
              <p className="font-bold text-slate-950">Prévia da publicação</p>
              <p className="mt-1 text-sm leading-5 text-slate-500 sm:text-xs">Simulação aproximada por rede.<span className="block">A interface oficial pode mudar.</span></p>
            </div>
            <button type="button" onClick={() => setPreviewOpen(true)} className="btn-secondary shrink-0 whitespace-nowrap !px-3"><Eye size={15}/> Ver</button>
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
                    <p className={`text-[11px] ${activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "text-white/70" : "text-slate-400"}`}>{platformLabels[activeOption.platform]}{activeOption.platform === "instagram" && instagramPlacement === "story" ? " · Story" : ""}</p>
                  </div>
                  <MoreHorizontal size={17} className={activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "text-white/70" : "text-slate-400"}/>
                </div>
                <div className="relative bg-gradient-to-br from-indigo-50 via-slate-100 to-violet-100" style={{ aspectRatio: activeOption.platform === "youtube" && activeOption.contentIntent === "LONG_FORM" ? 16 / 9 : activeOption.platform === "instagram" && instagramPlacement === "story" ? 9 / 16 : mediaAspectRatio(outputAspect) }}>
                  {previewUrl && <PublicationMediaPreview previewUrl={previewUrl} fileType={fileType} textConfig={activeOption.platform === "instagram" && instagramPlacement === "story"
                    ? (storyTextConfig.timingMode === "range" ? storyEndPreviewConfig : storyTextConfig)
                    : feedTextConfig}
                  textEdge={activeOption.platform === "instagram" && instagramPlacement === "story" && storyTextConfig.timingMode === "range" ? "end" : "both"}
                  secondaryTextConfig={activeOption.platform === "instagram" && instagramPlacement === "story" && storyTextConfig.timingMode === "range" ? storyStartPreviewConfig : undefined}
                  secondaryTextEdge="start" durationMs={mediaMetadata.durationMs} posterUrl={coverSelection.previewUrl} carouselItems={carouselPreviewItems} fit={isCarousel ? "cover" : "contain"} aspect={outputAspect}/>}
                  {!previewUrl && <div className="grid h-full place-items-center text-slate-400"><Play size={30}/></div>}
                  {(activeOption.platform === "tiktok" || activeOption.platform === "kwai") && <PreviewChrome platform={activeOption.platform}/>} 
                </div>
                {!(activeOption.platform === "instagram" && instagramPlacement === "story") && <div className="p-3">
                  {activeOption.platform === "youtube" && activeOption.contentIntent === "LONG_FORM" && titles[activeOption.id] && <p className="mb-1 text-base font-black text-slate-950">{titles[activeOption.id]}</p>}
                  <p className={`whitespace-pre-line text-sm leading-5 ${activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "text-white" : "text-slate-700"}`}>{effectiveText(activeOption) || "Sua descrição aparecerá aqui."}</p>
                </div>}
                {activeOption.platform !== "tiktok" && activeOption.platform !== "kwai" && !(activeOption.platform === "instagram" && instagramPlacement === "story") && <PreviewChrome platform={activeOption.platform}/>} 
              </div>
            </div>}
          </> : <div className="p-6 text-center text-sm text-slate-500">Selecione ao menos um destino para ver a prévia.</div>}
        </section>

        <section className="card p-4">
          <div className="flex items-center justify-between text-sm sm:text-xs">
            <span className="text-slate-500">Destinos</span><strong className="text-slate-900">{selectedOptions.length}</strong>
          </div>
          {hasInstagram && <div className="mt-2 flex items-center justify-between gap-3 text-sm sm:text-xs">
            <span className="text-slate-500">Instagram</span><strong className="text-right text-slate-900">{instagramPlacement === "feed" ? "Feed" : instagramPlacement === "story" ? "Stories" : "Feed + Stories"}</strong>
          </div>}
          <div className="mt-2 flex items-center justify-between text-sm sm:text-xs">
            <span className="text-slate-500">Envio</span><strong className="text-slate-900">{mode === "now" ? "Agora" : "Agendado"}</strong>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm sm:text-xs">
            <span className="text-slate-500">Biblioteca</span><strong className="text-right text-slate-900">{retention === "library" ? "Manter" : "Não manter"}</strong>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <button disabled={saving || !canSaveDraft} onClick={() => void persist("draft")} className="btn-secondary w-full disabled:opacity-50">Salvar rascunho</button>
            <button disabled={saving || !canSubmit} onClick={() => void persist(mode === "now" ? "publish_now" : "schedule")} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40">{mode === "now" ? <Send size={16}/> : <Clock3 size={16}/>} {saving ? (mode === "now" ? "Publicando..." : "Salvando...") : mode === "now" ? "Publicar agora" : "Publicar agendamento"}</button>
          </div>
          {saveMessage && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold leading-5 text-emerald-700 sm:text-xs">{saveMessage}</p>}
          {!!publishResults.length && <div className="mt-3 space-y-2">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Resultado por destino</p>
            {publishResults.map((result, index) => {
              const presentation = resultPresentation(result.outcome);
              return <div key={result.postTargetId ?? `${result.provider}-${result.surface ?? "main"}-${index}`} className={`rounded-lg border px-3 py-2.5 ${presentation.className}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black">{resultLabel(result)}</span>
                  <span className="text-[10px] font-black uppercase tracking-wide">{presentation.text}</span>
                </div>
                {result.errorMessage && result.outcome !== "SUCCEEDED" && <p className="mt-1 text-[11px] leading-4 opacity-80">{result.errorMessage}</p>}
                {result.publicUrl && result.outcome === "SUCCEEDED" && <a href={result.publicUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-black underline"><ExternalLink size={11}/> Ver publicação</a>}
              </div>;
            })}
          </div>}
          {publishComplete && <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <button type="button" onClick={() => window.location.assign("/publicacoes/nova")} className="btn-primary w-full">Criar nova publicação</button>
            {publishedUrl && <a href={publishedUrl} target="_blank" rel="noreferrer" className="btn-secondary w-full"><ExternalLink size={15}/> Ver publicação</a>}
          </div>}
          {saveError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold leading-5 text-red-700 sm:text-xs">{saveError}</p>}
        </section>
      </aside>
    </div>

    {previewOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4" onClick={() => setPreviewOpen(false)}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-indigo-600">Visualização</p>
            <p className="text-sm font-black text-slate-950">{activeOption?.label ?? "Publicação"}</p>
          </div>
          <button type="button" onClick={() => setPreviewOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600"><X size={17}/></button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto bg-slate-50 p-4">
          {activeOption ? <div className={`relative overflow-hidden rounded-xl border border-slate-200 ${activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "bg-slate-950" : "bg-white"}`}>
            <div className="relative bg-slate-100" style={{ aspectRatio: activeOption.platform === "tiktok" || activeOption.platform === "kwai" || (activeOption.platform === "instagram" && instagramPlacement === "story") ? 9 / 16 : activeOption.platform === "youtube" && activeOption.contentIntent === "LONG_FORM" ? 16 / 9 : mediaAspectRatio(outputAspect) }}>
              {previewUrl && <PublicationMediaPreview previewUrl={previewUrl} fileType={fileType} textConfig={activeOption.platform === "instagram" && instagramPlacement === "story"
                    ? (storyTextConfig.timingMode === "range" ? storyEndPreviewConfig : storyTextConfig)
                    : feedTextConfig}
                  textEdge={activeOption.platform === "instagram" && instagramPlacement === "story" && storyTextConfig.timingMode === "range" ? "end" : "both"}
                  secondaryTextConfig={activeOption.platform === "instagram" && instagramPlacement === "story" && storyTextConfig.timingMode === "range" ? storyStartPreviewConfig : undefined}
                  secondaryTextEdge="start" durationMs={mediaMetadata.durationMs} posterUrl={coverSelection.previewUrl} carouselItems={carouselPreviewItems} fit={isCarousel ? "cover" : "contain"} aspect={outputAspect}/>}
              {!previewUrl && <div className="grid h-full place-items-center text-slate-400"><Play size={34}/></div>}
              {(activeOption.platform === "tiktok" || activeOption.platform === "kwai") && <PreviewChrome platform={activeOption.platform}/>} 
            </div>
            {!(activeOption.platform === "instagram" && instagramPlacement === "story") && <div className="p-4">
              {activeOption.platform === "youtube" && activeOption.contentIntent === "LONG_FORM" && titles[activeOption.id] && <p className="mb-2 text-base font-black text-slate-950">{titles[activeOption.id]}</p>}
              <p className={`whitespace-pre-line text-sm leading-6 ${activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "text-white" : "text-slate-700"}`}>{effectiveText(activeOption) || "Sua descrição aparecerá aqui."}</p>
            </div>}
            {activeOption.platform !== "tiktok" && activeOption.platform !== "kwai" && !(activeOption.platform === "instagram" && instagramPlacement === "story") && <PreviewChrome platform={activeOption.platform}/>} 
          </div> : <p className="text-sm text-slate-500">Selecione um destino para visualizar.</p>}
          {hasInstagram && instagramPlacement !== "feed" && <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-800">{instagramPlacement === "story" ? "O Instagram será publicado somente nos Stories." : "Também será criado um Story independente para cada Instagram selecionado."}</div>}
        </div>
      </div>
    </div>}
  </div>;
}