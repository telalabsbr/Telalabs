"use client";

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

const JPEG_TYPES = new Set(["image/jpeg", "image/jpg"]);
const CONVERTIBLE_STATIC_IMAGE_TYPES = new Set([
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);

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
  if (["mp3", "wav", "m4a", "aac", "ogg"].includes(extension)) return "audio/unknown";
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

export async function prepareMediaFile(file: File): Promise<PreparedMediaFile> {
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
    throw new Error("animated_gif_requires_video_conversion");
  }

  if (VIDEO_TYPES.has(mimeType)) {
    const normalized = file.type === mimeType
      ? file
      : new File([file], file.name, { type: mimeType, lastModified: file.lastModified });

    let metadata: PreparedMediaMetadata = { durationMs: null, width: null, height: null };
    try {
      metadata = await probeVideo(normalized);
    } catch {
      // Some browsers cannot decode MOV metadata even when Instagram can ingest the file.
      // Keep the upload available and let the provider perform the final codec validation.
    }

    return {
      file: normalized,
      kind: "video",
      metadata,
      notice: null,
    };
  }

  if (mimeType.startsWith("audio/")) {
    throw new Error("audio_requires_visual");
  }

  if (mimeType.startsWith("video/")) {
    throw new Error("video_format_requires_conversion");
  }

  if (mimeType.startsWith("image/")) {
    throw new Error("image_format_requires_conversion");
  }

  throw new Error("unsupported_media_type");
}
