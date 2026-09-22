"use client";

const SIGN_BATCH = 10;
const MAX_PART_RETRIES = 3;

type StartResponse = {
  media_id: string;
  upload_id: string;
  chunk_size: number;
  size_bytes: number;
  pipeline: "STANDARD" | "LARGE_FILE_TEMP";
};

type SignedPart = { part_number: number; url: string };

type UploadProgress = {
  uploadedBytes: number;
  totalBytes: number;
  percent: number;
  part: number;
  totalParts: number;
};

async function jsonOrThrow(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = typeof body?.error === "string" ? body.error : "upload_request_failed";
    throw new Error(code);
  }
  return body;
}

async function uploadPart(url: string, blob: Blob) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_PART_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "PUT",
        body: blob,
      });
      if (!response.ok) throw new Error("upload_part_failed_" + response.status);

      const etag = response.headers.get("etag");
      if (!etag) throw new Error("upload_part_missing_etag");
      return etag;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("upload_part_failed");
      if (attempt < MAX_PART_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 500 * attempt * attempt));
      }
    }
  }

  throw lastError ?? new Error("upload_part_failed");
}

export async function uploadMediaFile(args: {
  file: File;
  brandId: string;
  retention: "delete" | "library";
  onProgress?: (progress: UploadProgress) => void;
}) {
  const startResponse = await fetch("/api/media/multipart/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brand_id: args.brandId,
      filename: args.file.name,
      mime_type: args.file.type || "application/octet-stream",
      size_bytes: args.file.size,
      retention: args.retention,
    }),
  });

  const start = await jsonOrThrow(startResponse) as StartResponse;
  const totalParts = Math.ceil(args.file.size / start.chunk_size);
  const completed: Array<{ part_number: number; etag: string }> = [];
  let uploadedBytes = 0;

  try {
    for (let batchStart = 1; batchStart <= totalParts; batchStart += SIGN_BATCH) {
      const partNumbers = Array.from(
        { length: Math.min(SIGN_BATCH, totalParts - batchStart + 1) },
        (_, index) => batchStart + index,
      );

      const signedResponse = await fetch("/api/media/multipart/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_id: start.media_id,
          upload_id: start.upload_id,
          part_numbers: partNumbers,
        }),
      });

      const signedBody = await jsonOrThrow(signedResponse) as { parts: SignedPart[] };

      for (const signed of signedBody.parts) {
        const offset = (signed.part_number - 1) * start.chunk_size;
        const end = Math.min(offset + start.chunk_size, args.file.size);
        const blob = args.file.slice(offset, end);
        const etag = await uploadPart(signed.url, blob);

        completed.push({ part_number: signed.part_number, etag });
        uploadedBytes += blob.size;
        args.onProgress?.({
          uploadedBytes,
          totalBytes: args.file.size,
          percent: Math.min(100, Math.round((uploadedBytes / args.file.size) * 100)),
          part: signed.part_number,
          totalParts,
        });
      }
    }

    const completeResponse = await fetch("/api/media/multipart/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_id: start.media_id,
        upload_id: start.upload_id,
        parts: completed,
      }),
    });

    await jsonOrThrow(completeResponse);

    return {
      mediaId: start.media_id,
      pipeline: start.pipeline,
    };
  } catch (error) {
    await fetch("/api/media/multipart/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_id: start.media_id,
        upload_id: start.upload_id,
      }),
    }).catch(() => undefined);

    throw error;
  }
}
