"use client";

import { useState } from "react";
import { Bell, HardDrive, Palette, Settings2 } from "lucide-react";
import { InstallAppCard } from "@/components/pwa-client";
import { useTenantData } from "@/components/tenant-provider";

export default function SettingsPage() {
  const tenant = useTenantData();
  const [notifications, setNotifications] = useState(true);
  const [defaultEmojis, setDefaultEmojis] = useState(true);
  const [deleteAfterPublish, setDeleteAfterPublish] = useState(true);

  return <div className="mx-auto w-full max-w-4xl space-y-5">
    <section>
      <p className="eyebrow">Preferências</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Preferências</h1>
      <p className="mt-1 text-sm leading-6 text-slate-500">Aqui ficam escolhas de comportamento do aplicativo. Perfil e cobrança foram separados para não misturar assuntos.</p>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <article className="card p-4 sm:p-5">
        <div className="flex items-center gap-3"><Settings2 className="text-indigo-500" size={19}/><h2 className="font-black text-slate-950">Publicação</h2></div>
        <div className="mt-4 space-y-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={defaultEmojis} onChange={event => setDefaultEmojis(event.target.checked)} className="mt-1"/>
            <span><span className="block text-sm font-bold text-slate-800">Usar emojis por padrão na adaptação</span><span className="mt-1 block text-xs leading-5 text-slate-500">Ainda pode ser alterado em cada publicação.</span></span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={deleteAfterPublish} onChange={event => setDeleteAfterPublish(event.target.checked)} className="mt-1"/>
            <span><span className="block text-sm font-bold text-slate-800">Excluir mídia depois de concluir todos os destinos</span><span className="mt-1 block text-xs leading-5 text-slate-500">A exclusão só ocorre depois da resolução completa dos destinos.</span></span>
          </label>
        </div>
      </article>

      <article className="card p-4 sm:p-5">
        <div className="flex items-center gap-3"><Bell className="text-indigo-500" size={19}/><h2 className="font-black text-slate-950">Notificações</h2></div>
        <div className="mt-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={notifications} onChange={event => setNotifications(event.target.checked)} className="mt-1"/>
            <span><span className="block text-sm font-bold text-slate-800">Alertas operacionais</span><span className="mt-1 block text-xs leading-5 text-slate-500">Conexão expirada, publicação com erro e outros eventos que exigem ação.</span></span>
          </label>
        </div>
      </article>

      <article className="card p-4 sm:p-5">
        <div className="flex items-center gap-3"><HardDrive className="text-indigo-500" size={19}/><h2 className="font-black text-slate-950">Armazenamento</h2></div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-600"><span>7,2 GB de 20 GB</span><span>36%</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[36%] rounded-full bg-indigo-500"/></div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Valores demonstrativos. Quotas comerciais ainda não foram definidas.</p>
        </div>
      </article>

      <article className="card p-4 sm:p-5">
        <div className="flex items-center gap-3"><Palette className="text-indigo-500" size={19}/><h2 className="font-black text-slate-950">Aparência</h2></div>
        <p className="mt-3 text-sm leading-6 text-slate-600">Modo claro, escuro, sistema e temas controlados entrarão aqui. O sistema visual já está preparado para isso.</p>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Marca atual: <strong>{tenant.activeBrand.name}</strong></div>
      </article>

      <article id="instalar" className="card p-4 sm:p-5 lg:col-span-2">
        <h2 className="font-black text-slate-950">Instalar no celular ou computador</h2>
        <p className="mt-1 mb-4 text-sm leading-6 text-slate-500">Use o Tela Social como aplicativo enquanto não existe um app nativo nas lojas.</p>
        <InstallAppCard/>
      </article>
    </section>
  </div>;
}
