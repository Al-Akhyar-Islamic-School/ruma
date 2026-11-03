/** Toleransi di atas batas durasi yang disetujui. Harus sama dengan `TOLERANSI_DURASI_DETIK` di apps/api/src/routes/sesi.ts. */
export const TOLERANSI_DETIK = 15 * 60;

const AMBANG_SEPULUH_MENIT = 10 * 60;
const AMBANG_LIMA_MENIT = 5 * 60;

export type TahapBatas = "normal" | "sepuluh-menit" | "lima-menit" | "lewat-batas";

/**
 * Tahap rekaman terhadap batas durasi yang disetujui. `maks === null` berarti tanpa batas (selalu normal).
 * `sisaToleransiDetik` hanya terisi pada `lewat-batas`: detik sebelum berhenti otomatis di batas + toleransi.
 */
export function tahapBatas(
  detik: number,
  maks: number | null,
): { tahap: TahapBatas; sisaDetik: number | null; sisaToleransiDetik: number | null } {
  if (maks === null) return { tahap: "normal", sisaDetik: null, sisaToleransiDetik: null };
  const sisa = maks - detik;
  if (sisa <= 0) return { tahap: "lewat-batas", sisaDetik: 0, sisaToleransiDetik: Math.max(0, TOLERANSI_DETIK + sisa) };
  const tahap: TahapBatas = sisa <= AMBANG_LIMA_MENIT ? "lima-menit" : sisa <= AMBANG_SEPULUH_MENIT ? "sepuluh-menit" : "normal";
  return { tahap, sisaDetik: sisa, sisaToleransiDetik: null };
}

/** Detik rekam saat rekaman berhenti otomatis: batas yang disetujui + toleransi; `null` bila tanpa batas. */
export const batasHentiDetik = (maks: number | null): number | null => (maks === null ? null : maks + TOLERANSI_DETIK);

/** 125 -> "02:05". Untuk hitung mundur singkat (di bawah satu jam). */
export function formatMenitDetik(detik: number): string {
  const s = Math.max(0, Math.floor(detik));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
