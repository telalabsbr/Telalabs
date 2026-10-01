from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Trecho esperado não encontrado em {path}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


calendar = "src/app/(app)/calendario/page.tsx"

replace_once(
    calendar,
    '''const statusOptions: Array<{ value: PublicationStatus; label: string }> = [
  { value: "draft", label: "Rascunho" },
  { value: "scheduled", label: "Agendado" },
  { value: "processing", label: "Processando" },
  { value: "published", label: "Publicado" },
  { value: "failed", label: "Erro" },
  { value: "cancelled", label: "Cancelado" },
];''',
    '''const statusOptions: Array<{ value: PublicationStatus; label: string }> = [
  { value: "draft", label: "Rascunho" },
  { value: "scheduled", label: "Agendado" },
  { value: "processing", label: "Publicando" },
  { value: "retrying", label: "Retentativa automática" },
  { value: "verifying", label: "Verificando" },
  { value: "needs_action", label: "Ação necessária" },
  { value: "published", label: "Publicado" },
  { value: "failed", label: "Erro" },
  { value: "cancelled", label: "Cancelado" },
];''',
)

replace_once(
    calendar,
    '''  const counts = useMemo(() => ({
    total: periodPublications.length,
    scheduled: periodPublications.filter(item => item.status === "scheduled" || item.status === "processing").length,
    failed: periodPublications.filter(item => item.status === "failed").length,
  }), [periodPublications]);''',
    '''  const counts = useMemo(() => ({
    total: periodPublications.length,
    scheduled: periodPublications.filter(item => item.status === "scheduled").length,
    processing: periodPublications.filter(item => ["processing", "retrying", "verifying"].includes(item.status)).length,
    failed: periodPublications.filter(item => item.status === "failed" || item.status === "needs_action").length,
  }), [periodPublications]);''',
)

replace_once(
    calendar,
    '''    {selected.status === "failed" && <div className="rounded-xl border border-red-200 bg-red-50 p-4">''',
    '''    {selected.status === "processing" && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
      <p className="font-black">Publicação em andamento</p>
      <p className="mt-1">A rede recebeu a mídia e ainda está processando. O Tela Social continua verificando automaticamente; não é necessário clicar novamente.</p>
    </div>}

    {selected.status === "retrying" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
      <p className="font-black">Retentativa automática</p>
      <p className="mt-1">Houve uma falha temporária. O Tela Social tentará novamente sem criar uma nova publicação e sem você precisar clicar.</p>
    </div>}

    {selected.status === "verifying" && <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-900">
      <p className="font-black">Confirmando com a rede</p>
      <p className="mt-1">O resultado ainda não está confirmado. O Tela Social verifica antes de qualquer novo envio para evitar publicação duplicada.</p>
    </div>}

    {selected.status === "failed" && <div className="rounded-xl border border-red-200 bg-red-50 p-4">''',
)

replace_once(
    calendar,
    '''    <section className="grid grid-cols-3 gap-2 sm:gap-3">
      <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm sm:p-4">
        <p className="text-xl font-black text-emerald-950 sm:text-2xl">{counts.total}</p>
        <p className="mt-1 text-xs font-bold text-emerald-700 sm:text-sm">Publicações</p>
      </article>
      <article className="rounded-2xl border border-blue-200 bg-blue-50 p-3 shadow-sm sm:p-4">
        <p className="text-xl font-black text-blue-950 sm:text-2xl">{counts.scheduled}</p>
        <p className="mt-1 text-xs font-bold text-blue-700 sm:text-sm">Agendadas</p>
      </article>
      <article className="rounded-2xl border border-red-200 bg-red-50 p-3 shadow-sm sm:p-4">
        <p className="text-xl font-black text-red-950 sm:text-2xl">{counts.failed}</p>
        <p className="mt-1 text-xs font-bold text-red-700 sm:text-sm">Falha</p>
      </article>
    </section>''',
    '''    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm sm:p-4">
        <p className="text-xl font-black text-emerald-950 sm:text-2xl">{counts.total}</p>
        <p className="mt-1 text-xs font-bold text-emerald-700 sm:text-sm">Publicações</p>
      </article>
      <article className="rounded-2xl border border-blue-200 bg-blue-50 p-3 shadow-sm sm:p-4">
        <p className="text-xl font-black text-blue-950 sm:text-2xl">{counts.scheduled}</p>
        <p className="mt-1 text-xs font-bold text-blue-700 sm:text-sm">Agendadas</p>
      </article>
      <article className="rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-sm sm:p-4">
        <p className="text-xl font-black text-amber-950 sm:text-2xl">{counts.processing}</p>
        <p className="mt-1 text-xs font-bold text-amber-700 sm:text-sm">Publicando</p>
      </article>
      <article className="rounded-2xl border border-red-200 bg-red-50 p-3 shadow-sm sm:p-4">
        <p className="text-xl font-black text-red-950 sm:text-2xl">{counts.failed}</p>
        <p className="mt-1 text-xs font-bold text-red-700 sm:text-sm">Falha</p>
      </article>
    </section>''',
)

replace_once(
    "src/components/publication-editor.tsx",
    '''        setSaveMessage(succeeded === 1 ? "Publicado com sucesso." : `${succeeded} destinos publicados com sucesso.`);''',
    '''        setSaveMessage(succeeded === 1 ? "Publicado." : `${succeeded} destinos publicados.`);''',
)

replace_once(
    "src/components/ui/status-badge.tsx",
    '''  processing: "Processando",
  retrying: "Tentando novamente",''',
    '''  processing: "Publicando",
  retrying: "Retentativa automática",''',
)

print("Ajustes aplicados com sucesso.")
