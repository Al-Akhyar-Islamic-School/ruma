import { alasanTidakSiap, mulaiWorker } from "./antrean.js";
import { closeDb } from "./db/index.js";

/**
 * Worker sebagai proses sendiri (opsional; secara bawaan worker sudah berjalan di dalam proses API).
 *   pnpm worker          berjalan terus (systemd)
 *   pnpm worker --once   habiskan antrean lalu keluar (cron, uji)
 */
const alasan = await alasanTidakSiap();
if (alasan) {
  console.error(`worker menolak start: ${alasan}`);
  process.exit(1);
}

const sekali = process.argv.includes("--once");
let berhenti = false;
for (const sinyal of ["SIGINT", "SIGTERM"] as const) {
  // Selesaikan sesi yang sedang berjalan, jangan memotongnya di tengah.
  process.on(sinyal, () => (berhenti = true));
}

console.log(`worker mulai${sekali ? " (--once)" : ""}`);
await mulaiWorker({ sekali, berhenti: () => berhenti });
await closeDb();
