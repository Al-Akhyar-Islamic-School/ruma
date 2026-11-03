import { setTimeout as tidur } from "node:timers/promises";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { alasanTidakSiap, mulaiWorker } from "./antrean.js";
import { purgeExpiredSessions } from "./auth/session.js";
import { closeDb } from "./db/index.js";
import { migrasiTertinggal } from "./db/migrasi.js";
import { env } from "./env.js";

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, (i) =>
  console.log(`kalam-api listening on ${i.address}:${i.port}`),
);

const purge = setInterval(() => void purgeExpiredSessions().catch(console.error), 60 * 60 * 1000);

// Kode yang lebih baru dari skema database gagal dengan 500 ("Unknown column"): beri tahu jelas saat start.
const tertinggal = await migrasiTertinggal().catch(() => null);
if (tertinggal) console.error(`\n[DB] ${tertinggal} migrasi BELUM diterapkan. Jalankan: pnpm db:migrate\n`);

// Worker pemrosesan (transkripsi + analisis) ikut berjalan di proses ini supaya tidak ada langkah terpisah yang
// terlupa. Matikan dengan WORKER_INLINE=false bila dijalankan sebagai proses sendiri (`pnpm worker`).
let berhenti = false;
let worker: Promise<void> = Promise.resolve();
if (env.WORKER_INLINE) {
  const alasan = await alasanTidakSiap();
  if (alasan) {
    console.warn(`[worker] TIDAK dijalankan (${alasan}). Sesi akan menunggu di "mentranskrip" sampai worker aktif.`);
  } else {
    console.log("[worker] berjalan di dalam proses API");
    worker = mulaiWorker({ berhenti: () => berhenti }).catch((e) => console.error("[worker] berhenti karena galat", e));
  }
} else {
  console.log("[worker] inline dimatikan (WORKER_INLINE=false): jalankan `pnpm worker` sebagai proses sendiri");
}

async function shutdown() {
  clearInterval(purge);
  berhenti = true;
  server.close();
  // Beri sesi yang sedang berjalan waktu menyelesaikan diri. Bila terpotong, kuncinya kedaluwarsa dan sesi diambil lagi.
  await Promise.race([worker, tidur(30_000)]);
  await closeDb();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
