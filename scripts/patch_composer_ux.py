from pathlib import Path

path = Path("src/components/publication-editor.tsx")
text = path.read_text(encoding="utf-8")

def r(old: str, new: str):
    global text
    if old not in text:
        raise SystemExit("Trecho nao encontrado:\n" + old[:500])
    text = text.replace(old, new, 1)

# Icons + cover editor
r(
'''  Clock3,
  Heart,
  ImagePlus,''',
'''  Clock3,
  ExternalLink,
  Eye,
  Heart,
  ImagePlus,'''
)
r(
'''  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";''',
'''  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";'''
)
r(
'''import { prepareMediaFile, type PreparedMediaMetadata } from "@/lib/media/compatibility";
''',
'''import { prepareMediaFile, type PreparedMediaMetadata } from "@/lib/media/compatibility";
import { VideoCoverEditor, type CoverSelection } from "./video-cover-editor";
'''
)

# Dynamic default schedule
r(
'''function toIso(date: string, time: string) {
  const parsed = new Date(date + "T" + time + ":00");
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}
''',
'''function toIso(date: string, time: string) {
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
'''
)
r(
'''export function PublicationEditor() {
  const tenant = useTenantData();
  const initialized = useRef(false);
''',
'''export function PublicationEditor() {
  const tenant = useTenantData();
  const initialized = useRef(false);
  const defaultSchedule = useRef(defaultScheduleParts()).current;
'''
)

# State
r(
'''  const [mediaMetadata, setMediaMetadata] = useState<PreparedMediaMetadata>({ durationMs: null, width: null, height: null });
  const [stagedMedia, setStagedMedia] = useState<{ key: string; mediaId: string } | null>(null);
  const [existingMedia, setExistingMedia] = useState<{ id: string; name: string; type: "image" | "video"; size: number } | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [date, setDate] = useState("2026-09-25");
  const [time, setTime] = useState("18:30");''',
'''  const [mediaMetadata, setMediaMetadata] = useState<PreparedMediaMetadata>({ durationMs: null, width: null, height: null });
  const [stagedMedia, setStagedMedia] = useState<{ key: string; mediaId: string } | null>(null);
  const [stagedCover, setStagedCover] = useState<{ key: string; mediaId: string } | null>(null);
  const [coverSelection, setCoverSelection] = useState<CoverSelection>({ mode: "auto", file: null, previewUrl: null, aspect: "9:16" });
  const [publishToStory, setPublishToStory] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishComplete, setPublishComplete] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [existingMedia, setExistingMedia] = useState<{ id: string; name: string; type: "image" | "video"; size: number } | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [date, setDate] = useState(defaultSchedule.date);
  const [time, setTime] = useState(defaultSchedule.time);'''
)

# Editing: skip story target and restore toggle
r(
'''      const nextTimes: Record<string, string> = {};
      const clockValues: string[] = [];

      for (const target of targets) {
        const optionId = target.provider === "youtube" && target.content_intent_override === "SHORT_FORM"''',
'''      const nextTimes: Record<string, string> = {};
      const clockValues: string[] = [];
      let nextPublishToStory = false;

      for (const target of targets) {
        const targetConfig = target.provider_config && typeof target.provider_config === "object" && !Array.isArray(target.provider_config)
          ? target.provider_config as Record<string, unknown>
          : {};
        if (target.provider === "instagram" && targetConfig.surface === "story") {
          nextPublishToStory = true;
          continue;
        }

        const optionId = target.provider === "youtube" && target.content_intent_override === "SHORT_FORM"'''
)
r(
'''      setTexts(nextTexts);
      setTitles(nextTitles);

      const firstScheduled = targets.find(target => target.scheduled_at)?.scheduled_at;''',
'''      setTexts(nextTexts);
      setTitles(nextTitles);
      setPublishToStory(nextPublishToStory);

      const firstScheduled = targets.find(target => {
        if (!target.scheduled_at) return false;
        const config = target.provider_config && typeof target.provider_config === "object" && !Array.isArray(target.provider_config)
          ? target.provider_config as Record<string, unknown>
          : {};
        return config.surface !== "story";
      })?.scheduled_at;'''
)

# Cleanup effect
r(
'''  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const shortOptions =''',
'''  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => () => {
    if (coverSelection.previewUrl) URL.revokeObjectURL(coverSelection.previewUrl);
  }, [coverSelection.previewUrl]);

  const shortOptions ='''
)
r(
'''  const selectedOptions = destinationOptions.filter(option => selectedIds.includes(option.id));
  const activeOption = selectedOptions.find(option => option.id === activeId) ?? selectedOptions[0] ?? destinationOptions[0];''',
'''  const selectedOptions = destinationOptions.filter(option => selectedIds.includes(option.id));
  const activeOption = selectedOptions.find(option => option.id === activeId) ?? selectedOptions[0] ?? destinationOptions[0];
  const hasInstagram = selectedOptions.some(option => option.platform === "instagram");'''
)

# Reset success/cover on primary media change
r(
'''    setSaveError("");
    setSaveMessage("Preparando mídia...");
    setMediaNotice("");''',
'''    setSaveError("");
    setSaveMessage("Preparando mídia...");
    setMediaNotice("");
    setPublishComplete(false);
    setPublishedUrl(null);
    setStagedCover(null);
    if (coverSelection.previewUrl) URL.revokeObjectURL(coverSelection.previewUrl);
    setCoverSelection({ mode: "auto", file: null, previewUrl: null, aspect: "9:16" });'''
)
r(
'''    setMediaMetadata({ durationMs: null, width: null, height: null });
    setStagedMedia(null);

    if (existingMedia) {''',
'''    setMediaMetadata({ durationMs: null, width: null, height: null });
    setStagedMedia(null);
    setStagedCover(null);
    setPublishComplete(false);
    setPublishedUrl(null);
    if (coverSelection.previewUrl) URL.revokeObjectURL(coverSelection.previewUrl);
    setCoverSelection({ mode: "auto", file: null, previewUrl: null, aspect: "9:16" });

    if (existingMedia) {'''
)

# Schedule verification
r(
'''    if (tenant.source === "supabase" && option.status !== "connected") return { option, level: "error" as const, text: "Conta precisa ser reconectada" };

    if (option.platform === "instagram") {''',
'''    if (tenant.source === "supabase" && option.status !== "connected") return { option, level: "error" as const, text: "Conta precisa ser reconectada" };

    if (mode === "schedule") {
      const targetTime = differentTimes ? (destinationTimes[option.id] || time) : time;
      const scheduled = new Date(`${date}T${targetTime}:00`);
      if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now() + 60_000) {
        return { option, level: "error" as const, text: "Escolha um horário pelo menos 1 minuto no futuro" };
      }
    }

    if (option.platform === "instagram") {'''
)

# Persist start resets completion
r(
'''    setSaving(true);
    setSaveError("");
    setSaveMessage("");

    if (tenant.source !== "supabase") {''',
'''    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    setPublishComplete(false);
    setPublishedUrl(null);

    if (tenant.source !== "supabase") {'''
)

# Story target, primary attach, then cover upload
r(
'''    const postId = typeof result.data === "string" ? result.data : editingPostId;

    if (mediaId && postId) {''',
'''    const postId = typeof result.data === "string" ? result.data : editingPostId;

    if (publishToStory && hasInstagram && postId) {
      const storyResult = await client.rpc("add_instagram_story_targets", { p_post_id: postId });
      if (storyResult.error) {
        setSaveError("A publicação foi salva, mas não conseguimos preparar o Story. Tente novamente antes de publicar.");
        setSaving(false);
        return;
      }
    }

    if (mediaId && postId) {'''
)
r(
'''    if (intent === "publish_now" && postId) {
      setSaveMessage("Mídia pronta. Enviando para as redes habilitadas...");''',
'''    if (coverSelection.file && fileType === "video" && hasInstagram && postId) {
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
      setSaveMessage("Mídia pronta. Enviando para as redes habilitadas...");'''
)

# Publish result type + success actions
r(
'''        results?: Array<{ provider: string; outcome: string; errorMessage?: string | null }>;
      };''',
'''        results?: Array<{ provider: string; outcome: string; errorMessage?: string | null; publicUrl?: string | null }>;
      };'''
)
r(
'''      } else if (succeeded > 0) {
        setSaveMessage(succeeded === 1 ? "Publicado." : `${succeeded} destinos publicados.`);
      } else if ((publishResult?.claimed ?? 0) === 0) {''',
'''      } else if (succeeded > 0) {
        const directUrl = publishResult?.results?.find(item => item.outcome === "SUCCEEDED" && item.publicUrl)?.publicUrl ?? null;
        setPublishedUrl(directUrl);
        setPublishComplete(true);
        setSaveMessage(succeeded === 1 ? "Publicado." : `${succeeded} destinos publicados.`);
      } else if ((publishResult?.claimed ?? 0) === 0) {'''
)

# Primary media preview controls
text = text.replace(
    '<video src={previewUrl} className="h-full w-full object-cover" muted playsInline/>',
    '<video src={previewUrl} className="h-full w-full object-cover" controls playsInline preload="metadata"/>',
)

# Cover editor under media selector, before destination section
needle = '''          </div>}
        </section>

        <section className="card min-w-0 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">'''
replacement = '''          </div>}

          {fileType === "video" && previewUrl && hasInstagram && <div className="mt-4">
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
        </section>

        <section className="card min-w-0 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">'''
r(needle, replacement)

# Story toggle before Description section
needle = '''          </div>}
        </section>

        <section className="card min-w-0 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-950 sm:text-sm">3. Descrição</h2>'''
replacement = '''          </div>}

          {hasInstagram && <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50/60 p-4">
            <input type="checkbox" checked={publishToStory} onChange={event => setPublishToStory(event.target.checked)} className="mt-1"/>
            <span>
              <span className="block text-sm font-black text-slate-900">Publicar também nos Stories</span>
              <span className="mt-1 block text-xs leading-5 text-slate-600">O Tela cria um envio independente para o Story, no mesmo horário, com status e retentativa próprios.</span>
            </span>
          </label>}
        </section>

        <section className="card min-w-0 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-950 sm:text-sm">3. Descrição</h2>'''
r(needle, replacement)

# Schedule timezone hint after heading
r(
'''          <h2 className="text-base font-bold text-slate-950 sm:text-sm">4. Quando publicar?</h2>''',
'''          <h2 className="text-base font-bold text-slate-950 sm:text-sm">4. Quando publicar?</h2>
          <p className="mt-1 text-xs text-slate-500">Horários salvos no fuso da marca: <strong>{tenant.activeBrand.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"}</strong>.</p>'''
)

# Preview heading button
r(
'''          <div className="border-b border-slate-200 p-4">
            <p className="font-bold text-slate-950">Prévia da publicação</p>
            <p className="mt-1 text-sm leading-5 text-slate-500 sm:text-xs">Simulação aproximada por rede. A interface oficial pode mudar.</p>
          </div>''',
'''          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div>
              <p className="font-bold text-slate-950">Prévia da publicação</p>
              <p className="mt-1 text-sm leading-5 text-slate-500 sm:text-xs">Simulação aproximada por rede. A interface oficial pode mudar.</p>
            </div>
            <button type="button" onClick={() => setPreviewOpen(true)} className="btn-secondary !px-3"><Eye size={15}/> Visualizar</button>
          </div>'''
)

# Success actions after save message
r(
'''          {saveMessage && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold leading-5 text-emerald-700 sm:text-xs">{saveMessage}</p>}
          {saveError &&''',
'''          {saveMessage && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold leading-5 text-emerald-700 sm:text-xs">{saveMessage}</p>}
          {publishComplete && <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <button type="button" onClick={() => window.location.assign("/publicacoes/nova")} className="btn-primary w-full">Criar nova publicação</button>
            {publishedUrl && <a href={publishedUrl} target="_blank" rel="noreferrer" className="btn-secondary w-full"><ExternalLink size={15}/> Ver publicação</a>}
          </div>}
          {saveError &&'''
)

# Add preview modal before outer close
r(
'''      </aside>
    </div>
  </div>;
}''',
'''      </aside>
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
            <div className={activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "relative aspect-[9/16]" : "relative aspect-square bg-slate-100"}>
              {previewUrl && (fileType === "video"
                ? <video src={previewUrl} className="h-full w-full object-cover" controls playsInline preload="metadata"/>
                : <img src={previewUrl} alt="Prévia ampliada" className="h-full w-full object-cover"/>)}
              {!previewUrl && <div className="grid h-full place-items-center text-slate-400"><Play size={34}/></div>}
              {(activeOption.platform === "tiktok" || activeOption.platform === "kwai") && <PreviewChrome platform={activeOption.platform}/>} 
            </div>
            <div className="p-4">
              {activeOption.platform === "youtube" && activeOption.contentIntent === "LONG_FORM" && titles[activeOption.id] && <p className="mb-2 text-base font-black text-slate-950">{titles[activeOption.id]}</p>}
              <p className={`whitespace-pre-line text-sm leading-6 ${activeOption.platform === "tiktok" || activeOption.platform === "kwai" ? "text-white" : "text-slate-700"}`}>{effectiveText(activeOption) || "Sua descrição aparecerá aqui."}</p>
            </div>
            {activeOption.platform !== "tiktok" && activeOption.platform !== "kwai" && <PreviewChrome platform={activeOption.platform}/>} 
          </div> : <p className="text-sm text-slate-500">Selecione um destino para visualizar.</p>}
          {publishToStory && hasInstagram && <div className="mt-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50 p-3 text-xs font-semibold leading-5 text-fuchsia-800">Também será criado um Story independente no Instagram.</div>}
        </div>
      </div>
    </div>}
  </div>;
}'''
)

path.write_text(text, encoding="utf-8")
print("Composer UX patch applied")
