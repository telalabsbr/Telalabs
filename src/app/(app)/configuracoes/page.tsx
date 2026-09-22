"use client";

import { useState } from "react";
import {
  Bell,
  Building2,
  CreditCard,
  HardDrive,
  Palette,
  Settings2,
  UserRound,
} from "lucide-react";
import { InstallAppCard } from "@/components/pwa-client";

export default function SettingsPage() {
  const [notifications, setNotifications] = useState(true);
  const [defaultEmojis, setDefaultEmojis] = useState(true);
  const [deleteAfterPublish, setDeleteAfterPublish] = useState(true);

  return <div className="w-full max-w-4xl space-y-5">
    <section>
      <p className="eyebrow">Preferências</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Configurações</h1>
      <p className="mt-1 text-sm leading-6 text-slate-500">Preferências da conta, marca, publicação, armazenamento e instalação do aplicativo.</p>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <article className="card p-4 sm:p-5">
        <div className="flex items-center gap-3"><UserRound className="text-indigo-500" size={19}/><h2 className="font-black text-slate-950">Conta</h2></div>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-bold text-slate-700">Nome<input className="field mt-1 px-3 text-base sm:text-sm" defaultValue="Thiago"/></label>
          <label className="block text-sm font-bold text-slate-700">E-mail<input className="field mt-1 px-3 text-base sm:text-sm" defaultValue="telalabs.br@gmail.com" disabled/></label>
        </div>
      </article>

      <article className="card p-4 sm:p-5">
        <div className="flex items-center gap-3"><Building2 className="text-indigo-500" size={19}/><h2 className="font-black text-slate-950">Marca / perfil</h2></div>
        <p className="mt-2 text-sm leading-6 text-slate-500">Nome, identificação visual e preferências que pertencem à marca atual.</p>
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <p className="text-sm font-bold text-slate-900">Estúdio Aurora</p>
          <p className="mt-1 text-xs text-slate-500">Nome demonstrativo. A nomenclatura final “Marca / Perfil” ainda será fechada.</p>
        </div>
      </article>

      <article className="card p-4 sm:p-5">
        <div className="flex items-center gap-3"><Settings2 className="text-indigo-500" size={19}/><h2 className="font-black text-slate-950">Publicação</h2></div>
        <div className="mt-4 space-y-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={defaultEmojis} onChange={event => setDefaultEmojis(event.target.checked)} className="mt-1"/>
            <span><span className="block text-sm font-bold text-slate-800">Usar emojis por padrão na adaptação</span><span className="mt-1 block text-xs leading-5 text-slate-500">Pode ser alterado em cada publicação.</span></span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={deleteAfterPublish} onChange={event => setDeleteAfterPublish(event.target.checked)} className="mt-1"/>
            <span><span className="block text-sm font-bold text-slate-800">Excluir mídia após concluir todos os destinos</span><span className="mt-1 block text-xs leading-5 text-slate-500">A exclusão só ocorre depois de sucesso, cancelamento ou resolução dos destinos.</span></span>
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
        <div className="flex items-center gap-3"><CreditCard className="text-indigo-500" size={19}/><h2 className="font-black text-slate-950">Plano e uso</h2></div>
        <p className="mt-3 text-sm leading-6 text-slate-600">O Tela Social suportará várias contas, inclusive mais de uma conta da mesma rede. O limite comercial será controlado pelo plano, sem bloquear tipos de rede artificialmente.</p>
        <div className="mt-3 rounded-xl bg-indigo-50 p-3 text-xs font-semibold leading-5 text-indigo-800">Quantidade final de marcas, contas conectadas, publicações e IA ainda será definida com o modelo de custos.</div>
      </article>

      <article className="card p-4 sm:p-5 lg:col-span-2">
        <div className="flex items-center gap-3"><Palette className="text-indigo-500" size={19}/><h2 className="font-black text-slate-950">Aparência</h2></div>
        <p className="mt-2 text-sm leading-6 text-slate-500">Modo claro, escuro, sistema e temas controlados fazem parte do design previsto. O dark completo entra depois que a estrutura responsiva estiver estabilizada.</p>
      </article>

      <article className="card p-4 sm:p-5 lg:col-span-2">
        <h2 className="font-black text-slate-950">Instalar no celular ou computador</h2>
        <p className="mt-1 mb-4 text-sm leading-6 text-slate-500">Use o Tela Social como um aplicativo enquanto não existe um app nativo nas lojas.</p>
        <InstallAppCard/>
      </article>
    </section>
  </div>;
}
