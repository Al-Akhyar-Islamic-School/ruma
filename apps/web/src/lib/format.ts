const ZONA = "Asia/Makassar";

/** 3725 -> "01:02:05". Untuk timer (font mono). */
export function formatTimer(detik: number): string {
  const s = Math.max(0, Math.floor(detik));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [h, m, s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

/** 3900 -> "65 menit"; di bawah semenit -> "< 1 menit". */
export function formatDurasi(detik: number): string {
  if (detik < 60) return "< 1 menit";
  return `${Math.round(detik / 60)} menit`;
}

const hari = new Intl.DateTimeFormat("sv-SE", { timeZone: ZONA }); // YYYY-MM-DD
const jam = new Intl.DateTimeFormat("id-ID", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false });
const tanggal = new Intl.DateTimeFormat("id-ID", { timeZone: ZONA, day: "numeric", month: "short", year: "numeric" });

/** "Hari ini, 08.30" / "Kemarin, 14.05" / "3 Nov 2026". Zona Asia/Makassar. */
export function formatWaktu(iso: string | Date): string {
  const d = new Date(iso);
  const selisihHari = Math.round((Date.parse(hari.format(new Date())) - Date.parse(hari.format(d))) / 86_400_000);
  if (selisihHari === 0) return `Hari ini, ${jam.format(d)}`;
  if (selisihHari === 1) return `Kemarin, ${jam.format(d)}`;
  return tanggal.format(d);
}

export const formatTanggal = (iso: string | Date) => tanggal.format(new Date(iso));

export const STATUS_SESI = {
  merekam: { label: "Belum selesai", tone: "amber" },
  mentranskrip: { label: "Mentranskrip", tone: "sky" },
  menganalisis: { label: "Menganalisis", tone: "sky" },
  selesai: { label: "Selesai", tone: "emerald" },
  gagal: { label: "Gagal", tone: "rose" },
} as const;

export type StatusSesi = keyof typeof STATUS_SESI;
