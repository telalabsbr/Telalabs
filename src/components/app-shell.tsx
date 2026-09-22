"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  FolderOpen,
  HelpCircle,
  History,
  Home,
  Link2,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { workspace } from "@/data/mock";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const nav = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/publicacoes/nova", label: "Criar publicação", icon: PenLine },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/biblioteca", label: "Biblioteca", icon: FolderOpen },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/conexoes", label: "Contas", icon: Link2 },
];

const mobileNav = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/publicacoes/nova", label: "Criar", icon: PenLine, primary: true },
  { href: "/biblioteca", label: "Biblioteca", icon: FolderOpen },
  { href: "/conexoes", label: "Mais", icon: Menu },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("tela-sidebar-collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);

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
    const found = nav.find(item => path === item.href || path.startsWith(item.href + "/"));
    return found?.label ?? "Tela Social";
  }, [path]);

  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className={`flex h-16 items-center ${collapsed ? "justify-center px-3" : "justify-between px-4"}`}>
        <Link href="/dashboard" className="focusable flex items-center gap-2 rounded-lg">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-black text-white shadow-sm">TS</span>
          {!collapsed && <span className="text-lg font-black tracking-[-.04em] text-slate-950">Tela Social</span>}
        </Link>
        {!collapsed && <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-slate-500 md:hidden" aria-label="Fechar menu"><X size={19}/></button>}
      </div>

      <div className={`mx-3 mt-2 ${collapsed ? "px-0" : ""}`}>
        <button className={`focusable flex w-full items-center rounded-xl border border-slate-200 bg-white text-left shadow-sm ${collapsed ? "justify-center p-2" : "gap-3 p-2.5"}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">{workspace.initials}</span>
          {!collapsed && <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-slate-800">{workspace.name}</span>
              <span className="block text-[11px] text-slate-500">Marca atual</span>
            </span>
            <ChevronDown size={15} className="text-slate-400"/>
          </>}
        </button>
      </div>

      <nav className="app-scrollbar mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Principal">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          const isCreate = href === "/publicacoes/nova";
          return <Link
            onClick={() => setMobileOpen(false)}
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={`focusable flex min-h-10 items-center rounded-xl text-sm font-semibold transition-colors ${collapsed ? "justify-center px-2" : "gap-3 px-3"} ${isCreate
              ? active ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              : active ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
          >
            <Icon size={18}/>
            {!collapsed && label}
          </Link>;
        })}
      </nav>

      <div className="border-t border-slate-200 px-3 py-3">
        <div className="space-y-1">
          <button title={collapsed ? "Ajuda" : undefined} className={`flex w-full items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 ${collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"}`}>
            <HelpCircle size={18}/>{!collapsed && "Ajuda"}
          </button>
          <button title={collapsed ? "Configurações" : undefined} className={`flex w-full items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 ${collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"}`}>
            <Settings size={18}/>{!collapsed && "Configurações"}
          </button>
        </div>

        <div className={`mt-2 flex items-center rounded-xl bg-slate-50 ${collapsed ? "justify-center p-2" : "gap-3 p-2.5"}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white">TS</span>
          {!collapsed && <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-800">Thiago</p>
            <button onClick={logout} className="text-[11px] text-slate-500 hover:text-slate-900">Sair</button>
          </div>}
        </div>
      </div>
    </div>
  );

  return <div className={`min-h-screen bg-[#f7f8fb] transition-[padding] ${collapsed ? "md:pl-[72px]" : "md:pl-[224px]"}`}>
    <aside className={`fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-white transition-[width] md:block ${collapsed ? "w-[72px]" : "w-56"}`}>{sidebar}</aside>

    {mobileOpen && <div className="fixed inset-0 z-50 md:hidden">
      <button aria-label="Fechar menu" className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]" onClick={() => setMobileOpen(false)}/>
      <aside className="relative h-full w-72 border-r border-slate-200 bg-white shadow-2xl">{sidebar}</aside>
    </div>}

    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/92 px-4 backdrop-blur md:px-6">
      <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-600 md:hidden" aria-label="Abrir menu"><Menu size={20}/></button>
      <button onClick={toggleCollapsed} className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:inline-flex" aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
        {collapsed ? <PanelLeftOpen size={19}/> : <PanelLeftClose size={19}/>}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">{pageTitle}</p>
        <p className="hidden text-xs text-slate-500 sm:block">Estética simples para uma operação rápida.</p>
      </div>
      <Link href="/publicacoes/nova" className="btn-primary hidden sm:inline-flex"><PenLine size={16}/> Criar publicação</Link>
      <button className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white">TS</button>
    </header>

    <main className="mx-auto max-w-[1560px] p-4 sm:p-5 md:p-6 lg:p-8">{children}</main>

    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-5 border-t border-slate-200 bg-white/96 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Navegação móvel">
      {mobileNav.map(({ href, label, icon: Icon, primary }) => {
        const active = isActive(href);
        return <Link key={href} href={href} className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold ${active ? "text-indigo-600" : "text-slate-500"}`}>
          <span className={`grid h-8 w-8 place-items-center rounded-xl ${primary ? "bg-indigo-600 text-white shadow-sm" : active ? "bg-indigo-50" : ""}`}><Icon size={17}/></span>
          {label}
        </Link>;
      })}
    </nav>
  </div>;
}
