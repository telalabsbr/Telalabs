import type { PublicationStatus } from "@/domain/publication";

const labels: Record<PublicationStatus, string> = { draft: "Rascunho", scheduled: "Agendado", processing: "Processando", published: "Publicado", failed: "Falhou", cancelled: "Cancelado" };
const styles: Record<PublicationStatus, string> = { draft: "bg-stone-100 text-stone-600", scheduled: "bg-amber-50 text-amber-700", processing: "bg-blue-50 text-blue-700", published: "bg-emerald-50 text-emerald-700", failed: "bg-red-50 text-red-700", cancelled: "bg-slate-100 text-slate-500" };
export function StatusBadge({ status }: { status: PublicationStatus }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>; }
