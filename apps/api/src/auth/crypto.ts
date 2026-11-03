import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../env.js";

// Kunci enkripsi token: jika tidak ada di env, turunkan dari GOOGLE_CLIENT_SECRET
function dapatkanKunci(): Buffer {
  const rahasia = process.env.TOKEN_ENCRYPTION_KEY || env.GOOGLE_CLIENT_SECRET;
  // Pad atau potong tepat 32 byte untuk AES-256
  const buf = Buffer.alloc(32);
  Buffer.from(rahasia).copy(buf);
  return buf;
}

export function enkripsiTeks(teks: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dapatkanKunci(), iv);
  const encrypted = Buffer.concat([cipher.update(teks, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function dekripsiTeks(dataEnkripsi: string): string {
  const [ivHex, tagHex, contentHex] = dataEnkripsi.split(":");
  if (!ivHex || !tagHex || !contentHex) return dataEnkripsi; // fallback jika teks belum terenkripsi
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", dapatkanKunci(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(Buffer.from(contentHex, "hex")) + decipher.final("utf8");
}
