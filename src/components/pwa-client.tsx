"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Smartphone } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function useInstallState() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [userAgent, setUserAgent] = useState("");

  useEffect(() => {
    setUserAgent(navigator.userAgent);
    const media = window.matchMedia("(display-mode: standalone)");
    if (media.matches) setInstalled(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIOS = useMemo(() => /iPad|iPhone|iPod/.test(userAgent), [userAgent]);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setPromptEvent(null);
  }

  return { promptEvent, installed, isIOS, install };
}

export function PwaClient() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}

export function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const { promptEvent, installed, install } = useInstallState();
  if (installed || !promptEvent) return null;

  return <button
    onClick={install}
    className={compact
      ? "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      : "btn-secondary"}
  >
    <Download size={18}/> Instalar aplicativo
  </button>;
}

export function InstallAppCard() {
  const { promptEvent, installed, isIOS, install } = useInstallState();

  if (installed) {
    return <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 shrink-0 text-emerald-600" size={20}/>
        <div>
          <p className="font-bold text-emerald-900">Tela Social já está instalado</p>
          <p className="mt-1 text-sm leading-6 text-emerald-800">Ele pode abrir em uma janela própria, sem a aparência tradicional do navegador.</p>
        </div>
      </div>
    </div>;
  }

  if (promptEvent) {
    return <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 shrink-0 text-indigo-600" size={20}/>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-indigo-950">Instalar Tela Social neste dispositivo</p>
          <p className="mt-1 text-sm leading-6 text-indigo-800">Crie um atalho com o ícone do aplicativo e abra em modo standalone.</p>
          <button onClick={install} className="btn-primary mt-3"><Download size={16}/> Instalar aplicativo</button>
        </div>
      </div>
    </div>;
  }

  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-start gap-3">
      <Smartphone className="mt-0.5 shrink-0 text-slate-600" size={20}/>
      <div>
        <p className="font-bold text-slate-900">Adicionar à tela inicial</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          {isIOS
            ? "No iPhone/iPad: abra o menu Compartilhar do navegador e escolha “Adicionar à Tela de Início”."
            : "Se o botão automático de instalação não aparecer, use o menu do navegador e escolha “Instalar app” ou “Adicionar à tela inicial”."}
        </p>
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-500"><ExternalLink size={13}/> O nome e o ícone poderão ser atualizados quando a marca final for definida.</p>
      </div>
    </div>
  </div>;
}
