import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, PenLine, RefreshCw } from "lucide-react";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { publications } from "@/data/mock";

export default function DashboardPage() {
  const upcoming = publications.filter(p => p.status === "scheduled").slice(0, 3);
  const recent = publications.filter(p => p.status !== "scheduled").slice(0, 3);

  return <div className="space-y-5">
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between md:p-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Domingo, 21 de setembro</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Bom dia, Thiago.</h1>
        <p className="mt-1 text-sm text-slate-600">O que precisa ser publicado e o que exige sua atenção hoje.</p>
      </div>
      <Link href="/publicacoes/nova" className="btn-primary self-start sm:self-auto"><PenLine size={17}/> Criar publicação</Link>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.6fr_.8fr]">
      <article className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-950">Próximas publicações</h2>
            <p className="mt-0.5 text-xs text-slate-500">Seu conteúdo agendado, sem ruído.</p>
          </div>
          <Link href="/calendario" className="flex items-center gap-1 text-xs font-bold text-indigo-600">Ver calendário <ArrowRight size={14}/></Link>
        </div>
        <div className="divide-y divide-slate-100">
          {upcoming.length ? upcoming.map(pub => <Link href={`/historico#${pub.id}`} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 px-5 py-4 hover:bg-slate-50 sm:grid-cols-[52px_1fr_auto_auto]" key={pub.id}>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-slate-100 to-indigo-50 text-lg text-slate-700">{pub.mediaType === "video" ? "▶" : "✦"}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{pub.baseText}</p>
              <p className="mt-1 text-xs text-slate-500">{pub.scheduledAt ? "Hoje · 18:30" : "Sem horário"}</p>
            </div>
            <div className="hidden items-center -space-x-1 sm:flex">{pub.destinations.map(d => <PlatformIcon key={d.id} platform={d.platform} small />)}</div>
            <StatusBadge status={pub.status}/>
          </Link>) : <div className="px-5 py-10 text-center">
            <CheckCircle2 className="mx-auto text-emerald-500" size={26}/>
            <p className="mt-2 text-sm font-bold text-slate-800">Nenhuma publicação próxima</p>
            <p className="mt-1 text-xs text-slate-500">Crie um conteúdo quando estiver pronto.</p>
          </div>}
        </div>
      </article>

      <article className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-950">Atenção necessária</h2>
            <p className="mt-0.5 text-xs text-slate-500">Só mostramos o que precisa de ação.</p>
          </div>
          <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600">2</span>
        </div>
        <div className="space-y-3 p-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={17}/>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-950">YouTube precisa reconectar</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">A conexão expirou e pode bloquear novos envios.</p>
                <Link href="/conexoes" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-900"><RefreshCw size={13}/> Reconectar</Link>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 shrink-0 text-red-600" size={17}/>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-red-950">1 destino falhou</p>
                <p className="mt-1 text-xs leading-5 text-red-800">O restante da publicação não foi cancelado.</p>
                <Link href="/historico" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-red-900">Ver detalhes <ArrowRight size={13}/></Link>
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>

    <section className="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
      <article className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-950">Esta semana</h2>
            <p className="mt-0.5 text-xs text-slate-500">Resumo operacional.</p>
          </div>
          <CalendarDays className="text-indigo-500" size={19}/>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[["12","Publicações"],["8","Agendadas"],["1","Falha"]].map(([value,label]) => <div key={label} className="rounded-xl bg-slate-50 p-3">
            <p className="text-xl font-black text-slate-950">{value}</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</p>
          </div>)}
        </div>
        <Link href="/calendario" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-600">Abrir calendário <ArrowRight size={13}/></Link>
      </article>

      <article className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-950">Publicações recentes</h2>
            <p className="mt-0.5 text-xs text-slate-500">Histórico rápido, sem transformar o início em Analytics.</p>
          </div>
          <Link href="/historico" className="text-xs font-bold text-indigo-600">Ver todas</Link>
        </div>
        <div className="divide-y divide-slate-100">
          {recent.map(pub => <Link key={pub.id} href={`/historico#${pub.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm">{pub.mediaType === "video" ? "▶" : "✦"}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{pub.baseText}</p>
              <div className="mt-1 flex items-center gap-1">{pub.destinations.slice(0,4).map(d => <PlatformIcon key={d.id} platform={d.platform} small />)}</div>
            </div>
            <StatusBadge status={pub.status}/>
          </Link>)}
        </div>
      </article>
    </section>
  </div>;
}
