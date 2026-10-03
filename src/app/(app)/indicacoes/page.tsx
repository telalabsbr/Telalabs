import { Copy, Gift, Link2, UsersRound } from "lucide-react";

export default function ReferralsPage() {
  return <div className="mx-auto w-full max-w-4xl space-y-5">
    <section>
      <p className="eyebrow">Crescimento</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Indique e ganhe</h1>
      <p className="mt-1 text-sm leading-6 text-slate-500">A estrutura já está reservada no produto, mas a recompensa final depende dos preços e da margem dos planos.</p>
    </section>

    <section className="grid gap-4 md:grid-cols-3">
      <article className="card p-4"><Link2 className="text-indigo-500" size={19}/><h2 className="mt-3 font-black text-slate-950">1. Compartilhe</h2><p className="mt-1 text-sm leading-6 text-slate-500">Cada cliente terá um link ou código próprio.</p></article>
      <article className="card p-4"><UsersRound className="text-indigo-500" size={19}/><h2 className="mt-3 font-black text-slate-950">2. Indicação qualifica</h2><p className="mt-1 text-sm leading-6 text-slate-500">A indicação será validada somente depois de um evento comercial real, como a primeira cobrança paga.</p></article>
      <article className="card p-4"><Gift className="text-indigo-500" size={19}/><h2 className="mt-3 font-black text-slate-950">3. Recompensa</h2><p className="mt-1 text-sm leading-6 text-slate-500">Crédito no plano é a opção inicial mais simples; afiliado com saque pode vir depois.</p></article>
    </section>

    <section className="card p-4 sm:p-5">
      <h2 className="font-black text-slate-950">Meu link de indicação</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">O link ficará disponível quando as regras comerciais forem fechadas.</p>
      <div className="mt-4 flex gap-2">
        <input readOnly value="Programa ainda não ativado" className="field bg-slate-50 px-3 text-sm text-slate-500"/>
        <button disabled className="btn-secondary shrink-0 opacity-60"><Copy size={15}/> Copiar</button>
      </div>
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">Minha sugestão é começar com <strong>indicação por crédito</strong>, sem comissão em dinheiro. Isso reduz fraude, suporte, tributação operacional e trabalho manual enquanto o negócio ainda é enxuto.</div>
    </section>
  </div>;
}
