import { spawn } from "node:child_process";
import { open, readdir, readFile } from "node:fs/promises";
import path from "node:path";

type Keluaran = { out: string; err: string };

function jalankan(cmd: string, args: string[], stderrPenuh = false): Promise<Keluaran> {
  const { promise, resolve, reject } = Promise.withResolvers<Keluaran>();
  const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  let err = "";
  p.stdout.on("data", (d) => (out += d));
  // Galat cukup ekor stderr; deteksi hening butuh seluruhnya (ffmpeg menulisnya sebagai log).
  p.stderr.on("data", (d) => (err = stderrPenuh ? err + d : (err + d).slice(-2000)));
  p.on("error", (e) => reject(new Error(`${cmd} gagal dijalankan (terpasang di PATH?): ${e.message}`)));
  p.on("close", (code) =>
    code === 0 ? resolve({ out, err }) : reject(new Error(`${cmd} keluar ${code}: ${err.slice(-2000).trim()}`)),
  );
  return promise;
}

const ffmpeg = (args: string[]) =>
  jalankan("ffmpeg", ["-hide_banner", "-nostdin", "-loglevel", "error", "-y", ...args]).then(() => undefined);

/** Pesan galat bila ffmpeg/ffprobe tidak bisa dijalankan, atau null bila siap. Dipanggil saat worker start. */
export async function periksaAlatAudio(): Promise<string | null> {
  try {
    await Promise.all([jalankan("ffmpeg", ["-version"]), jalankan("ffprobe", ["-version"])]);
    return null;
  } catch {
    return "ffmpeg/ffprobe tidak ditemukan di PATH (pasang: apt install ffmpeg)";
  }
}

/** Menyambung potongan MediaRecorder berurutan menjadi satu berkas (hanya potongan pertama yang berisi header). */
export async function sambung(files: string[], dest: string) {
  // Potongan kecil (±120 KB): baca utuh lalu tulis berurutan lewat satu file handle.
  const out = await open(dest, "w");
  try {
    for (const f of files) await out.write(await readFile(f));
  } finally {
    await out.close();
  }
}

/**
 * Transkode ke MP3 mono 16 kHz 32 kbps: format yang diterima luas (Opus WebM di Android, AAC MP4 di iOS),
 * ±14 MB/jam, dan dipakai ulang sebagai audio pemutar (CBR, mudah di-seek lewat Range).
 */
export const keMp3 = (src: string, dest: string) =>
  ffmpeg(["-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k", dest]);

export async function durasiDetik(file: string): Promise<number> {
  const { out } = await jalankan("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  const d = Number.parseFloat(out.trim());
  if (!Number.isFinite(d)) throw new Error(`durasi tidak terbaca: ${file}`);
  return d;
}

export type Hening = { mulai: number; selesai: number };

/** Bagian hening (≥ 0,35 dtk di bawah -35 dB) dari log `silencedetect` ffmpeg. */
export async function deteksiHening(file: string): Promise<Hening[]> {
  const { err } = await jalankan(
    "ffmpeg",
    ["-hide_banner", "-nostdin", "-i", file, "-af", "silencedetect=noise=-35dB:d=0.35", "-f", "null", "-"],
    true,
  );
  const hasil: Hening[] = [];
  let mulai: number | null = null;
  for (const m of err.matchAll(/silence_(start|end):\s*(-?[\d.]+)/g)) {
    const nilai = Number.parseFloat(m[2]!);
    if (m[1] === "start") mulai = Math.max(nilai, 0);
    else if (mulai !== null) {
      hasil.push({ mulai, selesai: nilai });
      mulai = null;
    }
  }
  return hasil;
}

/**
 * Titik potong (detik) untuk membagi audio sepanjang `total` menjadi bagian ±`target` detik. Tiap titik dipilih di
 * tengah hening terdekat dalam ±`jendela` detik dari titik ideal, supaya kalimat tidak terpotong di batas bagian
 * (potongan di tengah kata merusak transkrip Whisper di kedua sisi). Tanpa hening yang cocok: potong tepat di titik ideal.
 */
export function titikPotong(total: number, target: number, hening: Hening[]): number[] {
  // Proporsional terhadap target (default produksi 600 dtk: jendela ±90 dtk, bagian minimal 30 dtk).
  const jendela = Math.min(90, target * 0.25);
  const minBagian = Math.min(30, target * 0.3);
  const titik: number[] = [];
  let terakhir = 0;
  // Sisa kurang dari seperempat target digabung ke bagian terakhir, bukan jadi bagian kecil sendiri.
  while (total - (terakhir + target) > target * 0.25) {
    const ideal = terakhir + target;
    let terbaik = ideal;
    let jarak = Number.POSITIVE_INFINITY;
    for (const h of hening) {
      const tengah = (h.mulai + h.selesai) / 2;
      if (tengah <= terakhir + minBagian || tengah >= total - 5) continue;
      const d = Math.abs(tengah - ideal);
      if (d <= jendela && d < jarak) {
        terbaik = tengah;
        jarak = d;
      }
    }
    titik.push(terbaik);
    terakhir = terbaik;
  }
  return titik;
}

/**
 * Memotong MP3 (tanpa transkode) menjadi bagian ±`target` detik pada titik hening. Audio yang tidak lebih panjang dari
 * 1,25× target tidak dipotong: dikembalikan sebagai satu bagian berupa berkas aslinya.
 */
export async function potongDiHening(mp3: string, dirOut: string, target: number): Promise<string[]> {
  const total = await durasiDetik(mp3);
  if (total <= target * 1.25) return [mp3];

  const batas = [0, ...titikPotong(total, target, await deteksiHening(mp3)), total];
  const hasil: string[] = [];
  for (let i = 0; i < batas.length - 1; i++) {
    const out = path.join(dirOut, `seg_${String(i).padStart(4, "0")}.mp3`);
    await ffmpeg(["-i", mp3, "-ss", String(batas[i]), "-to", String(batas[i + 1]), "-c", "copy", out]);
    hasil.push(out);
  }
  return hasil;
}

/** Berkas `seg_*.mp3` hasil pemotongan sebelumnya di `dir` (untuk dibersihkan sebelum memotong ulang). */
export async function daftarBagianLama(dir: string): Promise<string[]> {
  return (await readdir(dir)).filter((n) => /^seg_\d+\.mp3$/.test(n)).map((n) => path.join(dir, n));
}
