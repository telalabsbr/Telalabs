"use client";

import {
  transcodeAudioToMp4,
  transcodeGifToMp4,
  transcodeVideoToMp4,
  type TranscodeProgress,
} from "./transcode";

export type PreparedMediaMetadata = {
  durationMs: number | null;
  width: number | null;
  height: number | null;
};

export type PreparedMediaFile = {
  file: File;
  kind: "image" | "video";
  metadata: PreparedMediaMetadata;
  notice: string | null;
};

export type PrepareMediaOptions = {
  onProgress?: (progress: TranscodeProgress) => void;
};

const JPEG_TYPES = new Set(["image/jpeg", "image/jpg"]);
const CONVERTIBLE_STATIC_IMAGE_TYPES = new Set([
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
]);
const DIRECT_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);
const TRANSCODE_VIDEO_TYPES = new Set([
  "video/webm",
  "video/x-msvideo",
  "video/avi",
  "video/x-matroska",
  "video/mpeg",
  "video/x-m4v",
  "video/3gpp",
  "video/ogg",
]);
const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
]);

function extensionOf(file: File) {
  const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function inferredType(file: File) {
  if (file.type) return file.type.toLowerCase();
  const extension = extensionOf(file);
  if (["jpg", "jpeg"].includes(extension)) return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "avif") return "image/avif";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  if (extension === "bmp") return "image/bmp";
  if (extension === "gif") return "image/gif";
  if (extension === "mp4") return "video/mp4";
  if (extension === "mov") return "video/quicktime";
  if (extension === "webm") return "video/webm";
  if (extension === "avi") return "video/x-msvideo";
  if (extension === "mkv") return "video/x-matroska";
  if (["mpeg", "mpg"].includes(extension)) return "video/mpeg";
  if (extension === "m4v") return "video/x-m4v";
  if (["3gp", "3gpp"].includes(extension)) return "video/3gpp";
  if (extension === "ogv") return "video/ogg";
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "wav") return "audio/wav";
  if (extension === "m4a") return "audio/mp4";
  if (extension === "aac") return "audio/aac";
  if (extension === "ogg") return "audio/ogg";
  if (extension === "flac") return "audio/flac";
  return "application/octet-stream";
}

function jpegFilename(name: string) {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  return `${withoutExtension || "imagem"}.jpg`;
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function probeImage(file: File): Promise<PreparedMediaMetadata> {
  const image = await loadImage(file);
  return {
    durationMs: null,
    width: image.naturalWidth || null,
    height: image.naturalHeight || null,
  };
}

async function convertStaticImageToJpeg(file: File): Promise<PreparedMediaFile> {
  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    throw new Error("image_conversion_not_supported_in_browser");
  }

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new Error("image_decode_failed");

  const maxEdge = 4096;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("image_conversion_failed");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(image, 0, 0, outputWidth, outputHeight);

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("image_conversion_failed");

  const output = new File([blob], jpegFilename(file.name), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });

  return {
    file: output,
    kind: "image",
    metadata: { durationMs: null, width: outputWidth, height: outputHeight },
    notice: `${file.name} foi convertido automaticamente para JPEG para aumentar a compatibilidade entre as redes.`,
  };
}

async function probeVideo(file: File): Promise<PreparedMediaMetadata> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        video.onloadedmetadata = null;
        video.onerror = null;
      };
      video.onloadedmetadata = () => {
        cleanup();
        resolve();
      };
      video.onerror = () => {
        cleanup();
        reject(new Error("video_metadata_failed"));
      };
    });

    return {
      durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null,
      width: video.videoWidth || null,
      height: video.videoHeight || null,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function preparedMp4(file: File, notice: string): Promise<PreparedMediaFile> {
  let metadata: PreparedMediaMetadata = { durationMs: null, width: null, height: null };
  try {
    metadata = await probeVideo(file);
  } catch {
    // The output is a normalized MP4. Provider validation remains authoritative
    // if this browser cannot read the generated metadata.
  }
  return { file, kind: "video", metadata, notice };
}

export async function prepareMediaFile(file: File, options: PrepareMediaOptions = {}): Promise<PreparedMediaFile> {
  const mimeType = inferredType(file);

  if (JPEG_TYPES.has(mimeType)) {
    const normalized = file.type === "image/jpeg"
      ? file
      : new File([file], file.name, { type: "image/jpeg", lastModified: file.lastModified });
    return {
      file: normalized,
      kind: "image",
      metadata: await probeImage(normalized),
      notice: null,
    };
  }

  if (CONVERTIBLE_STATIC_IMAGE_TYPES.has(mimeType)) {
    return convertStaticImageToJpeg(file);
  }

  if (mimeType === "image/gif") {
    const converted = await transcodeGifToMp4(file, options.onProgress);
    return preparedMp4(converted, `${file.name} foi convertido automaticamente de GIF para MP4 para publicação nas redes.`);
  }

  if (DIRECT_VIDEO_TYPES.has(mimeType)) {
    const normalized = file.type === mimeType
      ? file
      : new File([file], file.name, { type: mimeType, lastModified: file.lastModified });

    let metadata: PreparedMediaMetadata = { durationMs: null, width: null, height: null };
    try {
      metadata = await probeVideo(normalized);
    } catch {
      // Some browsers cannot decode MOV metadata even when a provider can ingest it.
    }

    return { file: normalized, kind: "video", metadata, notice: null };
  }

  if (TRANSCODE_VIDEO_TYPES.has(mimeType) || mimeType.startsWith("video/")) {
    const converted = await transcodeVideoToMp4(file, options.onProgress);
    return preparedMp4(converted, `${file.name} foi convertido automaticamente para MP4 para aumentar a compatibilidade entre as redes.`);
  }

  if (AUDIO_TYPES.has(mimeType) || mimeType.startsWith("audio/")) {
    const converted = await transcodeAudioToMp4(file, options.onProgress);
    return preparedMp4(converted, `${file.name} foi transformado automaticamente em vídeo MP4 com uma capa para poder ser publicado nas redes.`);
  }

  if (mimeType.startsWith("image/")) {
    throw new Error("image_format_requires_conversion");
  }

  throw new Error("unsupported_media_type");
}
