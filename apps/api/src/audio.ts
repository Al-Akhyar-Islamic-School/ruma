import { spawn } from "node:child_process";
import { open, readdir, readFile } from "node:fs/promises";
import path from "node:path";

function jalankan(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    p.on("error", (e) => reject(new Error(`${cmd} gagal dijalankan (terpasang di PATH?): ${e.message}`)));
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} keluar ${code}: ${err.trim()}`))));
  });
}

const ffmpeg = (args: string[]) => jalankan("ffmpeg", ["-hide_banner", "-nostdin", "-loglevel", "error", "-y", ...args]);

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

/** Memotong MP3 tanpa transkode menjadi bagian sepanjang `detik`; mengembalikan path berurutan. */
export async function potong(mp3: string, dirOut: string, detik: number): Promise<string[]> {
  await ffmpeg([
    "-i", mp3, "-c", "copy", "-f", "segment", "-segment_time", String(detik), "-reset_timestamps", "1",
    path.join(dirOut, "seg_%04d.mp3"),
  ]);
  const names = (await readdir(dirOut)).filter((n) => /^seg_\d+\.mp3$/.test(n)).sort();
  return names.map((n) => path.join(dirOut, n));
}

export async function durasiDetik(file: string): Promise<number> {
  const out = await jalankan("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  const d = Number.parseFloat(out.trim());
  if (!Number.isFinite(d)) throw new Error(`durasi tidak terbaca: ${file}`);
  return d;
}
