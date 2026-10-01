from pathlib import Path

path = Path("scripts/patch_composer_ux.py")
text = path.read_text(encoding="utf-8")
old = '''# Preview heading button: locate header
r(
''' + "'''" + '''            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Prévia</p>
                <h2 className="mt-1 text-base font-black text-slate-950">Como pode aparecer</h2>
              </div>
            </div>''' + "'''" + ''',
''' + "'''" + '''            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Prévia</p>
                <h2 className="mt-1 text-base font-black text-slate-950">Como pode aparecer</h2>
              </div>
              <button type="button" onClick={() => setPreviewOpen(true)} className="btn-secondary !px-3"><Eye size={15}/> Visualizar</button>
            </div>''' + "'''" + '''
)'''
new = '''# Preview heading button
r(
''' + "'''" + '''          <div className="border-b border-slate-200 p-4">
            <p className="font-bold text-slate-950">Prévia da publicação</p>
            <p className="mt-1 text-sm leading-5 text-slate-500 sm:text-xs">Simulação aproximada por rede. A interface oficial pode mudar.</p>
          </div>''' + "'''" + ''',
''' + "'''" + '''          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div>
              <p className="font-bold text-slate-950">Prévia da publicação</p>
              <p className="mt-1 text-sm leading-5 text-slate-500 sm:text-xs">Simulação aproximada por rede. A interface oficial pode mudar.</p>
            </div>
            <button type="button" onClick={() => setPreviewOpen(true)} className="btn-secondary !px-3"><Eye size={15}/> Visualizar</button>
          </div>''' + "'''" + '''
)'''
if old not in text:
    raise SystemExit("old preview patch block not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("composer patch script fixed")
