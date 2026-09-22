import "server-only";
import { S3Client } from "@aws-sdk/client-s3";

export function getObjectStorageConfig() {
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
  const bucket = process.env.OBJECT_STORAGE_BUCKET;
  const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY;
  const region = process.env.OBJECT_STORAGE_REGION || "auto";

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    bucket,
    client: new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}
