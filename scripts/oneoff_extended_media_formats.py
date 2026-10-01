from pathlib import Path

path = Path("src/components/publication-editor.tsx")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit("Trecho esperado nao encontrado:\n" + old[:260])
    text = text.replace(old, new, 1)


replace_once(
    '      const prepared = await prepareMediaFile(file);',
    '''      const prepared = await prepareMediaFile(file, {
        onProgress: progress => {
          const suffix = progress.progress > 0 && progress.progress < 100 ? ` ${progress.progress}%` : "";
          setSaveMessage(`${progress.message}${suffix}`);
        },
      });''',
)

replace_once(
    '''        animated_gif_requires_video_conversion: "GIF animado ainda precisa ser convertido para vídeo MP4 antes da publicação.",
        audio_requires_visual: "Áudio sozinho ainda não pode ser publicado. Na próxima etapa o Tela poderá gerar um vídeo com capa para MP3/WAV.",
        video_format_requires_conversion: "Este formato de vídeo ainda precisa ser convertido para MP4 ou MOV.",
        image_format_requires_conversion: "Este formato de imagem ainda não pode ser convertido automaticamente.",''',
    '''        media_conversion_too_large: "Este arquivo é grande demais para conversão automática no navegador. Arquivos que já estejam em MP4 continuam aceitos normalmente.",
        audio_conversion_too_large: "Este áudio é grande demais para ser transformado automaticamente em vídeo neste navegador.",
        media_conversion_failed: "Não foi possível converter esta mídia para MP4. Tente outro arquivo ou um MP4 já pronto.",
        audio_cover_failed: "Não foi possível gerar a capa automática para este áudio.",
        image_format_requires_conversion: "Este formato de imagem ainda não pode ser convertido automaticamente.",''',
)

old_accept = '.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,.mp4,.mov,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp,video/mp4,video/quicktime'
new_accept = '.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.bmp,.gif,.mp4,.mov,.webm,.avi,.mkv,.mpeg,.mpg,.m4v,.3gp,.ogv,.mp3,.wav,.m4a,.aac,.ogg,.flac,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp,image/gif,video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,video/mpeg,video/x-m4v,video/3gpp,video/ogg,audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,audio/flac'
if old_accept not in text:
    raise SystemExit("Lista accept esperada nao encontrada")
text = text.replace(old_accept, new_accept)

text = text.replace(
    '<span className="mt-2 text-base font-bold text-slate-900 sm:text-sm">Adicionar imagem ou vídeo</span>\n              <span className="mt-1 text-sm text-slate-500 sm:text-xs">Clique para selecionar</span>',
    '<span className="mt-2 text-base font-bold text-slate-900 sm:text-sm">Adicionar mídia</span>\n              <span className="mt-1 text-sm text-slate-500 sm:text-xs">Imagem, vídeo, GIF ou áudio · o Tela adapta quando necessário</span>',
)

path.write_text(text, encoding="utf-8")
print("Formatos estendidos aplicados ao composer.")
