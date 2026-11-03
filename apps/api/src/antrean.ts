import { randomUUID } from "node:crypto";
import { setTimeout as tidur } from "node:timers/promises";
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { GalatKuota, GalatPermanen } from "./ai/layanan.js";
import { periksaAlatAudio } from "./audio.js";
import { db } from "./db/index.js";
import { sesi } from "./db/schema.js";
import { env } from "./env.js";
import { catatDetakWorker } from "./pengaturan.js";
import { tahapAnalisis, tahapTranskripsi } from "./pipeline.js";

/**
 * Antrean pemrosesan: mengambil sesi berstatus `mentranskrip` / `menganalisis` dari MySQL dan memprosesnya satu
 * per satu. Dijalankan di dalam proses API (WORKER_INLINE, default) atau sebagai proses sendiri (`pnpm worker`).
 */

const WORKER_ID = randomUUID();
const KUNCI_KEDALUWARSA_MS = 30 * 60_000;
const DETAK_KUNCI_MS = 5 * 60_000;
const DETAK_WORKER_MS = 15_000;
const BACKOFF_DASAR_MS = 5 * 60_000;
const AKTIF = ["mentranskrip", "menganalisis"] as const;

type Sesi = typeof sesi.$inferSelect;

/** Env yang belum diisi dan dibutuhkan worker (daftar nama, kosong = lengkap). */
export const konfigurasiKurang = () =>
  [
    !env.CF_ACCOUNT_ID && "CF_ACCOUNT_ID",
    !env.CF_API_TOKEN && "CF_API_TOKEN",
    // GEMINI_BASE_URL kosong masih bisa jalan lewat cadangan Llama, tetapi itu bukan konfigurasi yang diinginkan.
    !env.GEMINI_BASE_URL && "GEMINI_BASE_URL",
  ].filter((x): x is string => Boolean(x));

/** Alasan worker tidak boleh berjalan (env kurang / ffmpeg tak ada), atau null bila siap. */
export async function alasanTidakSiap(): Promise<string | null> {
  const kurang = konfigurasiKurang();
  if (kurang.length) return `env belum diisi: ${kurang.join(", ")}`;
  return periksaAlatAudio();
}

/** Klaim atomik satu sesi: satu UPDATE ... LIMIT 1, jadi dua worker tidak pernah mengambil sesi yang sama. */
async function klaim(): Promise<Sesi | undefined> {
  const sekarang = new Date();
  const [res] = await db
    .update(sesi)
    .set({ dikunciOleh: WORKER_ID, dikunciPada: sekarang, percobaan: sql`${sesi.percobaan} + 1` })
    .where(
      and(
        inArray(sesi.status, AKTIF),
        lt(sesi.percobaan, env.WORKER_MAX_PERCOBAAN),
        or(isNull(sesi.cobaLagiSetelah), lte(sesi.cobaLagiSetelah, sekarang)),
        // Kunci kedaluwarsa = worker sebelumnya mati di tengah jalan.
        or(isNull(sesi.dikunciOleh), lt(sesi.dikunciPada, new Date(sekarang.getTime() - KUNCI_KEDALUWARSA_MS))),
      ),
    )
    .orderBy(asc(sesi.id))
    .limit(1);
  if (res.affectedRows === 0) return undefined;
  const [row] = await db.select().from(sesi).where(eq(sesi.dikunciOleh, WORKER_ID)).limit(1);
  return row;
}

/** Sesi yang kehabisan percobaan karena worker berulang kali mati (tidak pernah sempat mencatat galat). */
async function tandaiMacet() {
  await db
    .update(sesi)
    .set({ status: "gagal", dikunciOleh: null, dikunciPada: null, galat: "worker berhenti berulang kali saat memproses sesi ini" })
    .where(
      and(
        inArray(sesi.status, AKTIF),
        sql`${sesi.percobaan} >= ${env.WORKER_MAX_PERCOBAAN}`,
        or(isNull(sesi.dikunciOleh), lt(sesi.dikunciPada, new Date(Date.now() - KUNCI_KEDALUWARSA_MS))),
      ),
    );
}

async function gagalkan(id: number, e: unknown) {
  console.error(`sesi #${id} gagal`, e);
  const pesan = (e instanceof Error ? e.message : String(e)).slice(0, 1000);

  if (e instanceof GalatKuota) {
    // Kuota harian / batas laju bukan salah sesi ini: tunda sampai pulih, tanpa menghabiskan jatah percobaan.
    await db
      .update(sesi)
      .set({
        dikunciOleh: null,
        dikunciPada: null,
        galat: `Kuota layanan AI habis; dicoba lagi otomatis. ${pesan}`.slice(0, 1000),
        cobaLagiSetelah: e.pulihPada,
        percobaan: sql`GREATEST(${sesi.percobaan} - 1, 0)`,
      })
      .where(eq(sesi.id, id));
    return;
  }

  const [s] = await db.select({ percobaan: sesi.percobaan }).from(sesi).where(eq(sesi.id, id)).limit(1);
  const habis = e instanceof GalatPermanen || (s?.percobaan ?? 0) >= env.WORKER_MAX_PERCOBAAN;
  await db
    .update(sesi)
    .set({
      dikunciOleh: null,
      dikunciPada: null,
      galat: pesan,
      ...(habis
        ? { status: "gagal" as const, cobaLagiSetelah: null }
        // Backoff eksponensial 5, 10, 20 menit: memberi waktu gateway/jaringan pulih.
        : { cobaLagiSetelah: new Date(Date.now() + BACKOFF_DASAR_MS * 2 ** ((s?.percobaan ?? 1) - 1)) }),
    })
    .where(eq(sesi.id, id));
}

/** Memproses satu sesi dari antrean. Mengembalikan false bila antrean kosong. */
async function prosesSatu(): Promise<boolean> {
  const s = await klaim();
  if (!s) return false;
  console.log(`sesi ${s.uuid}: ${s.status} (percobaan ${s.percobaan}/${env.WORKER_MAX_PERCOBAAN})`);

  // Detak: memperpanjang kunci selama pekerjaan panjang (rekaman 2 jam) agar tidak dianggap mati.
  const detak = setInterval(
    () => void db.update(sesi).set({ dikunciPada: new Date() }).where(eq(sesi.id, s.id)).catch(console.error),
    DETAK_KUNCI_MS,
  );
  try {
    if (s.status === "mentranskrip") {
      await tahapTranskripsi(s);
      // Tahap 1 selesai: lanjut analisis dengan data terbaru (status, percobaan, audioPath).
      const [lanjut] = await db.select().from(sesi).where(eq(sesi.id, s.id)).limit(1);
      if (lanjut) await tahapAnalisis(lanjut);
    } else {
      await tahapAnalisis(s);
    }
    await db
      .update(sesi)
      .set({ dikunciOleh: null, dikunciPada: null, cobaLagiSetelah: null, progresSelesai: null, progresTotal: null })
      .where(eq(sesi.id, s.id));
    console.log(`sesi ${s.uuid}: selesai`);
  } catch (e) {
    await gagalkan(s.id, e);
  } finally {
    clearInterval(detak);
  }
  return true;
}

export type OpsiWorker = {
  /** Habiskan antrean lalu berhenti (cron, uji). */
  sekali?: boolean;
  /** Dicek di sela pekerjaan; true = selesaikan sesi yang sedang berjalan lalu berhenti. */
  berhenti: () => boolean;
};

/**
 * Loop worker. Mengirim detak ke database tiap 15 detik selama berjalan (terlepas dari sesi yang sedang diproses),
 * supaya API dan UI bisa membedakan "sedang bekerja" dari "tidak ada worker sama sekali".
 */
export async function mulaiWorker({ sekali = false, berhenti }: OpsiWorker) {
  const kirimDetak = () => void catatDetakWorker().catch((e) => console.error("detak worker gagal", e));
  kirimDetak();
  const detak = setInterval(kirimDetak, DETAK_WORKER_MS);
  try {
    while (!berhenti()) {
      await tandaiMacet();
      while (!berhenti() && (await prosesSatu())) {
        /* habiskan antrean */
      }
      if (sekali) break;
      // Tidur per detik agar permintaan berhenti tidak menunggu satu siklus penuh.
      for (let i = 0; i < env.WORKER_POLL_DETIK && !berhenti(); i++) await tidur(1000);
    }
  } finally {
    clearInterval(detak);
  }
}
