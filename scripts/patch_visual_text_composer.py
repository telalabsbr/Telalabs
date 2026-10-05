from pathlib import Path

path = Path("src/components/video-cover-editor.tsx")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str):
    global text
    if old not in text:
        raise SystemExit(f"trecho não encontrado: {label}")
    text = text.replace(old, new, 1)


replace_once(
    '  const exportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);\n  const captureToken = useRef(0);',
    '  const exportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);\n  const captureToken = useRef(0);\n  const onChangeRef = useRef(onChange);',
    "callback ref",
)

replace_once(
    '''  useEffect(() => () => {
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    if (exportTimer.current) clearTimeout(exportTimer.current);
  }, []);
''',
    '''  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => () => {
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    if (exportTimer.current) clearTimeout(exportTimer.current);
  }, []);
''',
    "callback effect",
)

replace_once(
    '      onChange({ mode: "auto", file: null, previewUrl: null, aspect });',
    '      onChangeRef.current({ mode: "auto", file: null, previewUrl: null, aspect });',
    "auto callback",
)
replace_once('  }, [mode, aspect, onChange]);', '  }, [mode, aspect]);', "auto deps")
replace_once(
    '            onChange({ mode, file, previewUrl, aspect });',
    '            onChangeRef.current({ mode, file, previewUrl, aspect });',
    "export callback",
)
replace_once(
    '  }, [mode, sourceUrl, sourceSize, aspect, zoom, panX, panY, textOverlay, sourceName, onChange]);',
    '  }, [mode, sourceUrl, sourceSize, aspect, zoom, panX, panY, textOverlay, sourceName]);',
    "export deps",
)

path.write_text(text, encoding="utf-8")
print("video-cover-editor.tsx estabilizado")
