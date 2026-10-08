"use client";

import { Music2, Search, Volume2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

export type InstagramAudioType = "music" | "original_sound";

export type InstagramAudioSelection = {
  audioId: string;
  title: string;
  artist: string | null;
  audioType: InstagramAudioType;
  durationMs: number | null;
  coverUrl: string | null;
  previewUrl: string | null;
  audioVolume: number;
  videoVolume: number;
};

export type InstagramMusicAccount = {
  id: string;
  label: string;
  handle: string;
  advancedEnabled: boolean;
};

type AudioResult = {
  audio_id: string;
  title: string;
  audio_type: InstagramAudioType;
  duration_in_ms: number | null;
  display_artist: string | null;
  cover_artwork_thumbnail_url: string | null;
  download_url: string | null;
  ig_username: string | null;
  profile_picture_url: string | null;
  on_platform_audio_preview_link: string | null;
};

function formatDuration(durationMs: number | null) {
  if (!durationMs || durationMs < 0) return "";
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function InstagramMusicEditor({
  brandId,
  accounts,
  selections,
  onChange,
}: {
  brandId: string;
  accounts: InstagramMusicAccount[];
  selections: Record<string, InstagramAudioSelection | null>;
  onChange: (connectionId: string, value: InstagramAudioSelection | null) => void;
}) {
  const [activeAccountId, setActiveAccountId] = useState(accounts[0]?.id ?? "");
  const [audioType, setAudioType] = useState<InstagramAudioType>("music");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AudioResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [needsReauthorization, setNeedsReauthorization] = useState(false);

  useEffect(() => {
    if (accounts.some(account => account.id === activeAccountId)) return;
    setActiveAccountId(accounts[0]?.id ?? "");
  }, [accounts, activeAccountId]);

  const activeAccount = useMemo(
    () => accounts.find(account => account.id === activeAccountId) ?? accounts[0],
    [accounts, activeAccountId],
  );
  const selected = activeAccount ? selections[activeAccount.id] ?? null : null;

  async function loadAudio(search = query) {
    if (!activeAccount || !activeAccount.advancedEnabled) return;

    setLoading(true);
    setError("");
    setLoadedOnce(false);
    setNeedsReauthorization(false);

    try {
      const params = new URLSearchParams({
        brand_id: brandId,
        connection_id: activeAccount.id,
        audio_type: audioType,
      });
      if (search.trim()) params.set("q", search.trim());

      const response = await fetch(`/api/instagram/audio?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const body = await response.json().catch(() => null) as null | {
        audio?: AudioResult[];
        error?: string;
        message?: string;
        requires_meta_reauthorization?: boolean;
        requires_meta_authorization?: boolean;
      };

      if (!response.ok) {
        if (body?.requires_meta_reauthorization || body?.requires_meta_authorization) {
          setNeedsReauthorization(true);
          setError("Reautorize os recursos avançados do Instagram para liberar o catálogo de músicas.");
        } else {
          setError(body?.message ?? "Não foi possível carregar músicas do Instagram agora.");
        }
        setResults([]);
        return;
      }

      setResults(body?.audio ?? []);
      setLoadedOnce(true);
    } catch {
      setError("Não foi possível carregar músicas do Instagram agora.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setResults([]);
    setError("");
    setLoadedOnce(false);
    setNeedsReauthorization(false);
  }, [activeAccountId, audioType]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void loadAudio(query);
  }

  function selectAudio(item: AudioResult) {
    if (!activeAccount) return;
    onChange(activeAccount.id, {
      audioId: item.audio_id,
      title: item.title,
      artist: item.display_artist ?? item.ig_username ?? null,
      audioType: item.audio_type,
      durationMs: item.duration_in_ms,
      coverUrl: item.cover_artwork_thumbnail_url,
      previewUrl: item.download_url,
      audioVolume: 100,
      videoVolume: 100,
    });
  }

  if (!accounts.length) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      Selecione uma conta do Instagram para escolher música.
    </div>;
  }

  return <div className="space-y-3">
    {accounts.length > 1 && <div className="app-scrollbar flex gap-1 overflow-x-auto pb-1">
      {accounts.map(account => <button
        key={account.id}
        type="button"
        onClick={() => setActiveAccountId(account.id)}
        className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-black ${activeAccount?.id === account.id ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}
      >
        {account.handle || account.label}
      </button>)}
    </div>}

    {!activeAccount?.advancedEnabled ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-black text-amber-900">Recursos avançados necessários</p>
      <p className="mt-1 text-xs leading-5 text-amber-800">A biblioteca de músicas do Instagram exige a conexão via Facebook Login. Ative os recursos avançados desta conta em Contas sociais.</p>
      <a href="/conexoes" className="btn-secondary mt-3 !px-3 !py-2 text-xs">Ir para Contas sociais</a>
    </div> : <>
      <div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setAudioType("music")} className={`rounded-lg border px-3 py-2 text-xs font-black ${audioType === "music" ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>Músicas</button>
          <button type="button" onClick={() => setAudioType("original_sound")} className={`rounded-lg border px-3 py-2 text-xs font-black ${audioType === "original_sound" ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>Áudios originais</button>
        </div>
        <p className="mt-1.5 text-[11px] leading-4 text-slate-500">{audioType === "music"
          ? "Músicas: catálogo autorizado pela Meta para uso por integrações."
          : "Áudios originais: sons criados em Reels, como falas, memes e outros áudios reutilizáveis."}</p>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          className="field min-w-0 flex-1 px-3 text-base sm:text-sm"
          placeholder={audioType === "music" ? "Buscar música ou artista..." : "Buscar áudio original..."}
          maxLength={120}
        />
        <button type="submit" disabled={loading} className="btn-primary shrink-0 !px-3 disabled:opacity-50" aria-label="Buscar áudio">
          <Search size={16}/>
        </button>
      </form>

      <button type="button" disabled={loading} onClick={() => void loadAudio("")} className="text-xs font-black text-blue-700 disabled:opacity-50">
        {loading ? "Carregando..." : "Ver em alta"}
      </button>

      {needsReauthorization && <a href="/conexoes" className="block rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
        Reautorizar recursos avançados em Contas sociais
      </a>}
      {error && !needsReauthorization && <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold leading-5 text-red-700">{error}</p>}

      {selected && <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
        <div className="flex items-start gap-3">
          {selected.coverUrl ? <img src={selected.coverUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover"/> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700"><Music2 size={20}/></span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-900">{selected.title}</p>
            <p className="truncate text-xs text-slate-500">{selected.artist || (selected.audioType === "music" ? "Música do Instagram" : "Áudio original")}</p>
          </div>
          <button type="button" aria-label="Remover música" onClick={() => onChange(activeAccount.id, null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-slate-500"><X size={15}/></button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">
            <span className="mb-1 flex items-center justify-between"><span className="flex items-center gap-1"><Volume2 size={13}/> Música</span><span>{selected.audioVolume}%</span></span>
            <input type="range" min={0} max={100} value={selected.audioVolume} onChange={event => onChange(activeAccount.id, { ...selected, audioVolume: Number(event.target.value) })} className="w-full"/>
          </label>
          <label className="text-xs font-bold text-slate-700">
            <span className="mb-1 flex items-center justify-between"><span>Som original</span><span>{selected.videoVolume}%</span></span>
            <input type="range" min={0} max={100} value={selected.videoVolume} onChange={event => onChange(activeAccount.id, { ...selected, videoVolume: Number(event.target.value) })} className="w-full"/>
          </label>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-slate-500">O Instagram aplica a mixagem final ao publicar o Reel. A prévia exata da combinação de vídeo + música não é fornecida pela API.</p>
      </div>}

      {!!results.length && <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {results.map(item => {
          const artist = item.display_artist ?? item.ig_username ?? (item.audio_type === "music" ? "Música do Instagram" : "Áudio original");
          const active = selected?.audioId === item.audio_id;
          return <div key={item.audio_id} className={`rounded-xl border p-2.5 ${active ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}>
            <div className="flex items-center gap-3">
              {item.cover_artwork_thumbnail_url ? <img src={item.cover_artwork_thumbnail_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover"/> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><Music2 size={18}/></span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-900">{item.title}</p>
                <p className="truncate text-xs text-slate-500">{artist}{formatDuration(item.duration_in_ms) ? ` · ${formatDuration(item.duration_in_ms)}` : ""}</p>
              </div>
              <button type="button" onClick={() => selectAudio(item)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                {active ? "Selecionada" : "Usar"}
              </button>
            </div>
            {item.download_url && <audio className="mt-2 h-8 w-full" controls preload="none" src={item.download_url}/>}
          </div>;
        })}
      </div>}

      {!loading && !error && !results.length && <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
        <Music2 className="mx-auto text-slate-400" size={22}/>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{loadedOnce
          ? "Nenhum áudio autorizado pela Meta foi encontrado para esta busca. Tente outro termo ou veja os áudios em alta."
          : "Busque uma faixa ou toque em “Ver em alta”. O catálogo pode ser diferente do aplicativo do Instagram."}</p>
      </div>}
    </>}
  </div>;
}
