from pathlib import Path

path = Path("src/app/(app)/calendario/page.tsx")
text = path.read_text(encoding="utf-8")

def r(old: str, new: str):
    global text
    if old not in text:
        raise SystemExit("Trecho nao encontrado:\n" + old[:400])
    text = text.replace(old, new, 1)

r(
'''  Edit3,
  MoreHorizontal,''',
'''  Edit3,
  ExternalLink,
  MoreHorizontal,'''
)

r(
'''function isAuthError(publication: Publication) {''',
'''function destinationLabel(destination: Publication["destinations"][number]) {
  if (destination.platform === "instagram" && destination.surface === "story") return "Instagram Story";
  if (destination.platform === "instagram" && destination.surface === "reel") return "Instagram Reel";
  return platformLabels[destination.platform];
}

function isAuthError(publication: Publication) {'''
)

r(
'''            <p className="truncate text-sm font-bold text-slate-900">{platformLabels[destination.platform]}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{destination.lastError ?? (destination.scheduledAt ? new Date(destination.scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Sem horário")}</p>
          </div>
          <StatusBadge status={destination.status}/>
        </div>)}''',
'''            <p className="truncate text-sm font-bold text-slate-900">{destinationLabel(destination)}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{destination.lastError ?? (destination.scheduledAt ? new Date(destination.scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Sem horário")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {destination.externalUrl && <a href={destination.externalUrl} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-indigo-600 hover:bg-indigo-50" title="Ver publicação na rede"><ExternalLink size={14}/></a>}
            <StatusBadge status={destination.status}/>
          </div>
        </div>)}'''
)

r(
'''    <div className="grid grid-cols-2 gap-2">
      <Link href={"/publicacoes/nova?edit=" + selected.id} className="btn-secondary"><Edit3 size={15}/> Editar</Link>''',
'''    <div className="grid grid-cols-2 gap-2">
      {selected.destinations.some(destination => destination.externalUrl) && <a href={selected.destinations.find(destination => destination.externalUrl)?.externalUrl} target="_blank" rel="noreferrer" className="btn-primary col-span-2"><ExternalLink size={15}/> Ver publicação</a>}
      <Link href={"/publicacoes/nova?edit=" + selected.id} className="btn-secondary"><Edit3 size={15}/> Editar</Link>'''
)

path.write_text(text, encoding="utf-8")
print("Calendar links patch applied")
# trigger
