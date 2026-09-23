"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  CreditCard,
  FolderOpen,
  Gift,
  HelpCircle,
  History,
  Link2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TenantProvider, useTenantData } from "@/components/tenant-provider";
import { InitialSetup } from "@/components/initial-setup";

const nav = [
  { href: "/publicacoes/nova", label: "Criar publicação", icon: PenLine },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/biblioteca", label: "Biblioteca", icon: FolderOpen },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/conexoes", label: "Contas", icon: Link2 },
];

const mobileNav = [
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/biblioteca", label: "Biblioteca", icon: FolderOpen },
  { href: "/publicacoes/nova", label: "Criar", icon: PenLine, primary: true },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/conexoes", label: "Contas", icon: Link2 },
];

const accountMenu = [
  { href: "/conta/perfil", label: "Meu perfil", icon: UserRound },
  { href: "/conta/plano", label: "Plano e cobrança", icon: CreditCard },
  { href: "/configuracoes", label: "Preferências", icon: Settings },
  { href: "/indicacoes", label: "Indique e ganhe", icon: Gift },
  { href: "/ajuda", label: "Ajuda e suporte", icon: HelpCircle },
];

function AppShellContent({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { connections, activeBrand, source, user } = useTenantData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const attentionItems = connections.filter(connection => connection.status === "expired" || connection.status === "error");
  const attentionSignature = attentionItems.map(connection => connection.platform + ":" + connection.status).sort().join("|");
  const [seenAttentionSignature, setSeenAttentionSignature] = useState("");
  const attentionCount = attentionSignature && seenAttentionSignature !== attentionSignature ? attentionItems.length : 0;
  const showCreateTop = !path.startsWith("/publicacoes");

  useEffect(() => {
    const stored = window.localStorage.getItem("tela-sidebar-collapsed");
    if (stored === "1") setCollapsed(true);
    setSeenAttentionSignature(window.localStorage.getItem("tela-seen-account-alert") ?? "");
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
    if (path.startsWith("/conexoes") && attentionSignature) {
      window.localStorage.setItem("tela-seen-account-alert", attentionSignature);
      setSeenAttentionSignature(attentionSignature);
    }
  }, [path, attentionSignature]);

  function toggleCollapsed() {
    setCollapsed(value => {
      const next = !value;
      window.localStorage.setItem("tela-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  async function logout() {
    await createSupabaseBrowserClient()?.auth.signOut();
    window.location.href = "/login";
  }

  const pageTitle = useMemo(() => {
    if (path.startsWith("/configuracoes")) return "Preferências";
    if (path.startsWith("/conta/perfil")) return "Meu perfil";
    if (path.startsWith("/conta/plano")) return "Plano e cobrança";
    if (path.startsWith("/indicacoes")) return "Indique e ganhe";
    if (path.startsWith("/ajuda")) return "Ajuda e suporte";
    const found = nav.find(item => path === item.href || path.startsWith(item.href + "/"));
    return found?.label ?? "Tela Social";
  }, [path]);

  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  const userLabel = user?.user_metadata?.full_name || user?.email || "Minha conta";
  const userInitials = String(user?.user_metadata?.full_name || user?.email || "TS")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "TS";

  const sidebar = (
    <div className="flex h-full flex-col overflow-hidden">
      <div className={`flex h-16 shrink-0 items-center ${collapsed ? "justify-center px-3" : "justify-between px-4"}`}>
        <Link href="/publicacoes/nova" onClick={() => setMobileOpen(false)} className="focusable flex items-center gap-2 rounded-lg">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-black text-white shadow-sm">TS</span>
          {!collapsed && <span className="truncate text-lg font-black tracking-[-.04em] text-slate-950">Tela Social</span>}
        </Link>
        {!collapsed && <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-slate-500 md:hidden" aria-label="Fechar menu"><X size={19}/></button>}
      </div>

      <div className="mx-3 mt-2 shrink-0">
        <button className={`focusable flex w-full items-center rounded-xl border border-slate-200 bg-white text-left shadow-sm ${collapsed ? "justify-center p-2" : "gap-3 p-2.5"}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">{activeBrand.initials}</span>
          {!collapsed && <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-slate-800">{activeBrand.name}</span>
              <span className="block text-xs text-slate-500">{source === "supabase" ? "Marca atual" : source === "needs_setup" ? "Configuração pendente" : "Modo demonstração"}</span>
            </span>
            <ChevronDown size={15} className="shrink-0 text-slate-400"/>
          </>}
        </button>
      </div>

      <nav className="app-scrollbar mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Principal">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          const isCreate = href === "/publicacoes/nova";
          const needsAttention = href === "/conexoes" && attentionCount > 0;
          return <Link
            onClick={() => setMobileOpen(false)}
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={`focusable relative flex min-h-11 items-center rounded-xl text-sm font-semibold transition-colors ${collapsed ? "justify-center px-2" : "gap-3 px-3"} ${isCreate
              ? active ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              : active ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
          >
            <span className="relative shrink-0">
              <Icon size={18}/>
              {needsAttention && collapsed && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500"/>}
            </span>
            {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
            {!collapsed && needsAttention && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">{attentionCount}</span>}
          </Link>;
        })}
      </nav>
    </div>
  );

  return <div className={`min-h-screen w-full max-w-full overflow-x-hidden bg-[#f7f8fb] transition-[padding] ${collapsed ? "md:pl-[72px]" : "md:pl-[224px]"}`}>
    <aside className={`fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-white transition-[width] md:block ${collapsed ? "w-[72px]" : "w-56"}`}>{sidebar}</aside>

    {mobileOpen && <div className="fixed inset-0 z-50 md:hidden">
      <button aria-label="Fechar menu" className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]" onClick={() => setMobileOpen(false)}/>
      <aside className="relative h-full w-[min(18rem,88vw)] border-r border-slate-200 bg-white shadow-2xl">{sidebar}</aside>
    </div>}

    <header className="sticky top-0 z-30 flex h-16 w-full max-w-full items-center gap-2 border-b border-slate-200 bg-white/92 px-3 backdrop-blur sm:gap-3 sm:px-4 md:px-6">
      <button onClick={() => setMobileOpen(true)} className="shrink-0 rounded-lg p-2 text-slate-600 md:hidden" aria-label="Abrir menu"><Menu size={20}/></button>
      <button onClick={toggleCollapsed} className="hidden shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:inline-flex" aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
        {collapsed ? <PanelLeftOpen size={19}/> : <PanelLeftClose size={19}/>}
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-slate-900 md:text-sm">{pageTitle}</p>
      </div>

      {showCreateTop && <Link href="/publicacoes/nova" className="btn-primary !min-h-9 shrink-0 !px-3">
        <PenLine size={16}/>
        <span className="hidden sm:inline">Criar publicação</span>
        <span className="sm:hidden">Criar</span>
      </Link>}

      <div className="relative shrink-0">
        <button onClick={() => setProfileOpen(value => !value)} className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white shadow-sm" aria-label="Abrir menu da conta" aria-expanded={profileOpen}>
          {userInitials}
        </button>

        {profileOpen && <>
          <button className="fixed inset-0 z-30 cursor-default bg-transparent" aria-label="Fechar menu da conta" onClick={() => setProfileOpen(false)}/>
          <div className="absolute right-0 top-12 z-40 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-4">
              <p className="truncate text-sm font-black text-slate-950">{userLabel}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{activeBrand.name}</p>
            </div>
            <div className="p-2">
              {accountMenu.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setProfileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Icon size={17} className="text-slate-500"/>
                <span>{label}</span>
              </Link>)}
            </div>
            <div className="border-t border-slate-100 p-2">
              <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50">
                <LogOut size={17}/> Sair
              </button>
            </div>
          </div>
        </>}
      </div>
    </header>

    <main className="mx-auto w-full max-w-[1560px] overflow-x-hidden p-3 sm:p-5 md:p-6 lg:p-8">
      {source === "needs_setup" ? <InitialSetup/> : children}
    </main>

    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[72px] grid-cols-5 border-t border-slate-200 bg-white/96 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Navegação móvel">
      {mobileNav.map(({ href, label, icon: Icon, primary }) => {
        const active = isActive(href);
        const needsAttention = href === "/conexoes" && attentionCount > 0;
        return <Link key={href} href={href} className={`relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-xs font-semibold ${active ? "text-indigo-600" : "text-slate-500"}`}>
          <span className={`relative grid h-9 w-9 place-items-center rounded-xl ${primary ? "bg-indigo-600 text-white shadow-sm" : active ? "bg-indigo-50" : ""}`}>
            <Icon size={18}/>
            {needsAttention && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500"/>}
          </span>
          <span className="truncate">{label}</span>
        </Link>;
      })}
    </nav>
  </div>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <TenantProvider><AppShellContent>{children}</AppShellContent></TenantProvider>;
}
