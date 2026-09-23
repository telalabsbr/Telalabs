import type { PublicationStatus } from "@/domain/publication";

const labels: Record<PublicationStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  processing: "Processando",
  retrying: "Tentando novamente",
  verifying: "Verificando",
  needs_action: "Ação necessária",
  published: "Publicado",
  failed: "Erro",
  cancelled: "Cancelado",
};

const styles: Record<PublicationStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-indigo-50 text-indigo-700",
  processing: "bg-blue-50 text-blue-700",
  retrying: "bg-amber-50 text-amber-700",
  verifying: "bg-cyan-50 text-cyan-700",
  needs_action: "bg-orange-50 text-orange-800",
  published: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

export function StatusBadge({ status }: { status: PublicationStatus }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status]}`}>{labels[status]}</span>;
}
