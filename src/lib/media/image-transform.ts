"use client";

export type MediaAspect = "9:16" | "4:5" | "1:1" | "16:9";

export type ImageTransform = {
  zoom: number;
  panX: number;
  panY: number;
};

export const defaultImageTransform: ImageTransform = {
  zoom: 1,
  panX: 0,
  panY: 0,
};

export const mediaAspectSizes: Record<MediaAspect, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

async function decodeImage(file: File) {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("image_transform_decode_failed"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("image_transform_export_failed")), type, quality);
  });
}

export function drawImageTransform(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  transform: ImageTransform,
) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);

  const zoom = clamp(transform.zoom, 1, 4);
  const panX = clamp(transform.panX, -1, 1);
  const panY = clamp(transform.panY, -1, 1);
  const baseScale = Math.max(width / sourceWidth, height / sourceHeight);
  const scale = baseScale * zoom;
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const overflowX = Math.max(0, (drawWidth - width) / 2);
  const overflowY = Math.max(0, (drawHeight - height) / 2);
  const dx = (width - drawWidth) / 2 + panX * overflowX;
  const dy = (height - drawHeight) / 2 + panY * overflowY;
  context.drawImage(image, dx, dy, drawWidth, drawHeight);
}

export async function applyImageTransform(
  file: File,
  aspect: MediaAspect,
  transform: ImageTransform,
) {
  const image = await decodeImage(file);
  const sourceWidth = "naturalWidth" in image ? image.naturalWidth : image.width;
  const sourceHeight = "naturalHeight" in image ? image.naturalHeight : image.height;
  const output = mediaAspectSizes[aspect];
  const canvas = document.createElement("canvas");
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("image_transform_canvas_failed");

  drawImageTransform(
    context,
    image as CanvasImageSource,
    sourceWidth,
    sourceHeight,
    output.width,
    output.height,
    transform,
  );
  if ("close" in image && typeof image.close === "function") image.close();

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await canvasBlob(canvas, outputType, outputType === "image/jpeg" ? 0.93 : undefined);
  const extension = outputType === "image/png" ? "png" : "jpg";
  const basename = file.name.replace(/\.[^.]+$/, "") || "imagem";
  return new File([blob], `${basename}-ajustada.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
}
