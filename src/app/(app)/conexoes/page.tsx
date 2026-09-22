"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Link2, MoreHorizontal, Plus, ShieldCheck, Store, Trash2, Unplug, X } from "lucide-react";
import { platformLabels, socialPlatforms, type ConnectionStatus, type SocialPlatform } from "@/domain/social";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { useTenantData, type TenantConnection } from "@/components/tenant-provider";

const statusLabel: Record<ConnectionStatus, string> = {
  connected: "Conectado",
  disconnected: "Não conectado",
  expired: "Reconectar",
  error: "Com erro",
};

export default function ConnectionsPage() {
  const tenant = useTenantData();
  const [notice, setNotice] = useState("");
  const [connections, setConnections] = useState<TenantConnection[]>(tenant.connections);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  useEffect(() => {
    setConnections(tenant.connections);
  }, [tenant.connections]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (!oauth) return;

    const count = Number(params.get("count") ?? "0");
    const messages: Record<string, string> = {
      meta_connected: count > 1
        ? `${count} contas da Meta foram conectadas com segurança.`
        : "Conta da Meta conectada com segurança.",
      meta_no_eligible_accounts: "A autorização funcionou, mas não encontramos uma conta elegível para a rede escolhida.",
      meta_not_configured: "A infraestrutura Meta já está preparada, mas as credenciais do aplicativo Meta ainda não foram configuradas no ambiente.",
      meta_token_failed: "A Meta não concluiu a troca de autorização. Tente novamente depois de revisar as credenciais e permissões.",
      meta_state_invalid: "A autorização expirou ou não pôde ser validada. Inicie a conexão novamente.",
      meta_callback_failed: "Não foi possível concluir a conexão da Meta.",
      session_expired: "Sua sessão expirou durante a autorização. Entre novamente.",
      brand_not_accessible: "A marca selecionada não está acessível para esta sessão.",
      server_not_configured: "A integração segura do servidor ainda não está completamente configurada.",
    };

    setNotice(messages[oauth] ?? "A conexão não pôde ser concluída.");
    if (oauth === "meta_connected") void tenant.refresh();

    const clean = new URL(window.location.href);
    clean.searchParams.delete("oauth");
    clean.searchParams.delete("count");
    window.history.replaceState({}, "", clean.pathname + clean.search);
  }, []);

  function mockAction(platform: SocialPlatform, message?: string) {
    setNotice(message ?? (platformLabels[platform] + " ainda está aguardando a integração OAuth real."));
    setConnectOpen(false);
  }

  function connectPlatform(platform: SocialPlatform) {
    if (tenant.source === "supabase" && (platform === "instagram" || platform === "facebook")) {
      if (tenant.activeBrand.id === "unconfigured") {
        setNotice("Conclua a configuração da marca antes de conectar uma rede.");
        return;
      }
      const params = new URLSearchParams({
        platform,
        brand_id: tenant.activeBrand.id,
        return_to: "/conexoes",
      });
      window.location.assign("/api/oauth/meta/start?" + params.toString());
      return;
    }

    mockAction(
      platform,
      tenant.source === "supabase"
        ? platformLabels[platform] + " será conectado na próxima etapa do rollout OAuth. Instagram e Facebook já têm o fluxo Meta preparado."
        : undefined,
    );
  }

  function demoOnlyUpdate(id: string, status: ConnectionStatus) {
    if (tenant.source !== "demo") {
      setNotice("Esta ação será persistida quando a camada segura de OAuth estiver conectada. Nenhum token real foi alterado.");
      setOpenMenu(null);
      return;
    }
    setConnections(current => current.map(item => item.id === id
      ? { ...item, status, handle: status === "disconnected" ? undefined : item.handle }
      : item
    ));
    setOpenMenu(null);
  }

  function demoOnlyRemove(id: string) {
    if (tenant.source !== "demo") {
      setNotice("A remoção real será feita pelo backend seguro da integração. Esta versão não apaga credenciais reais.");
      setOpenMenu(null);
      return;
    }
    setConnections(current => current.filter(item => item.id !== id));
    setOpenMenu(null);
    setNotice("Conta removida desta demonstração.");
  }

  return <div className="w-full max-w-full space-y-4 overflow-x-hidden">
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">Integrações</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Contas conectadas</h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">Conecte mais de uma conta por rede e gerencie cada autorização separadamente.</p>
      </div>
      <button onClick={() => setConnectOpen(true)} className="btn-primary self-start"><Plus size={16}/> Adicionar conta</button>
    </section>

    {tenant.source === "supabase" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
      Esta tela já está lendo organização, marca e conexões do Supabase real.
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

          return <article key={connection.id} className="card relative min-w-0 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <PlatformIcon platform={connection.platform}/>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black text-slate-950 sm:text-sm">{connection.displayName ?? platformLabels[connection.platform]}</p>
                <p className="mt-0.5 truncate text-sm text-slate-500 sm:text-xs">{connection.handle ?? platformLabels[connection.platform]}</p>
              </div>
              <button onClick={() => setOpenMenu(menuVisible ? null : connection.id)} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Mais opções"><MoreHorizontal size={18}/></button>

              {menuVisible && <div className="absolute right-3 top-12 z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                <button onClick={() => mockAction(connection.platform, "Detalhes de permissões e capacidades desta conta entram junto do OAuth real.")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Link2 size={15}/> Gerenciar</button>
                {connection.status !== "disconnected" && <button onClick={() => demoOnlyUpdate(connection.id, "disconnected")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Unplug size={15}/> Desconectar</button>}
                <button onClick={() => demoOnlyRemove(connection.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 size={15}/> Remover</button>
              </div>}
            </div>

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

        {!tenant.loading && !connections.length && <div className="card md:col-span-2 2xl:col-span-3 p-8 text-center">
          <Link2 className="mx-auto text-slate-400" size={28}/>
          <p className="mt-3 font-black text-slate-900">Nenhuma conta social conectada</p>
          <p className="mt-1 text-sm text-slate-500">Use “Adicionar conta” para escolher a primeira rede.</p>
          <button onClick={() => setConnectOpen(true)} className="btn-primary mt-4"><Plus size={16}/> Adicionar conta</button>
        </div>}
      </div>
    </section>

    <section className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      <ShieldCheck className="shrink-0" size={20}/>
      <div><p className="font-bold">Credenciais protegidas.</p><p className="mt-1 text-xs leading-5 text-emerald-800">Tokens permanecem no backend. A interface mostra apenas o estado e as capacidades da conexão.</p></div>
    </section>

    {connectOpen && <>
      <button aria-label="Fechar seleção de rede" className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[1px]" onClick={() => setConnectOpen(false)}/>
      <section className="fixed inset-x-3 bottom-[84px] z-[60] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">Adicionar conta</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Escolha uma rede. Você poderá adicionar mais de uma conta da mesma plataforma.</p>
          </div>
          <button onClick={() => setConnectOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {socialPlatforms.map(platform => <button key={platform} onClick={() => connectPlatform(platform)} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40">
            <PlatformIcon platform={platform}/>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-slate-900">{platformLabels[platform]}</span>
              <span className="mt-0.5 block text-xs text-slate-500">Conectar nova conta</span>
            </span>
          </button>)}
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          As conexões reais usarão OAuth oficial. O Tela Social nunca pedirá a senha da rede social.
        </div>
      </section>
    </>}
  </div>;
}
