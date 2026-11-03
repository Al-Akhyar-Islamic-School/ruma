import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { kategoriRapat } from "./db/schema.js";

/** Semua kategori (termasuk nonaktif, agar sesi lama tetap berlabel). */
export const daftarKategori = () =>
  db.select().from(kategoriRapat).orderBy(asc(kategoriRapat.urutan), asc(kategoriRapat.nama));

export const kategoriByKode = async (kode: string) =>
  (await db.select().from(kategoriRapat).where(eq(kategoriRapat.kode, kode)).limit(1))[0];

/** Kategori yang boleh dipilih untuk sesi baru: ada dan aktif. */
export async function kategoriBolehDipilih(kode: string | undefined): Promise<boolean> {
  if (kode === undefined) return true;
  const [k] = await db
    .select({ id: kategoriRapat.id })
    .from(kategoriRapat)
    .where(and(eq(kategoriRapat.kode, kode), eq(kategoriRapat.aktif, true)))
    .limit(1);
  return k !== undefined;
}

/** "Rapat Wali Murid" -> "rapat-wali-murid" (maks 40 karakter, tanpa aksen). */
export function slugKategori(nama: string): string {
  const s = nama
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return s || "kategori";
}

/** Nama sudah dipakai (tanpa membedakan huruf besar/kecil), kecuali oleh `kecualiId`. */
export async function namaKategoriAda(nama: string, kecualiId?: number): Promise<boolean> {
  const rows = await db
    .select({ id: kategoriRapat.id })
    .from(kategoriRapat)
    .where(sql`lower(${kategoriRapat.nama}) = ${nama.toLowerCase()}`);
  return rows.some((r) => r.id !== kecualiId);
}

/** Kode unik dari nama: slug, ditambah -2, -3, ... bila bentrok (mis. dua nama yang slug-nya sama). */
export async function kodeKategoriUnik(nama: string): Promise<string> {
  const dasar = slugKategori(nama);
  for (let i = 1; ; i++) {
    const sufiks = i === 1 ? "" : `-${i}`;
    const kode = dasar.slice(0, 40 - sufiks.length) + sufiks;
    if (!(await kategoriByKode(kode))) return kode;
  }
}
