"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Chrome } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "recover";

function safeNext() {
  if (typeof window === "undefined") return "/publicacoes/nova";
  const value = new URLSearchParams(window.location.search).get("next");
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/publicacoes/nova";
}

function callbackUrl(next: string) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function changeMode(next: Mode) {
    setMode(next);
    setMessage("");
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const client = createSupabaseBrowserClient();
    if (!client) {
      setError("A autenticação real não está configurada neste ambiente.");
      return;
    }

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const fullName = String(data.get("full_name") ?? "").trim();
    const passwordConfirmation = String(data.get("password_confirmation") ?? "");
    const next = safeNext();

    if (mode === "signup") {
      if (fullName.length < 2) {
        setError("Informe seu nome.");
        return;
      }
      if (password.length < 8) {
        setError("Use uma senha com pelo menos 8 caracteres.");
        return;
      }
      if (password !== passwordConfirmation) {
        setError("As senhas não coincidem.");
        return;
      }
    }

    setBusy(true);

    if (mode === "recover") {
      const result = await client.auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl("/atualizar-senha"),
      });
      setBusy(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setMessage("Se esse e-mail estiver cadastrado, enviaremos um link para criar uma nova senha.");
      return;
    }

    if (mode === "signup") {
      const result = await client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: callbackUrl(next),
        },
      });
      setBusy(false);

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.data.session) {
        window.location.assign(next);
        return;
      }

      setMessage("Conta criada. Verifique seu e-mail para confirmar o cadastro e entrar no Tela Social.");
      return;
    }

    const result = await client.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    window.location.assign(next);
  }

  async function signInWithGoogle() {
    setMessage("");
    setError("");

    const client = createSupabaseBrowserClient();
    if (!client) {
      setError("A autenticação real não está configurada neste ambiente.");
      return;
    }

    setBusy(true);
    const result = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl(safeNext()),
      },
    });

    if (result.error) {
      setBusy(false);
      setError(result.error.message);
    }
  }

  return <main className="grid min-h-screen lg:grid-cols-2">
    <section className="relative hidden overflow-hidden bg-[#17231d] p-14 text-white lg:flex lg:flex-col lg:justify-between">
      <Link href="/login" className="text-3xl font-black tracking-[-.08em]">te<span className="text-[#8ab096]">l</span>a.</Link>
      <div className="relative z-10 max-w-lg">
        <p className="eyebrow !text-[#9db0a4]">Seu conteúdo, amplificado</p>
        <h1 className="mt-6 text-5xl font-bold leading-[1.08] tracking-tight">Uma ideia.<br/>Todos os lugares.</h1>
        <p className="mt-6 text-lg leading-8 text-[#b9c7bf]">Prepare, adapte, agende e acompanhe conteúdo para várias redes em um único fluxo.</p>
        <div className="mt-10 space-y-4 text-sm text-[#d5ded8]">
          {["Uma publicação, vários destinos", "Personalização por plataforma", "Resultado separado por conta"].map(item =>
            <p className="flex items-center gap-3" key={item}><CheckCircle2 size={18} className="text-[#8fb19a]"/>{item}</p>
          )}
        </div>
      </div>
      <p className="text-xs text-[#74857b]">Tela Social · nome provisório</p>
      <div className="absolute -bottom-48 -right-48 h-[520px] w-[520px] rounded-full border-[90px] border-white/[.025]"/>
    </section>

    <section className="flex items-center justify-center p-5 sm:p-8 md:p-12">
      <div className="w-full max-w-md">
        <Link href="/login" className="mb-10 block text-3xl font-black tracking-[-.08em] lg:hidden">te<span className="text-[#6d957b]">l</span>a.</Link>

        <p className="eyebrow">{mode === "signup" ? "Comece agora" : mode === "recover" ? "Recuperar acesso" : "Acesse sua conta"}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          {mode === "signup" ? "Crie sua conta" : mode === "recover" ? "Esqueceu a senha?" : "Entre no Tela Social"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {mode === "recover"
            ? "Informe seu e-mail e enviaremos um link seguro para criar uma nova senha."
            : mode === "signup"
              ? "Cadastre-se com e-mail e senha. Depois você poderá conectar suas redes por autorização oficial."
              : "Use seu e-mail e senha para continuar."}
        </p>

        {mode !== "recover" && <button
          type="button"
          disabled={busy}
          onClick={() => void signInWithGoogle()}
          className="btn-secondary mt-7 w-full disabled:opacity-50"
        >
          <Chrome size={17}/> Continuar com Google
        </button>}

        {mode !== "recover" && <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[.12em] text-slate-400">
          <span className="h-px flex-1 bg-slate-200"/><span>ou</span><span className="h-px flex-1 bg-slate-200"/>
        </div>}

        <form onSubmit={submit} className={mode === "recover" ? "mt-7 space-y-4" : "space-y-4"}>
          {mode === "signup" && <label className="block text-sm font-semibold text-slate-700">
            Nome
            <input required minLength={2} name="full_name" autoComplete="name" placeholder="Seu nome" className="field mt-2 px-4 text-base sm:text-sm"/>
          </label>}

          <label className="block text-sm font-semibold text-slate-700">
            E-mail
            <input required name="email" type="email" autoComplete="email" placeholder="voce@empresa.com" className="field mt-2 px-4 text-base sm:text-sm"/>
          </label>

          {mode !== "recover" && <label className="block text-sm font-semibold text-slate-700">
            Senha
            <input required minLength={8} name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="Mínimo de 8 caracteres" className="field mt-2 px-4 text-base sm:text-sm"/>
          </label>}

          {mode === "signup" && <label className="block text-sm font-semibold text-slate-700">
            Confirmar senha
            <input required minLength={8} name="password_confirmation" type="password" autoComplete="new-password" placeholder="Repita a senha" className="field mt-2 px-4 text-base sm:text-sm"/>
          </label>}

          {mode === "login" && <button type="button" onClick={() => changeMode("recover")} className="text-sm font-semibold text-[#426b54]">Esqueci minha senha</button>}

          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#315d43] px-4 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Aguarde..." : mode === "signup" ? "Criar conta" : mode === "recover" ? "Enviar instruções" : "Entrar"}
            {!busy && <ArrowRight size={16}/>}
          </button>
        </form>

        {message && <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{message}</div>}
        {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</div>}

        <p className="mt-7 text-center text-sm text-slate-500">
          {mode === "recover" ? <>
            Lembrou sua senha? <button onClick={() => changeMode("login")} className="font-bold text-[#315d43]">Entrar</button>
          </> : mode === "signup" ? <>
            Já tem uma conta? <button onClick={() => changeMode("login")} className="font-bold text-[#315d43]">Entrar</button>
          </> : <>
            Ainda não tem uma conta? <button onClick={() => changeMode("signup")} className="font-bold text-[#315d43]">Criar conta</button>
          </>}
        </p>

        <p className="mt-5 text-center text-xs leading-5 text-slate-400">As senhas das redes sociais nunca são solicitadas pelo Tela Social. As conexões usam OAuth oficial.</p>
      </div>
    </section>
  </main>;
}
