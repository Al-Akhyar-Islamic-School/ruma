import type { Segment } from "./db/schema.js";

/** Detik -> "HH:MM:SS", format penanda waktu di transkrip dan di daftar momen penting. */
export const hms = (detik: number) => new Date(detik * 1000).toISOString().slice(11, 19);

const normal = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Whisper kadang terjebak mengulang kalimat yang sama berkali-kali (loop halusinasi), terutama di bagian hening atau
 * berderau. Percakapan nyata hampir tidak pernah mengulang kalimat identik 3 kali berturut-turut, jadi pengulangan
 * ketiga dan seterusnya dibuang (dua pertama tetap, kalau-kalau pembicara memang menegaskan).
 */
export function buangPengulangan(segmen: Segment[]): Segment[] {
  const hasil: Segment[] = [];
  let ulang = 0;
  let sebelumnya = "";
  for (const s of segmen) {
    const n = normal(s.text);
    ulang = n !== "" && n === sebelumnya ? ulang + 1 : 1;
    sebelumnya = n;
    if (ulang <= 2) hasil.push(s);
  }
  return hasil;
}

/** Baris transkrip `[HH:MM:SS] teks` yang dibaca manusia dan dikirim ke model analisis. */
export const susunTeks = (segmen: Segment[]) => segmen.map((x) => `[${hms(x.start)}] ${x.text}`).join("\n");
