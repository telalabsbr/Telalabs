from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'{label}: trecho não encontrado em {path}')
    p.write_text(s.replace(old, new, 1))

# --- publication-editor.tsx ---
p = Path('src/components/publication-editor.tsx')
s = p.read_text()

s = s.replace(
'''            <div className="mt-3 grid gap-2 sm:grid-cols-3">
''',
'''            <div className="mt-3 grid grid-cols-3 gap-2">
''',
1,
)
s = s.replace(
'''              ]).map(item => <button key={item.value} type="button" onClick={() => { setInstagramPlacement(item.value); setSaveMessage(""); }} aria-pressed={instagramPlacement === item.value} className={`rounded-xl border px-3 py-3 text-left transition-colors ${instagramPlacement === item.value ? "border-blue-500 bg-blue-600 shadow-sm" : "border-blue-100 bg-white hover:border-blue-200 hover:bg-blue-50"}`}>
                <span className={`block text-sm font-black ${instagramPlacement === item.value ? "text-white" : "text-slate-800"}`}>{item.label}</span>
                <span className={`mt-0.5 block text-xs ${instagramPlacement === item.value ? "text-blue-100" : "text-slate-500"}`}>{item.detail}</span>
              </button>)}
''',
'''              ]).map(item => <button key={item.value} type="button" onClick={() => { setInstagramPlacement(item.value); setSaveMessage(""); }} aria-pressed={instagramPlacement === item.value} className={`min-w-0 rounded-xl border px-2 py-2.5 text-center transition-colors sm:px-3 sm:py-3 sm:text-left ${instagramPlacement === item.value ? "border-blue-500 bg-blue-600 shadow-sm" : "border-blue-100 bg-white hover:border-blue-200 hover:bg-blue-50"}`}>
                <span className={`block truncate text-xs font-black sm:text-sm ${instagramPlacement === item.value ? "text-white" : "text-slate-800"}`}>{item.label}</span>
                <span className={`mt-0.5 hidden text-xs sm:block ${instagramPlacement === item.value ? "text-blue-100" : "text-slate-500"}`}>{item.detail}</span>
              </button>)}
''',
1,
)

carousel_button = '''                <label className="btn-secondary cursor-pointer"><ImagePlus size={15}/> Carrossel<input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp" className="sr-only" onChange={event => void handleCarouselFiles(event.target.files)}/></label>\n'''
if carousel_button not in s:
    raise SystemExit('botão carrossel pós-seleção não encontrado')
s = s.replace(carousel_button, '', 1)
s = s.replace('><Trash2 size={15}/> Cancelar substituição</button>}', '><Trash2 size={15}/> Cancelar</button>}', 1)
s = s.replace('Depois de concluir todos os destinos', 'Depois de concluir todos os envios', 1)

# Allow vertical page gestures over final preview and description fields.
s = s.replace('className="field min-h-36 resize-y p-4 text-base sm:text-sm"', 'className="field min-h-36 touch-pan-y resize-y p-4 text-base sm:text-sm"')

p.write_text(s)

# --- media-text-editor.tsx ---
p = Path('src/components/media-text-editor.tsx')
s = p.read_text()
s = s.replace(
'''  const [currentMs, setCurrentMs] = useState(0);\n''',
'''  const [currentMs, setCurrentMs] = useState(0);\n  const [positionEditing, setPositionEditing] = useState(false);\n''',
1,
)
s = s.replace(
'''      className="relative mx-auto w-full max-w-[360px] touch-none overflow-hidden rounded-xl bg-black shadow-sm"\n''',
'''      className={`relative mx-auto w-full max-w-[360px] overflow-hidden rounded-xl bg-black shadow-sm ${positionEditing ? "touch-none" : "touch-pan-y"}`}\n''',
1,
)
s = s.replace(
'''            className="h-full w-full object-contain"\n''',
'''            className="h-full w-full touch-pan-y object-contain"\n''',
1,
)
s = s.replace(
'''        : <img src={sourceUrl} alt="Prévia com texto" className="h-full w-full object-contain"/>}\n''',
'''        : <img src={sourceUrl} alt="Prévia com texto" className="h-full w-full touch-pan-y object-contain"/>}\n''',
1,
)
s = s.replace(
'''        visible={kind !== "video" || overlayVisibleAt(config, currentMs, durationMs)}\n      />\n''',
'''        visible={kind !== "video" || overlayVisibleAt(config, currentMs, durationMs)}\n        interactive={positionEditing}\n      />\n''',
1,
)
marker = '''      <div className="pointer-events-none absolute inset-x-[6%] inset-y-[4%] rounded-lg border border-dashed border-white/35"/>\n    </div>\n\n    <TextOverlayControls config={config} onChange={update} compact/>\n'''
replacement = '''      <div className="pointer-events-none absolute inset-x-[6%] inset-y-[4%] rounded-lg border border-dashed border-white/35"/>\n    </div>\n\n    <div className="flex justify-center">\n      <button\n        type="button"\n        onClick={() => setPositionEditing(current => !current)}\n        className={`rounded-lg border px-3 py-2 text-xs font-black ${positionEditing ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}\n      >\n        {positionEditing ? "Concluir ajuste" : "Ajustar texto na mídia"}\n      </button>\n    </div>\n    <p className="text-center text-[11px] leading-4 text-slate-500">{positionEditing ? "Enquanto ajusta, arraste o texto e use o canto para redimensionar." : "A mídia está bloqueada para edição por toque; você pode rolar a página normalmente sobre ela."}</p>\n\n    <TextOverlayControls config={config} onChange={update} compact/>\n'''
if marker not in s:
    raise SystemExit('marcador editor mídia não encontrado')
s = s.replace(marker, replacement, 1)
p.write_text(s)

# --- video-cover-editor.tsx ---
p = Path('src/components/video-cover-editor.tsx')
s = p.read_text()
s = s.replace(
'''  const [textOverlay, setTextOverlay] = useState<TextOverlayConfig>({ ...defaultTextOverlay });\n''',
'''  const [textOverlay, setTextOverlay] = useState<TextOverlayConfig>({ ...defaultTextOverlay });\n  const [coverEditing, setCoverEditing] = useState(false);\n''',
1,
)
s = s.replace(
'''  function onTouchStart(event: React.TouchEvent<HTMLDivElement>) {\n    if (event.touches.length === 2) {\n''',
'''  function onTouchStart(event: React.TouchEvent<HTMLDivElement>) {\n    if (!coverEditing) return;\n    if (event.touches.length === 2) {\n''',
1,
)
s = s.replace(
'''  function onTouchMove(event: React.TouchEvent<HTMLDivElement>) {\n    if (event.touches.length === 2 && pinchRef.current) {\n''',
'''  function onTouchMove(event: React.TouchEvent<HTMLDivElement>) {\n    if (!coverEditing) return;\n    if (event.touches.length === 2 && pinchRef.current) {\n''',
1,
)
s = s.replace(
'''          className="relative w-full max-w-[360px] touch-none overflow-hidden rounded-xl bg-black shadow-inner"\n''',
'''          className={`relative w-full max-w-[360px] overflow-hidden rounded-xl bg-black shadow-inner ${coverEditing ? "touch-none" : "touch-pan-y"}`}\n''',
1,
)
s = s.replace(
'''          <TextOverlayLayer config={textOverlay} onChange={setTextOverlay} visible={!!sourceUrl}/>\n''',
'''          <TextOverlayLayer config={textOverlay} onChange={setTextOverlay} visible={!!sourceUrl} interactive={coverEditing}/>\n''',
1,
)
marker = '''      <div className="mt-3 flex items-center justify-center gap-2">\n        <button type="button" onClick={() => setZoom(current => clamp(current - 0.1, 1, 4))} className="btn-secondary !px-3"><Minus size={15}/></button>\n'''
replacement = '''      <div className="mt-3 flex justify-center">\n        <button\n          type="button"\n          onClick={() => { endGesture(); setCoverEditing(current => !current); }}\n          className={`rounded-lg border px-3 py-2 text-xs font-black ${coverEditing ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}\n        >\n          {coverEditing ? "Concluir ajuste" : "Ajustar enquadramento e texto"}\n        </button>\n      </div>\n      <p className="mt-2 text-center text-[11px] leading-4 text-slate-500">{coverEditing ? "Modo de ajuste ativo: arraste a capa ou o texto." : "A capa está bloqueada para toque; deslize sobre ela para rolar a página."}</p>\n\n      <div className="mt-3 flex items-center justify-center gap-2">\n        <button type="button" onClick={() => setZoom(current => clamp(current - 0.1, 1, 4))} className="btn-secondary !px-3"><Minus size={15}/></button>\n'''
if marker not in s:
    raise SystemExit('marcador zoom capa não encontrado')
s = s.replace(marker, replacement, 1)
p.write_text(s)

# --- text-overlay-controls.tsx ---
p = Path('src/components/text-overlay-controls.tsx')
s = p.read_text()
s = s.replace(
'''      className="field min-h-20 resize-y p-3 text-base sm:text-sm"\n''',
'''      className="field min-h-20 touch-pan-y resize-y p-3 text-base sm:text-sm"\n''',
1,
)
p.write_text(s)

# --- publication-media-preview.tsx ---
p = Path('src/components/publication-media-preview.tsx')
s = p.read_text()
s = s.replace(
'''  return <div data-overlay-stage className="relative h-full w-full overflow-hidden">\n''',
'''  return <div data-overlay-stage className="relative h-full w-full touch-pan-y overflow-hidden">\n''',
1,
)
s = s.replace('className="h-full w-full object-cover"', 'className="h-full w-full touch-pan-y object-cover"')
p.write_text(s)
