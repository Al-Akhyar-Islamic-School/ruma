import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

/**
 * Membuat S3Client untuk Cloudflare R2.
 * Mengembalikan null jika kredensial R2 belum lengkap (fallback ke DiskStorage lokal).
 */
export function buatKlienR2(): S3Client | null {
  const accountId = env.R2_ACCOUNT_ID || env.CF_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  const endpoint = env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}
