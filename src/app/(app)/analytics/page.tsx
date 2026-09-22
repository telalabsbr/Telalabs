import { BarChart3, Clock3, Eye, Heart, TrendingUp } from "lucide-react";

export default function AnalyticsPage() {
  const metrics = [
    { label: "Visualizações", value: "125,6K", note: "+18%", Icon: Eye },
    { label: "Engajamento", value: "8,4K", note: "+22%", Icon: Heart },
    { label: "Publicações", value: "42", note: "últimos 30 dias", Icon: BarChart3 },
  ];

  return <div className="space-y-5">
    <section>
      <p className="eyebrow">Desempenho</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Analytics</h1>
      <p className="mt-1 text-sm text-slate-500">Primeira camada simples. Dados reais entram conforme cada API liberar métricas confiáveis.</p>
    </section>

    <section className="grid gap-3 sm:grid-cols-3">
      {metrics.map(({label,value,note,Icon}) => <article key={label} className="card p-4">
        <Icon size={18} className="text-indigo-500"/>
        <p className="mt-4 text-2xl font-black text-slate-950">{value}</p>
        <p className="mt-1 text-xs font-bold text-slate-700">{label}</p>
        <p className="mt-1 text-[11px] text-emerald-600">{note}</p>
      </article>)}
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
      <article className="card p-5">
        <div className="flex items-center justify-between">
          <div><h2 className="font-bold text-slate-950">Desempenho no período</h2><p className="mt-1 text-xs text-slate-500">Espaço preparado para séries reais.</p></div>
          <TrendingUp className="text-indigo-500" size={18}/>
        </div>
        <div className="mt-6 flex h-56 items-end gap-3 rounded-xl bg-slate-50 p-4">
          {[32,48,40,68,56,82,72,92,76,100,88,110].map((height,index) => <div key={index} className="flex-1 rounded-t-md bg-indigo-200" style={{height}}/>)}
        </div>
      </article>
      <article className="card p-5">
        <Clock3 className="text-indigo-500" size={18}/>
        <h2 className="mt-4 font-bold text-slate-950">Melhores horários</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Só mostraremos recomendações personalizadas quando houver dados suficientes da conta.</p>
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs font-semibold text-indigo-800">Sem dados suficientes para recomendar ainda.</div>
      </article>
    </section>
  </div>;
}
