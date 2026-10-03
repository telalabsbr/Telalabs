"use client";

const FFMPEG_CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
const MAX_TRANSCODE_INPUT_BYTES = 350 * 1024 * 1024;
const MAX_AUDIO_INPUT_BYTES = 150 * 1024 * 1024;
const INSTAGRAM_MIN_REEL_DURATION_MS = 3_000;
const GIF_SAFE_MIN_DURATION_MS = 3_200;

export type TranscodeProgress = {
  progress: number;
  message: string;
};

function safeBaseName(name: string) {
  const base = name.replace(/\.[^.]+$/, "").trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
  return base.slice(0, 90) || "midia";
}

async function canvasToPng(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("audio_cover_failed");
  return blob;
}

async function createAudioCover(filename: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1280;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("audio_cover_failed");

  const gradient = context.createLinearGradient(0, 0, 720, 1280);
  gradient.addColorStop(0, "#111827");
  gradient.addColorStop(0.55, "#312e81");
  gradient.addColorStop(1, "#111827");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 720, 1280);

  context.fillStyle = "rgba(255,255,255,0.10)";
  context.beginPath();
  context.arc(360, 470, 180, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = "700 68px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("ÁUDIO", 360, 490);

  const cleanName = filename.replace(/\.[^.]+$/, "").trim() || "Áudio";
  context.font = "600 34px Arial, sans-serif";
  const words = cleanName.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width > 600 && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  lines.slice(0, 3).forEach((line, index) => context.fillText(line, 360, 760 + index * 48));

  context.font = "500 24px Arial, sans-serif";
  context.fillStyle = "rgba(255,255,255,0.75)";
  context.fillText("Preparado pelo Tela Social", 360, 1110);

  return canvasToPng(canvas);
}

/**
 * Lê os Graphics Control Extensions do GIF para estimar a duração de um ciclo.
 * Cada delay é armazenado em centésimos de segundo. Se não conseguirmos ler
 * com segurança, retornamos null e deixamos o FFmpeg fazer a conversão normal.
 */
async function gifCycleDurationMs(file: File): Promise<number | null> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length < 13) return null;
    const signature = String.fromCharCode(...bytes.slice(0, 6));
    if (signature !== "GIF87a" && signature !== "GIF89a") return null;

    let totalHundredths = 0;
    for (let i = 0; i + 7 < bytes.length; i += 1) {
      // Graphic Control Extension: 21 F9 04 [packed] [delay lo] [delay hi] ...
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) {
        const delayHundredths = bytes[i + 4] | (bytes[i + 5] << 8);
        // Browsers commonly clamp zero/very-small frame delays. Use 2 cs as a
        // practical floor so our estimate does not end up shorter than playback.
        totalHundredths += Math.max(2, delayHundredths);
        i += 7;
      }
    }

    return totalHundredths > 0 ? totalHundredths * 10 : null;
  } catch {
    return null;
  }
}

async function runFFmpeg(args: {
  file: File;
  mode: "gif" | "video" | "audio";
  onProgress?: (progress: TranscodeProgress) => void;
}) {
  if (args.file.size > MAX_TRANSCODE_INPUT_BYTES) {
    throw new Error("media_conversion_too_large");
  }
  if (args.mode === "audio" && args.file.size > MAX_AUDIO_INPUT_BYTES) {
    throw new Error("audio_conversion_too_large");
  }

  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util"),
  ]);

  const ffmpeg = new FFmpeg();
  const inputExt = args.file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() || "bin";
  const inputName = `input.${inputExt}`;
  const outputName = `${safeBaseName(args.file.name)}.mp4`;
  const coverName = "tela-audio-cover.png";

  const progressHandler = ({ progress }: { progress: number }) => {
    const bounded = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
    args.onProgress?.({
      progress: Math.round(bounded * 100),
      message: args.mode === "audio" ? "Criando vídeo a partir do áudio..." : "Convertendo mídia para MP4...",
    });
  };

  ffmpeg.on("progress", progressHandler);

  try {
    args.onProgress?.({ progress: 1, message: "Carregando conversor de mídia..." });
    await ffmpeg.load({
      coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });

    await ffmpeg.writeFile(inputName, await fetchFile(args.file));

    let command: string[];
    if (args.mode === "gif") {
      const cycleDurationMs = await gifCycleDurationMs(args.file);
      const needsMinimumDuration = cycleDurationMs !== null && cycleDurationMs < INSTAGRAM_MIN_REEL_DURATION_MS;
      const repeatCount = needsMinimumDuration
        ? Math.max(1, Math.ceil(GIF_SAFE_MIN_DURATION_MS / cycleDurationMs) - 1)
        : 0;

      const inputArgs = repeatCount > 0
        ? ["-stream_loop", String(repeatCount), "-i", inputName]
        : ["-i", inputName];
      const durationArgs = repeatCount > 0
        ? ["-t", (GIF_SAFE_MIN_DURATION_MS / 1000).toFixed(1)]
        : [];

      command = [
        ...inputArgs,
        "-vf", "scale='min(1920,iw)':-2,pad=ceil(iw/2)*2:ceil(ih/2)*2",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        ...durationArgs,
        "-movflags", "+faststart",
        "-an",
        outputName,
      ];
    } else if (args.mode === "audio") {
      const cover = await createAudioCover(args.file.name);
      await ffmpeg.writeFile(coverName, await fetchFile(cover));
      command = [
        "-loop", "1",
        "-framerate", "10",
        "-i", coverName,
        "-i", inputName,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", "160k",
        "-pix_fmt", "yuv420p",
        "-r", "10",
        "-shortest",
        "-movflags", "+faststart",
        outputName,
      ];
    } else {
      command = [
        "-i", inputName,
        "-vf", "scale='min(1920,iw)':-2,pad=ceil(iw/2)*2:ceil(ih/2)*2",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "160k",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        outputName,
      ];
    }

    args.onProgress?.({ progress: 3, message: args.mode === "audio" ? "Criando vídeo a partir do áudio..." : "Convertendo mídia para MP4..." });
    const exitCode = await ffmpeg.exec(command);
    if (exitCode !== 0) throw new Error("media_conversion_failed");

    const output = await ffmpeg.readFile(outputName);
    if (typeof output === "string") throw new Error("media_conversion_failed");
    const bytes = new Uint8Array(output);
    if (!bytes.byteLength) throw new Error("media_conversion_failed");

    args.onProgress?.({ progress: 100, message: "Conversão concluída." });
    return new File([bytes.buffer as ArrayBuffer], outputName, {
      type: "video/mp4",
      lastModified: args.file.lastModified,
    });
  } catch (error) {
    if (error instanceof Error && [
      "media_conversion_too_large",
      "audio_conversion_too_large",
      "audio_cover_failed",
      "media_conversion_failed",
    ].includes(error.message)) {
      throw error;
    }
    throw new Error("media_conversion_failed");
  } finally {
    ffmpeg.off("progress", progressHandler);
    ffmpeg.terminate();
  }
}

export function transcodeGifToMp4(file: File, onProgress?: (progress: TranscodeProgress) => void) {
  return runFFmpeg({ file, mode: "gif", onProgress });
}

export function transcodeVideoToMp4(file: File, onProgress?: (progress: TranscodeProgress) => void) {
  return runFFmpeg({ file, mode: "video", onProgress });
}

export function transcodeAudioToMp4(file: File, onProgress?: (progress: TranscodeProgress) => void) {
  return runFFmpeg({ file, mode: "audio", onProgress });
}
