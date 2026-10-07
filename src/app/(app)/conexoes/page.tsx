"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  Link2,
  MoreHorizontal,
  Music2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import { platformLabels, socialPlatforms, type ConnectionStatus, type SocialPlatform } from "@/domain/social";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { useTenantData, type TenantConnection } from "@/components/tenant-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const statusLabel: Record<ConnectionStatus, string> = {
  connected: "Conectado",
  disconnected: "Não conectado",
  expired: "Reconectar",
  error: "Com erro",
};

type MetaAsset = {
  id: string;
  page_id: string;
  page_name: string;
  page_tasks: string[];
  instagram_business_account_id: string | null;
  instagram_username: string | null;
  instagram_name: string | null;
  status: string;
  discovered_at: string;
};

function normalizeUsername(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^@+/, "").toLowerCase();
}

function metadataString(connection: TenantConnection, key: string) {
  const value = connection.metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export default function ConnectionsPage() {
  const tenant = useTenantData();
  const [notice, setNotice] = useState("");
  const [connections, setConnections] = useState<TenantConnection[]>(tenant.connections);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [metaAssetsOpen, setMetaAssetsOpen] = useState(false);
  const [metaAssets, setMetaAssets] = useState<MetaAsset[]>([]);
  const [metaAssetsLoading, setMetaAssetsLoading] = useState(false);
  const [metaBusy, setMetaBusy] = useState<string | null>(null);
  const [pendingMetaAssetsAfterOAuth, setPendingMetaAssetsAfterOAuth] = useState(false);

  useEffect(() => {
    setConnections(tenant.connections);
  }, [tenant.connections]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (!oauth) return;

    const count = Number(params.get("count") ?? "0");
    const messages: Record<string, string> = {
      meta_assets_ready: count > 1
        ? `Facebook autorizado. Encontramos ${count} Páginas disponíveis. Escolha quais deseja usar para publicar.`
        : "Facebook autorizado. Escolha a Página que deseja usar para publicar.",
      instagram_advanced_enabled: "Recursos avançados ativados para este Instagram.",
      instagram_advanced_not_linked: "Não encontramos este Instagram no Facebook usado. Entre com o Facebook que administra este Instagram. Se você usou a conta certa, confira também se o Instagram está vinculado à Página no Facebook.",
      instagram_advanced_link_required: "Ainda não encontramos este Instagram entre as Páginas autorizadas nesse Facebook. Use o Facebook que administra este Instagram ou confira o vínculo com a Página.",
      instagram_advanced_invalid_connection: "Não foi possível identificar o Instagram escolhido. Tente novamente.",
      meta_no_eligible_accounts: "O login no Facebook funcionou, mas não encontramos Páginas disponíveis nessa conta.",
      meta_not_configured: "A integração com Facebook (Meta) ainda não está completamente configurada neste ambiente.",
      meta_token_failed: "O Facebook não concluiu a autorização. Tente novamente.",
      meta_long_token_failed: "O Facebook autorizou o login, mas não foi possível concluir a conexão segura.",
      meta_account_discovery_failed: "O Facebook autorizou o login, mas não foi possível carregar as Páginas disponíveis.",
      meta_state_invalid: "A autorização expirou ou não pôde ser validada. Inicie a conexão novamente.",
      meta_callback_failed: "Não foi possível concluir a conexão com Facebook (Meta).",
      session_expired: "Sua sessão expirou durante a autorização. Entre novamente.",
      brand_not_accessible: "A marca selecionada não está acessível para esta sessão.",
      server_not_configured: "A integração segura do servidor ainda não está completamente configurada.",
    };

    setNotice(messages[oauth] ?? "A conexão não pôde ser concluída.");
    if (oauth === "meta_assets_ready") setPendingMetaAssetsAfterOAuth(true);
    if (oauth === "instagram_advanced_enabled" || oauth === "instagram_advanced_link_required") {
      void tenant.refresh();
    }

    const clean = new URL(window.location.href);
    clean.searchParams.delete("oauth");
    clean.searchParams.delete("count");
    window.history.replaceState({}, "", clean.pathname + clean.search);
  }, []);

  useEffect(() => {
    if (!pendingMetaAssetsAfterOAuth || tenant.source !== "supabase" || tenant.activeBrand.id === "unconfigured") return;
    setPendingMetaAssetsAfterOAuth(false);
    void loadMetaAssets(true);
  }, [pendingMetaAssetsAfterOAuth, tenant.source, tenant.activeBrand.id]);

  function mockAction(platform: SocialPlatform, message?: string) {
    setNotice(message ?? (platformLabels[platform] + " ainda está aguardando a integração OAuth real."));
    setConnectOpen(false);
  }

  function startDirectInstagram() {
    const params = new URLSearchParams({
      brand_id: tenant.activeBrand.id,
      return_to: "/conexoes",
    });
    window.location.assign("/api/oauth/instagram/start?" + params.toString());
  }

  function startMetaOAuth(purpose: "facebook" | "instagram_advanced", connectionId?: string) {
    const params = new URLSearchParams({
      purpose,
      brand_id: tenant.activeBrand.id,
      return_to: "/conexoes",
    });
    if (connectionId) params.set("connection_id", connectionId);
    window.location.assign("/api/oauth/meta/start?" + params.toString());
  }

  async function loadMetaAssets(open = false) {
    if (tenant.source !== "supabase" || tenant.activeBrand.id === "unconfigured") return [] as MetaAsset[];
    setMetaAssetsLoading(true);
    try {
      const response = await fetch(`/api/oauth/meta/assets?brand_id=${encodeURIComponent(tenant.activeBrand.id)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = await response.json() as { assets?: MetaAsset[]; error?: string };
      if (!response.ok) {
        setNotice("Não foi possível carregar as Páginas do Facebook já autorizadas.");
        return [];
      }
      const assets = body.assets ?? [];
      setMetaAssets(assets);
      if (open) setMetaAssetsOpen(true);
      return assets;
    } finally {
      setMetaAssetsLoading(false);
    }
  }

  async function connectFacebook() {
    if (tenant.source !== "supabase" || tenant.activeBrand.id === "unconfigured") {
      setNotice("Conclua a configuração da marca antes de conectar o Facebook.");
      return;
    }
    setConnectOpen(false);
    const assets = await loadMetaAssets(false);
    if (assets.length) {
      setMetaAssetsOpen(true);
      return;
    }
    startMetaOAuth("facebook");
  }

  async function connectFacebookAsset(assetId: string) {
    setMetaBusy(assetId);
    try {
      const response = await fetch("/api/oauth/meta/assets", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: tenant.activeBrand.id,
          asset_id: assetId,
          action: "facebook",
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) {
        setNotice(body.error === "facebook_connect_failed"
          ? "Não foi possível conectar esta Página do Facebook para publicação."
          : "A Página selecionada não pôde ser conectada.");
        return;
      }
      await tenant.refresh();
      setNotice("Página do Facebook conectada para publicação.");
    } finally {
      setMetaBusy(null);
    }
  }

  async function verifyInstagramLink(connection: TenantConnection) {
    setMetaBusy(connection.id);
    try {
      const response = await fetch("/api/oauth/meta/assets", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: tenant.activeBrand.id,
          action: "verify_instagram_link",
          connection_id: connection.id,
        }),
      });
      const body = await response.json() as { linked?: boolean; error?: string };
      if (!response.ok) {
        setNotice("Não foi possível verificar o vínculo agora. Tente novamente.");
        return;
      }

      await tenant.refresh();
      if (body.linked) {
        setNotice("Vínculo confirmado. Recursos avançados ativados para este Instagram.");
      } else {
        const handle = connection.handle ?? connection.username ?? "este Instagram";
        setNotice(`Ainda não encontramos ${handle} entre as Páginas autorizadas nesse Facebook. Use o Facebook que administra esse Instagram ou confira o vínculo com a Página.`);
      }
    } finally {
      setMetaBusy(null);
    }
  }

  async function activateInstagramAdvanced(connection: TenantConnection) {
    if (tenant.source !== "supabase" || tenant.activeBrand.id === "unconfigured") return;
    if (connection.metadata?.meta_advanced_enabled === true) {
      setNotice("Os recursos avançados já estão ativos para este Instagram.");
      return;
    }

    if (connection.metadata?.meta_authorized === true) {
      await verifyInstagramLink(connection);
      return;
    }

    setMetaBusy(connection.id);
    try {
      const assets = await loadMetaAssets(false);
      const targetUsername = normalizeUsername(connection.username ?? connection.handle);
      const matching = assets.find(asset => {
        const idMatches = Boolean(connection.providerAccountId)
          && asset.instagram_business_account_id === connection.providerAccountId;
        const usernameMatches = Boolean(targetUsername)
          && normalizeUsername(asset.instagram_username) === targetUsername;
        return idMatches || usernameMatches;
      });

      if (matching) {
        const response = await fetch("/api/oauth/meta/assets", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand_id: tenant.activeBrand.id,
            asset_id: matching.id,
            action: "instagram_advanced",
            connection_id: connection.id,
          }),
        });
        if (response.ok) {
          await tenant.refresh();
          setNotice("Recursos avançados ativados usando a autorização do Facebook que já existia.");
          return;
        }
      }
    } finally {
      setMetaBusy(null);
    }

    startMetaOAuth("instagram_advanced", connection.id);
  }

  function connectPlatform(platform: SocialPlatform) {
    if (tenant.source === "supabase" && platform === "instagram") {
      if (tenant.activeBrand.id === "unconfigured") {
        setNotice("Conclua a configuração da marca antes de conectar uma rede.");
        return;
      }
      setConnectOpen(false);
      startDirectInstagram();
      return;
    }

    if (tenant.source === "supabase" && platform === "facebook") {
      void connectFacebook();
      return;
    }

    mockAction(
      platform,
      tenant.source === "supabase"
        ? platformLabels[platform] + " será conectado na próxima etapa do rollout OAuth. Instagram e Facebook já têm integração real."
        : undefined,
    );
  }

  function demoOnlyUpdate(id: string, status: ConnectionStatus) {
    if (tenant.source !== "demo") {
      setNotice("Esta conta usa autorização oficial e deve ser gerenciada pelo fluxo seguro de conexão.");
      setOpenMenu(null);
      return;
    }
    setConnections(current => current.map(item => item.id === id
      ? { ...item, status, handle: status === "disconnected" ? undefined : item.handle }
      : item
    ));
    setOpenMenu(null);
  }

  async function disconnectConnection(id: string) {
    if (tenant.source === "demo") {
      demoOnlyUpdate(id, "disconnected");
      return;
    }
    if (tenant.source !== "supabase") {
      setNotice("Conclua a configuração da conta antes de alterar conexões.");
      setOpenMenu(null);
      return;
    }

    const client = createSupabaseBrowserClient();
    if (!client) {
      setNotice("Supabase não está configurado neste ambiente.");
      setOpenMenu(null);
      return;
    }

    setNotice("Desconectando a conta...");
    setOpenMenu(null);
    const result = await client.rpc("disconnect_social_connection", { p_connection_id: id });
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    await tenant.refresh();
    setNotice("Conta desconectada do Tela Social. A credencial armazenada foi removida do backend.");
  }

  function demoOnlyRemove(id: string) {
    if (tenant.source !== "demo") {
      setNotice("A remoção real é feita pelo fluxo seguro da integração.");
      setOpenMenu(null);
      return;
    }
    setConnections(current => current.filter(item => item.id !== id));
    setOpenMenu(null);
    setNotice("Conta removida desta demonstração.");
  }

  const connectedFacebookIds = new Set(
    connections.filter(item => item.platform === "facebook" && item.status === "connected").map(item => item.providerAccountId)
  );

  return <div className="w-full max-w-full space-y-4 overflow-x-hidden">
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">Integrações</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Contas conectadas</h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">Conecte as contas que deseja usar. O Tela Social reaproveita autorizações do Facebook quando possível.</p>
      </div>
      <button onClick={() => setConnectOpen(true)} className="btn-primary self-start"><Plus size={16}/> Adicionar conta</button>
    </section>

    {tenant.source === "supabase" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
      O Instagram é conectado diretamente. Facebook e recursos avançados usam a autorização oficial da Meta, sem compartilhar sua senha com o Tela Social.
    </div>}

    {tenant.source === "needs_setup" && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
      Sua autenticação foi reconhecida, mas ainda não existe organização/marca vinculada a este usuário.
    </div>}

    {tenant.error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{tenant.error}</div>}

    {notice && <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <CircleAlert size={18} className="mt-0.5 shrink-0"/>
      <span className="min-w-0 flex-1">{notice}</span>
      <button className="shrink-0 text-xs font-black" onClick={() => setNotice("")}>Fechar</button>
    </div>}

    <section>
      <div className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {connections.map(connection => {
          const connected = connection.status === "connected";
          const attention = connection.status === "expired" || connection.status === "error";
          const menuVisible = openMenu === connection.id;
          const advancedInstagram = connection.platform === "instagram" && connection.metadata?.meta_advanced_enabled === true;
          const metaAuthorizedInstagram = connection.platform === "instagram" && connection.metadata?.meta_authorized === true;
          const metaLinkRequired = metaAuthorizedInstagram && !advancedInstagram && connection.metadata?.meta_link_required === true;
          const linkedPageId = metadataString(connection, "linked_page_id");
          const linkedPageName = metadataString(connection, "linked_page_name");
          const linkedMetaAssetId = metadataString(connection, "meta_asset_id");
          const linkedFacebookConnected = Boolean(linkedPageId && connectedFacebookIds.has(linkedPageId));

          return <article key={connection.id} className="card relative min-w-0 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <PlatformIcon platform={connection.platform}/>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black text-slate-950 sm:text-sm">{connection.displayName ?? platformLabels[connection.platform]}</p>
                <p className="mt-0.5 truncate text-sm text-slate-500 sm:text-xs">{connection.handle ?? platformLabels[connection.platform]}</p>
              </div>
              <button onClick={() => setOpenMenu(menuVisible ? null : connection.id)} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Mais opções"><MoreHorizontal size={18}/></button>

              {menuVisible && <div className="absolute right-3 top-12 z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                <button onClick={() => mockAction(connection.platform, "Esta conta usa autorização oficial e os detalhes técnicos permanecem protegidos no backend.")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Link2 size={15}/> Gerenciar</button>
                {connection.status !== "disconnected" && <button onClick={() => void disconnectConnection(connection.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Unplug size={15}/> Desconectar</button>}
                <button onClick={() => demoOnlyRemove(connection.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 size={15}/> Remover</button>
              </div>}
            </div>

            {connection.platform === "instagram" && connected && <div className={`mt-4 rounded-xl border p-3 ${advancedInstagram ? "border-indigo-200 bg-indigo-50/60" : metaAuthorizedInstagram ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-start gap-2">
                {advancedInstagram ? <Sparkles size={17} className="mt-0.5 shrink-0 text-indigo-600"/> : <Music2 size={17} className={`mt-0.5 shrink-0 ${metaAuthorizedInstagram ? "text-amber-700" : "text-slate-600"}`}/>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-black text-slate-900">Recursos avançados</p>
                    <span className="group relative inline-flex">
                      <button type="button" aria-label="Como funciona a ativação dos recursos avançados" className="rounded-full text-slate-400 outline-none hover:text-indigo-600 focus:text-indigo-600">
                        <CircleHelp size={15}/>
                      </button>
                      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-6 z-30 w-64 -translate-x-1/2 rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-medium leading-4 text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        Para ativar, use o Facebook que administra este Instagram. A autorização acontece nas telas oficiais da Meta. Se você entrar com outro Facebook, o login pode concluir, mas os recursos não serão ativados.
                      </span>
                    </span>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-black ${advancedInstagram ? "bg-indigo-100 text-indigo-700" : metaAuthorizedInstagram ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}`}>
                      {advancedInstagram ? "Ativos" : metaAuthorizedInstagram ? "Verificar" : "Não ativados"}
                    </span>
                  </div>

                  {advancedInstagram
                    ? <p className="mt-1 text-xs leading-5 text-indigo-800">Ativos para este Instagram pelo Facebook (Meta).</p>
                    : metaLinkRequired
                      ? <p className="mt-1 text-xs leading-5 text-amber-800">A autorização existe, mas ainda precisamos confirmar que esse Facebook administra este Instagram.</p>
                      : <p className="mt-1 text-xs leading-5 text-slate-600"><strong>Use o Facebook que administra este Instagram.</strong> Se usar outro Facebook, os recursos não serão ativados.</p>}
                </div>
              </div>

              {!advancedInstagram && <button
                onClick={() => void activateInstagramAdvanced(connection)}
                disabled={metaBusy === connection.id}
                className="mt-3 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
              >{metaBusy === connection.id
                ? metaAuthorizedInstagram ? "Verificando vínculo..." : "Abrindo Facebook..."
                : metaAuthorizedInstagram ? "Verificar vínculo" : "Ativar recursos avançados"}</button>}

              {advancedInstagram && <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-700"><CheckCircle2 size={14}/> Recursos avançados ativos</div>
                  <button type="button" onClick={() => startMetaOAuth("instagram_advanced", connection.id)} className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-indigo-700 hover:bg-indigo-50">Renovar autorização</button>
                </div>
                {linkedPageName && <div className="rounded-lg border border-indigo-100 bg-white/80 p-2.5 text-xs leading-5 text-slate-600">
                  <p><span className="font-bold text-slate-800">Página vinculada:</span> {linkedPageName}</p>
                  {linkedFacebookConnected
                    ? <p className="mt-1 flex items-center gap-1.5 font-bold text-emerald-700"><CheckCircle2 size={13}/> Facebook também conectado para publicar</p>
                    : linkedMetaAssetId && linkedPageId
                      ? <button
                          onClick={() => void connectFacebookAsset(linkedMetaAssetId)}
                          disabled={metaBusy === linkedMetaAssetId}
                          className="mt-2 rounded-lg border border-indigo-200 px-2.5 py-1.5 font-black text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                        >{metaBusy === linkedMetaAssetId ? "Conectando Página..." : "Conectar esta Página para publicar"}</button>
                      : null}
                </div>}
              </div>}
            </div>}

            {connection.platform === "tiktok" && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <Store size={16} className="shrink-0 text-slate-600"/>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">TikTok Shop</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">Mesma área TikTok para o usuário; autorização comercial separada apenas quando necessária.</p>
                </div>
                <button onClick={() => mockAction("tiktok", "TikTok Shop será ativado dentro desta mesma área. A conexão de loja permanece separada no backend.")} className="shrink-0 text-xs font-black text-indigo-600">Ativar</button>
              </div>
            </div>}

            <div className="mt-4 flex min-w-0 items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${connected ? "bg-emerald-50 text-emerald-700" : attention ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{statusLabel[connection.status]}</span>
              <button onClick={() => attention ? connectPlatform(connection.platform) : mockAction(connection.platform)} className="truncate text-sm font-bold text-indigo-600 sm:text-xs">
                {connected ? "Gerenciar" : attention ? "Reconectar" : "Conectar"}
              </button>
            </div>
          </article>;
        })}

        {!tenant.loading && !connections.length && <div className="card md:col-span-2 2xl:grid-cols-3 p-8 text-center">
          <Link2 className="mx-auto text-slate-400" size={28}/>
          <p className="mt-3 font-black text-slate-900">Nenhuma conta social conectada</p>
          <p className="mt-1 text-sm text-slate-500">Use “Adicionar conta” para escolher a primeira rede.</p>
          <button onClick={() => setConnectOpen(true)} className="btn-primary mt-4"><Plus size={16}/> Adicionar conta</button>
        </div>}
      </div>
    </section>

    <section className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      <ShieldCheck className="shrink-0" size={20}/>
      <div><p className="font-bold">Credenciais protegidas.</p><p className="mt-1 text-xs leading-5 text-emerald-800">O Tela Social nunca recebe sua senha do Instagram ou Facebook. O login acontece nas telas oficiais das plataformas e apenas credenciais autorizadas ficam protegidas no backend.</p></div>
    </section>

    {connectOpen && <>
      <button aria-label="Fechar seleção de rede" className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[1px]" onClick={() => setConnectOpen(false)}/>
      <section className="fixed inset-x-3 bottom-[84px] z-[60] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">Adicionar conta</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Escolha a rede que deseja conectar para publicar.</p>
          </div>
          <button onClick={() => setConnectOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {socialPlatforms.map(platform => <button key={platform} onClick={() => connectPlatform(platform)} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40">
            <PlatformIcon platform={platform}/>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-slate-900">{platformLabels[platform]}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{platform === "instagram" ? "Entrar diretamente no Instagram" : platform === "facebook" ? "Escolher Página para publicar" : "Conectar nova conta"}</span>
            </span>
          </button>)}
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          Facebook e recursos avançados do Instagram usam a autorização oficial da Meta. Se você já autorizou esse Facebook antes, o Tela Social reaproveita a autorização e evita pedir o mesmo login novamente.
        </div>
      </section>
    </>}

    {metaAssetsOpen && <>
      <button aria-label="Fechar Páginas do Facebook" className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[1px]" onClick={() => setMetaAssetsOpen(false)}/>
      <section className="fixed inset-x-3 bottom-[84px] z-[60] max-h-[72vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">Páginas do Facebook disponíveis</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Estas Páginas já estão disponíveis nas suas autorizações do Facebook (Meta). Escolha somente as que deseja usar para publicar. Nada é conectado automaticamente.</p>
          </div>
          <button onClick={() => setMetaAssetsOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button>
        </div>

        <div className="mt-4 space-y-2">
          {metaAssetsLoading && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Carregando Páginas...</div>}
          {!metaAssetsLoading && metaAssets.map(asset => {
            const alreadyConnected = connectedFacebookIds.has(asset.page_id);
            return <div key={asset.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-3">
                <PlatformIcon platform="facebook"/>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-900">{asset.page_name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{asset.instagram_username ? `Instagram vinculado: @${asset.instagram_username}` : "Sem Instagram profissional vinculado"}</p>
                </div>
                <button
                  disabled={alreadyConnected || metaBusy === asset.id}
                  onClick={() => void connectFacebookAsset(asset.id)}
                  className="shrink-0 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-black text-indigo-700 disabled:border-emerald-100 disabled:bg-emerald-50 disabled:text-emerald-700"
                >{alreadyConnected ? "Conectada" : metaBusy === asset.id ? "Conectando..." : "Conectar para publicar"}</button>
              </div>
            </div>;
          })}
          {!metaAssetsLoading && !metaAssets.length && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhuma Página do Facebook foi encontrada nessa autorização.</div>}
        </div>

        <button onClick={() => startMetaOAuth("facebook")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">
          <RefreshCw size={15}/> Usar outra conta do Facebook
        </button>
      </section>
    </>}
  </div>;
}
