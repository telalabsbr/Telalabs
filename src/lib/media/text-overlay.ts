"use client";

import { mediaAspectSizes, type MediaAspect } from "./image-transform";

const FFMPEG_CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
const MAX_VIDEO_OVERLAY_BYTES = 350 * 1024 * 1024;
const TEXT_ENGINE_LOAD_TIMEOUT_MS = 45_000;
const TEXT_RENDER_TIMEOUT_MS = 180_000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  code: string,
  onTimeout?: () => void,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          try { onTimeout?.(); } catch { /* ignore */ }
          reject(new Error(code));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type OverlayFont = "clean" | "classic" | "modern" | "strong" | "mono" | "hand";
export type OverlayBackground = "none" | "dark" | "light" | "color";
export type OverlayTimingMode = "all" | "range";
export type TextOverlayEdge = "both" | "start" | "end";

export type TextOverlayConfig = {
  text: string;
  font: OverlayFont;
  size: number;
  color: string;
  background: OverlayBackground;
  backgroundColor: string;
  x: number;
  y: number;
  boxWidth: number;
  timingMode: OverlayTimingMode;
  startMs: number;
  endMs: number | null;
};

export const defaultTextOverlay: TextOverlayConfig = {
  text: "",
  font: "clean",
  size: 0.075,
  color: "#ffffff",
  background: "none",
  backgroundColor: "#0047ab",
  x: 0.5,
  y: 0.5,
  boxWidth: 0.72,
  timingMode: "all",
  startMs: 0,
  endMs: null,
};

export const overlayFontLabels: Record<OverlayFont, string> = {
  clean: "Limpa",
  classic: "Clássica",
  modern: "Moderna",
  strong: "Forte",
  mono: "Máquina",
  hand: "Manual",
};

export const overlayFontFamilies: Record<OverlayFont, string> = {
  clean: 'Arial, "Helvetica Neue", sans-serif',
  classic: 'Georgia, "Times New Roman", serif',
  modern: '"Trebuchet MS", Arial, sans-serif',
  strong: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
  mono: '"Courier New", monospace',
  hand: '"Comic Sans MS", "Segoe Print", cursive',
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function colorWithAlpha(color: string, alpha: number) {
  const normalized = color.trim();
  const short = normalized.match(/^#([0-9a-f]{3})$/i);
  const full = normalized.match(/^#([0-9a-f]{6})$/i);
  const hex = full?.[1] ?? (short ? short[1].split("").map(char => char + char).join("") : null);
  if (!hex) return normalized;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const manual = text.split(/\n/);
  const result: string[] = [];

  for (const paragraph of manual) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      result.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (context.measureText(candidate).width > maxWidth && current) {
        result.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) result.push(current);
  }

  return result.slice(0, 12);
}

export function normalizeTextOverlay(config: TextOverlayConfig, durationMs?: number | null): TextOverlayConfig {
  const duration = Math.max(0, durationMs ?? 0);
  const startMs = clamp(Number.isFinite(config.startMs) ? config.startMs : 0, 0, duration || Number.MAX_SAFE_INTEGER);
  const rawEnd = config.endMs == null ? duration || null : config.endMs;
  const endMs = rawEnd == null
    ? null
    : clamp(rawEnd, startMs, duration || rawEnd);

  return {
    ...config,
    size: clamp(config.size, 0.04, 0.2),
    x: clamp(config.x, 0.05, 0.95),
    y: clamp(config.y, 0.05, 0.95),
    boxWidth: clamp(config.boxWidth || 0.72, 0.2, 0.92),
    startMs,
    endMs,
  };
}

export function overlayVisibleAt(config: TextOverlayConfig, currentMs: number, durationMs?: number | null) {
  if (config.timingMode !== "range") return true;
  const normalized = normalizeTextOverlay(config, durationMs);
  const end = normalized.endMs ?? durationMs ?? Number.MAX_SAFE_INTEGER;
  return currentMs <= normalized.startMs || currentMs >= end;
}

export function overlayVisibleAtEdge(
  config: TextOverlayConfig,
  currentMs: number,
  durationMs: number | null | undefined,
  edge: TextOverlayEdge,
) {
  if (edge === "both" || config.timingMode !== "range") return overlayVisibleAt(config, currentMs, durationMs);
  const normalized = normalizeTextOverlay(config, durationMs);
  const end = normalized.endMs ?? durationMs ?? Number.MAX_SAFE_INTEGER;
  return edge === "start" ? currentMs <= normalized.startMs : currentMs >= end;
}

export function drawTextOverlay(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: TextOverlayConfig,
) {
  const text = config.text.trim();
  if (!text) return;

  const normalized = normalizeTextOverlay(config);
  const fontSize = clamp(Math.round(Math.min(width, height) * normalized.size), 28, Math.round(Math.min(width, height) * 0.22));
  const weight = normalized.font === "strong" ? 900 : 700;
  context.save();
  context.font = `${weight} ${fontSize}px ${overlayFontFamilies[normalized.font]}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";

  const maxTextWidth = width * normalized.boxWidth;
  const lines = wrapLines(context, text, maxTextWidth);
  const lineHeight = fontSize * 1.16;
  const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
  const centerX = normalized.x * width;
  const centerY = normalized.y * height;
  const widest = Math.max(...lines.map(line => context.measureText(line || " ").width), fontSize);
  const padX = fontSize * 0.34;
  const padY = fontSize * 0.24;

  if (normalized.background !== "none") {
    const selectedBackground = normalized.backgroundColor || "#0047ab";
    context.fillStyle = normalized.background === "light"
      ? colorWithAlpha(selectedBackground, 0.38)
      : selectedBackground;
    roundRect(
      context,
      centerX - widest / 2 - padX,
      centerY - totalHeight / 2 - padY,
      widest + padX * 2,
      totalHeight + padY * 2,
      fontSize * 0.28,
    );
    context.fill();
  }

  context.fillStyle = normalized.color;
  context.shadowColor = normalized.background === "none" ? "rgba(0,0,0,0.72)" : "transparent";
  context.shadowBlur = normalized.background === "none" ? Math.max(6, fontSize * 0.08) : 0;
  context.shadowOffsetY = normalized.background === "none" ? Math.max(2, fontSize * 0.035) : 0;

  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    context.fillText(line, centerX, startY + index * lineHeight, maxTextWidth);
  });
  context.restore();
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("text_overlay_export_failed")), type, quality);
  });
}

async function imageBitmapFromFile(file: File) {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("text_overlay_image_decode_failed"));
      element.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function composeTextOnImage(file: File, config: TextOverlayConfig) {
  const image = await imageBitmapFromFile(file);
  const width = "naturalWidth" in image ? image.naturalWidth : image.width;
  const height = "naturalHeight" in image ? image.naturalHeight : image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("text_overlay_canvas_failed");
  context.drawImage(image as CanvasImageSource, 0, 0, width, height);
  drawTextOverlay(context, width, height, config);

  if ("close" in image && typeof image.close === "function") image.close();

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await canvasBlob(canvas, outputType, outputType === "image/jpeg" ? 0.93 : undefined);
  const extension = outputType === "image/png" ? "png" : "jpg";
  const basename = file.name.replace(/\.[^.]+$/, "") || "midia";
  return new File([blob], `${basename}-texto.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
}

async function getVideoDimensions(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("text_overlay_video_decode_failed"));
    });
    return {
      width: video.videoWidth || 1080,
      height: video.videoHeight || 1920,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function createOverlayPng(width: number, height: number, config: TextOverlayConfig) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("text_overlay_canvas_failed");
  context.clearRect(0, 0, width, height);
  drawTextOverlay(context, width, height, config);
  return canvasBlob(canvas, "image/png");
}

export async function composeTextOnVideo(
  file: File,
  config: TextOverlayConfig,
  onProgress?: (progress: number, message: string) => void,
  aspect?: MediaAspect,
) {
  if (file.size > MAX_VIDEO_OVERLAY_BYTES) throw new Error("text_overlay_video_too_large");

  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util"),
  ]);

  const sourceDimensions = await getVideoDimensions(file);
  const dimensions = aspect ? mediaAspectSizes[aspect] : sourceDimensions;
  const overlayBlob = await createOverlayPng(dimensions.width, dimensions.height, config);
  const ffmpeg = new FFmpeg();
  const inputExt = file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() || "mp4";
  const inputName = `input.${inputExt}`;
  const overlayName = "text-overlay.png";
  const outputName = "midia-com-texto.mp4";

  const progressHandler = ({ progress }: { progress: number }) => {
    const bounded = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
    onProgress?.(Math.round(bounded * 100), "Aplicando texto ao vídeo...");
  };
  ffmpeg.on("progress", progressHandler);

  try {
    onProgress?.(1, "Carregando editor de vídeo...");
    await withTimeout(
      (async () => ffmpeg.load({
        coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      }))(),
      TEXT_ENGINE_LOAD_TIMEOUT_MS,
      "text_overlay_engine_timeout",
      () => {
        try { ffmpeg.terminate(); } catch { /* ignore */ }
      },
    );
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.writeFile(overlayName, await fetchFile(overlayBlob));

    const normalized = normalizeTextOverlay(config);
    const timing = normalized.timingMode === "range"
      ? `:enable='lte(t,${(normalized.startMs / 1000).toFixed(3)})+gte(t,${((normalized.endMs ?? normalized.startMs) / 1000).toFixed(3)})'`
      : "";

    let filterComplex = `[0:v][1:v]overlay=0:0:format=auto${timing}`;
    if (aspect) {
      const target = mediaAspectSizes[aspect];
      const targetRatio = target.width / target.height;
      filterComplex = `[0:v]scale='if(gt(iw/ih,${targetRatio}),-2,${target.width})':'if(gt(iw/ih,${targetRatio}),${target.height},-2)',crop=${target.width}:${target.height}[base];[base][1:v]overlay=0:0:format=auto${timing}`;
    }

    const exitCode = await withTimeout(
      ffmpeg.exec([
        "-i", inputName,
        "-i", overlayName,
        "-filter_complex", filterComplex,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "25",
        "-c:a", "aac",
        "-b:a", "160k",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        outputName,
      ]),
      TEXT_RENDER_TIMEOUT_MS,
      "text_overlay_video_timeout",
      () => {
        try { ffmpeg.terminate(); } catch { /* ignore */ }
      },
    );
    if (exitCode !== 0) throw new Error("text_overlay_video_failed");

    const output = await ffmpeg.readFile(outputName);
    if (typeof output === "string") throw new Error("text_overlay_video_failed");
    const bytes = new Uint8Array(output);
    if (!bytes.byteLength) throw new Error("text_overlay_video_failed");
    onProgress?.(100, "Texto aplicado.");
    return new File([bytes.buffer as ArrayBuffer], `${file.name.replace(/\.[^.]+$/, "") || "video"}-texto.mp4`, {
      type: "video/mp4",
      lastModified: Date.now(),
    });
  } catch (error) {
    if (error instanceof Error && [
      "text_overlay_video_too_large",
      "text_overlay_video_timeout",
      "text_overlay_engine_timeout",
    ].includes(error.message)) throw error;
    throw new Error("text_overlay_video_failed");
  } finally {
    ffmpeg.off("progress", progressHandler);
    try { ffmpeg.terminate(); } catch { /* ignore */ }
  }
}

export async function composeTimedTextLayersOnVideo(
  file: File,
  layers: Array<{ config: TextOverlayConfig; edge: Exclude<TextOverlayEdge, "both"> }>,
  onProgress?: (progress: number, message: string) => void,
  aspect?: MediaAspect,
) {
  const activeLayers = layers.filter(layer => layer.config.text.trim());
  if (!activeLayers.length) return file;
  if (file.size > MAX_VIDEO_OVERLAY_BYTES) throw new Error("text_overlay_video_too_large");

  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util"),
  ]);

  const sourceDimensions = await getVideoDimensions(file);
  const dimensions = aspect ? mediaAspectSizes[aspect] : sourceDimensions;
  const overlayBlobs = await Promise.all(activeLayers.map(layer => createOverlayPng(dimensions.width, dimensions.height, layer.config)));
  const ffmpeg = new FFmpeg();
  const inputExt = file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() || "mp4";
  const inputName = `input.${inputExt}`;
  const outputName = "midia-com-textos.mp4";

  const progressHandler = ({ progress }: { progress: number }) => {
    const bounded = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
    onProgress?.(Math.round(bounded * 100), "Aplicando textos ao vídeo...");
  };
  ffmpeg.on("progress", progressHandler);

  try {
    onProgress?.(1, "Carregando editor de vídeo...");
    await withTimeout(
      (async () => ffmpeg.load({
        coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      }))(),
      TEXT_ENGINE_LOAD_TIMEOUT_MS,
      "text_overlay_engine_timeout",
      () => {
        try { ffmpeg.terminate(); } catch { /* ignore */ }
      },
    );
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    for (let index = 0; index < overlayBlobs.length; index += 1) {
      await ffmpeg.writeFile(`text-overlay-${index}.png`, await fetchFile(overlayBlobs[index]));
    }

    const filters: string[] = [];
    if (aspect) {
      const target = mediaAspectSizes[aspect];
      const targetRatio = target.width / target.height;
      filters.push(`[0:v]scale='if(gt(iw/ih,${targetRatio}),-2,${target.width})':'if(gt(iw/ih,${targetRatio}),${target.height},-2)',crop=${target.width}:${target.height}[base0]`);
    } else {
      filters.push("[0:v]null[base0]");
    }

    let currentLabel = "base0";
    activeLayers.forEach((layer, index) => {
      const normalized = normalizeTextOverlay(layer.config);
      const endMs = normalized.endMs ?? normalized.startMs;
      const timing = layer.edge === "start"
        ? `:enable='lte(t,${(normalized.startMs / 1000).toFixed(3)})'`
        : `:enable='gte(t,${(endMs / 1000).toFixed(3)})'`;
      const nextLabel = index === activeLayers.length - 1 ? "vout" : `base${index + 1}`;
      filters.push(`[${currentLabel}][${index + 1}:v]overlay=0:0:format=auto${timing}[${nextLabel}]`);
      currentLabel = nextLabel;
    });

    const args = ["-i", inputName];
    activeLayers.forEach((_, index) => {
      args.push("-i", `text-overlay-${index}.png`);
    });
    args.push(
      "-filter_complex", filters.join(";"),
      "-map", "[vout]",
      "-map", "0:a?",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "25",
      "-c:a", "aac",
      "-b:a", "160k",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputName,
    );

    const exitCode = await withTimeout(
      ffmpeg.exec(args),
      TEXT_RENDER_TIMEOUT_MS,
      "text_overlay_video_timeout",
      () => {
        try { ffmpeg.terminate(); } catch { /* ignore */ }
      },
    );
    if (exitCode !== 0) throw new Error("text_overlay_video_failed");

    const output = await ffmpeg.readFile(outputName);
    if (typeof output === "string") throw new Error("text_overlay_video_failed");
    const bytes = new Uint8Array(output);
    if (!bytes.byteLength) throw new Error("text_overlay_video_failed");
    onProgress?.(100, "Textos aplicados.");
    return new File([bytes.buffer as ArrayBuffer], `${file.name.replace(/\.[^.]+$/, "") || "video"}-textos.mp4`, {
      type: "video/mp4",
      lastModified: Date.now(),
    });
  } catch (error) {
    if (error instanceof Error && [
      "text_overlay_video_too_large",
      "text_overlay_video_timeout",
      "text_overlay_engine_timeout",
    ].includes(error.message)) throw error;
    throw new Error("text_overlay_video_failed");
  } finally {
    ffmpeg.off("progress", progressHandler);
    try { ffmpeg.terminate(); } catch { /* ignore */ }
  }
}

export async function composeTextOnMedia(
  file: File,
  kind: "image" | "video",
  config: TextOverlayConfig,
  onProgress?: (progress: number, message: string) => void,
  aspect?: MediaAspect,
) {
  if (!config.text.trim()) return file;
  return kind === "video"
    ? composeTextOnVideo(file, config, onProgress, aspect)
    : composeTextOnImage(file, config);
}
