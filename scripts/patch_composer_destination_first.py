from pathlib import Path

p = Path('src/components/publication-editor.tsx')
s = p.read_text()

# Imports / state
s = s.replace('  CheckCircle2,\n', '')
if '  ChevronDown,\n' not in s:
    s = s.replace('  Check,\n', '  Check,\n  ChevronDown,\n')
s = s.replace('  const [selectedIds, setSelectedIds] = useState<string[]>([]);\n', '  const [selectedIds, setSelectedIds] = useState<string[]>([]);\n  const [networksOpen, setNetworksOpen] = useState(false);\n')

# Strongly type checks and group them by the block that can solve the issue.
s = s.replace('  const checks = selectedOptions.map(option => {', '  const checks: ComposerCheck[] = selectedOptions.map(option => {')
needle = '  const canSubmit = selectedOptions.length > 0 && (!requiresDescription || !!base.trim()) && !checks.some(check => check.level === "error");\n'
replacement = '''  const actionableChecks = checks.filter(check => check.level !== "ok");
  const whereChecks = actionableChecks.filter(check => check.text === "Conta precisa ser reconectada");
  const scheduleChecks = actionableChecks.filter(check => check.text.startsWith("Escolha um horário"));
  const descriptionChecks = actionableChecks.filter(check =>
    check.text.includes("descrição") || check.text.includes("título")
  );
  const mediaChecks = actionableChecks.filter(check =>
    !whereChecks.includes(check) && !scheduleChecks.includes(check) && !descriptionChecks.includes(check)
  );

  const canSubmit = selectedOptions.length > 0 && (!requiresDescription || !!base.trim()) && !checks.some(check => check.level === "error");
'''
if needle not in s:
    raise SystemExit('canSubmit marker not found')
s = s.replace(needle, replacement)

# Types / reusable contextual warning list.
type_marker = '''interface PublishAttemptResult {
  postTargetId?: string;
  provider: string;
  contentIntent?: string;
  surface?: string | null;
  outcome: string;
  errorMessage?: string | null;
  publicUrl?: string | null;
}
'''
type_replacement = type_marker + '''\ninterface ComposerCheck {
  option: DestinationOption;
  level: "error" | "warning" | "ok";
  text: string;
}
'''
if 'interface ComposerCheck' not in s:
    s = s.replace(type_marker, type_replacement)

component_marker = '''function resultPresentation(outcome: string) {
  if (outcome === "SUCCEEDED") return { text: "Publicado", className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (["TRANSIENT_FAILURE", "RATE_LIMIT", "UNKNOWN"].includes(outcome)) {
    return { text: "Aguardando nova tentativa", className: "border-amber-200 bg-amber-50 text-amber-800" };
  }
  if (outcome === "AUTH_REQUIRED") return { text: "Reconexão necessária", className: "border-red-200 bg-red-50 text-red-800" };
  return { text: "Falhou", className: "border-red-200 bg-red-50 text-red-800" };
}
'''
context_component = component_marker + '''\nfunction ContextualChecks({ checks, onSelect }: { checks: ComposerCheck[]; onSelect?: (check: ComposerCheck) => void }) {
  if (!checks.length) return null;
  return <div className="mt-4 space-y-2">
    {checks.map(check => <button
      key={`${check.option.id}:${check.text}`}
      type="button"
      onClick={() => onSelect?.(check)}
      className={`flex w-full min-w-0 items-center gap-3 rounded-xl border p-3 text-left ${check.level === "error" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}
    >
      <PlatformIcon platform={check.option.platform} small/>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-black text-slate-900">{check.option.label}</span>
        <span className={`mt-0.5 block text-xs leading-5 ${check.level === "error" ? "text-red-700" : "text-amber-700"}`}>{check.text}</span>
      </span>
      <CircleAlert size={16} className={`shrink-0 ${check.level === "error" ? "text-red-600" : "text-amber-600"}`}/>
    </button>)}
  </div>;
}
'''
if 'function ContextualChecks' not in s:
    if component_marker not in s:
        raise SystemExit('resultPresentation marker not found')
    s = s.replace(component_marker, context_component)

# Locate current main-column sections and rebuild their order.
body_marker = '      <div className="min-w-0 space-y-4">\n'
body_start = s.index(body_marker) + len(body_marker)
aside_start = s.index('      <aside className="min-w-0 space-y-4 xl:sticky', body_start)
body = s[body_start:aside_start]

def section_start(title: str):
    pos = body.index(title)
    return body.rfind('        <section', 0, pos)

media_start = section_start('1. Mídia')
desc_start = section_start('2. Descrição')
where_start = section_start('3. Onde publicar?')
when_start = section_start('4. Quando publicar?')
verify_start = section_start('5. Verificação')

media = body[media_start:desc_start]
desc = body[desc_start:where_start]
where = body[where_start:when_start]
when = body[when_start:verify_start]
# Verification runs until the closing section immediately before the main-column div closes.
verify_tail = body[verify_start:]
last_section_close = verify_tail.find('        </section>')
if last_section_close < 0:
    raise SystemExit('verification end not found')
suffix = verify_tail[last_section_close + len('        </section>'):]
prefix = body[:media_start]

# Renumber sections.
where = where.replace('3. Onde publicar?', '1. Onde publicar?', 1)
media = media.replace('1. Mídia', '2. Mídia', 1)
desc = desc.replace('2. Descrição', '3. Descrição', 1)

# Rebuild Onde publicar header: destination chooser is compact, format stays visible.
old_header = '''          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-950 sm:text-sm">1. Onde publicar?</h2>
              <p className="mt-1 text-sm text-slate-500 sm:text-xs">{tenant.source === "supabase" ? "Cada conta conectada é um destino independente." : "Modo demonstração: escolha as redes para simular o fluxo."}</p>
            </div>
            {!!shortOptions.length && <button onClick={() => {
              const shortIds = shortOptions.map(option => option.id);
              const allShortSelected = shortIds.every(id => selectedIds.includes(id));
              setSelectedIds(current => allShortSelected
                ? current.filter(id => !shortIds.includes(id))
                : Array.from(new Set([...current, ...shortIds])));
            }} className="shrink-0 text-sm font-bold text-indigo-600 sm:text-xs">
              {shortOptions.every(option => selectedIds.includes(option.id)) ? "Limpar sociais" : "Selecionar todos"}
            </button>}
          </div>
'''
new_header = '''          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-950 sm:text-sm">1. Onde publicar?</h2>
            <p className="mt-1 text-sm text-slate-500 sm:text-xs">Escolha primeiro os destinos. O Tela Social adapta as próximas etapas ao que você selecionar.</p>
          </div>
'''
if old_header not in where:
    raise SystemExit('where header not found')
where = where.replace(old_header, new_header, 1)

network_start_marker = '          {tenant.source === "supabase" && !destinationOptions.length ?'
format_marker = '          {hasInstagram && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">'
ns = where.index(network_start_marker)
fs = where.index(format_marker)
network_content = where[ns:fs]
selector_button = '''              {!!shortOptions.length && <button type="button" onClick={() => {
                const shortIds = shortOptions.map(option => option.id);
                const allShortSelected = shortIds.every(id => selectedIds.includes(id));
                setSelectedIds(current => allShortSelected
                  ? current.filter(id => !shortIds.includes(id))
                  : Array.from(new Set([...current, ...shortIds])));
              }} className="mb-3 text-sm font-bold text-blue-700 sm:text-xs">
                {shortOptions.every(option => selectedIds.includes(option.id)) ? "Limpar seleção" : "Selecionar todos"}
              </button>}
'''
network_shell = '''          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button type="button" onClick={() => setNetworksOpen(current => !current)} aria-expanded={networksOpen} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
              <span className="min-w-0">
                <span className="block text-sm font-black text-slate-900">Redes conectadas</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{selectedOptions.length ? `${selectedOptions.length} destino${selectedOptions.length === 1 ? " selecionado" : "s selecionados"}` : "Toque para escolher onde publicar"}</span>
              </span>
              <ChevronDown size={18} className={`shrink-0 text-blue-600 transition-transform ${networksOpen ? "rotate-180" : ""}`}/>
            </button>
            {networksOpen && <div className="border-t border-slate-200 p-3 sm:p-4">
''' + selector_button + network_content.replace('Conteúdo curto / social', 'Redes conectadas') + '''            </div>}
          </div>

'''
where = where[:ns] + network_shell + where[fs:]

# Add contextual network issues after format selector, before section close.
where_close = where.rfind('        </section>')
where = where[:where_close] + '''          <ContextualChecks checks={whereChecks} onSelect={check => { setNetworksOpen(true); setActiveId(check.option.id); }}/>
''' + where[where_close:]

# Add contextual issues to the exact blocks that can resolve them.
media_close = media.rfind('        </section>')
media = media[:media_close] + '''          <ContextualChecks checks={mediaChecks} onSelect={check => setActiveId(check.option.id)}/>
''' + media[media_close:]

desc_close = desc.rfind('        </section>')
desc = desc[:desc_close] + '''          <ContextualChecks checks={descriptionChecks} onSelect={check => { setCustomize(true); setActiveId(check.option.id); }}/>
''' + desc[desc_close:]

when_close = when.rfind('        </section>')
when = when[:when_close] + '''          <ContextualChecks checks={scheduleChecks} onSelect={check => setActiveId(check.option.id)}/>
''' + when[when_close:]

new_body = prefix + where + media + desc + when + suffix
s = s[:body_start] + new_body + s[aside_start:]

# Update top-level helper copy to match the new sequence.
s = s.replace('"Mídia, descrição, destinos e horário em um único fluxo."', '"Destinos, mídia, descrição e horário em um único fluxo."')

p.write_text(s)
