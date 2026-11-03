import { randomUUID } from "node:crypto";
import { setTimeout as tidur } from "node:timers/promises";
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { GalatPermanen } from "./ai/layanan.js";
import { closeDb, db } from "./db/index.js";
import { sesi } from "./db/schema.js";
import { env } from "./env.js";
import { tahapAnalisis, tahapTranskripsi } from "./pipeline.js";

/**
 * Worker antrean: mengambil sesi berstatus `mentranskrip` / `menganalisis` dari MySQL dan memprosesnya satu per satu.
 *   pnpm worker          berjalan terus (systemd), tidur WORKER_POLL_DETIK saat antrean kosong
 *   pnpm worker --once   habiskan antrean lalu keluar (cron, uji)
 */

const WORKER_ID = randomUUID();
const KUNCI_KEDALUWARSA_MS = 30 * 60_000;
const DETAK_MS = 5 * 60_000;
const BACKOFF_DASAR_MS = 5 * 60_000;
const AKTIF = ["mentranskrip", "menganalisis"] as const;

type Sesi = typeof sesi.$inferSelect;

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
  const [s] = await db.select({ percobaan: sesi.percobaan }).from(sesi).where(eq(sesi.id, id)).limit(1);
  const habis = e instanceof GalatPermanen || (s?.percobaan ?? 0) >= env.WORKER_MAX_PERCOBAAN;
  await db
    .update(sesi)
    .set({
      dikunciOleh: null,
      dikunciPada: null,
      galat: (e instanceof Error ? e.message : String(e)).slice(0, 1000),
      ...(habis
        ? { status: "gagal" as const, cobaLagiSetelah: null }
        // Backoff eksponensial 5, 10, 20 menit: memberi waktu kuota Whisper harian / gateway pulih.
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
    DETAK_MS,
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
    await db.update(sesi).set({ dikunciOleh: null, dikunciPada: null, cobaLagiSetelah: null }).where(eq(sesi.id, s.id));
    console.log(`sesi ${s.uuid}: selesai`);
  } catch (e) {
    await gagalkan(s.id, e);
  } finally {
    clearInterval(detak);
  }
  return true;
}

function periksaKonfigurasi() {
  const kurang = [
    !env.CF_ACCOUNT_ID && "CF_ACCOUNT_ID",
    !env.CF_API_TOKEN && "CF_API_TOKEN",
    !env.GEMINI_BASE_URL && "GEMINI_BASE_URL",
  ].filter(Boolean);
  if (kurang.length) {
    // GEMINI_BASE_URL kosong masih bisa jalan lewat cadangan Llama, tapi itu bukan konfigurasi yang diinginkan.
    console.error(`worker menolak start, env belum diisi: ${kurang.join(", ")}`);
    process.exit(1);
  }
}

periksaKonfigurasi();
const sekali = process.argv.includes("--once");
let berhenti = false;
for (const sinyal of ["SIGINT", "SIGTERM"] as const) {
  // Selesaikan sesi yang sedang berjalan, jangan memotongnya di tengah.
  process.on(sinyal, () => (berhenti = true));
}

console.log(`worker ${WORKER_ID} mulai${sekali ? " (--once)" : ""}`);
while (!berhenti) {
  await tandaiMacet();
  while (!berhenti && (await prosesSatu())) {
    /* habiskan antrean */
  }
  if (sekali) break;
  await tidur(env.WORKER_POLL_DETIK * 1000);
}
await closeDb();
