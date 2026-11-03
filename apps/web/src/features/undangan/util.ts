export const UNIT = ["TK", "SD", "SMP", "SMA", "YPI"] as const;
export type Unit = (typeof UNIT)[number];

/** Pola yang sama dengan `z.email()` di server, supaya email yang lolos di sini juga lolos di API. */
export const POLA_EMAIL = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

export const normalisasiEmail = (e: string): string => e.trim().toLowerCase();

/** Orang di daftar undangan/anggota. `namaResmi` null = email tidak (atau belum) ada di direktori GTK. */
export type Anggota = { email: string; namaResmi: string | null };

export type HasilTambah = "ok" | "duplikat" | "penuh";

/** Menambah satu orang ke daftar tanpa duplikat (email sudah dinormalkan huruf kecil) dan dengan batas maksimum. */
export function tambahAnggota(
  daftar: Anggota[],
  baru: Anggota,
  maks: number,
): { daftar: Anggota[]; hasil: HasilTambah } {
  const email = normalisasiEmail(baru.email);
  if (daftar.some((a) => a.email === email)) return { daftar, hasil: "duplikat" };
  if (daftar.length >= maks) return { daftar, hasil: "penuh" };
  return { daftar: [...daftar, { email, namaResmi: baru.namaResmi }], hasil: "ok" };
}
