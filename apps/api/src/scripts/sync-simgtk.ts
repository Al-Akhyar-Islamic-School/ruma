import { closeDb } from "../db/index.js";
import { ambilDaftarGtk, hitungPerUnit, sinkronGtk } from "../simgtk.js";

// Pemakaian: pnpm sync:simgtk [--dry-run]. Jadwalkan lewat cron/systemd timer di VPS.
const dryRun = process.argv.includes("--dry-run");

try {
  if (dryRun) {
    const d = await ambilDaftarGtk();
    console.log({
      total: d.rows.size,
      perUnit: hitungPerUnit(d.rows.values()),
      tanpaEmail: d.tanpaEmail,
      elemenRusak: d.elemenRusak,
      unitTidakDikenal: d.unitTidakDikenal,
      catatan: "dry-run: tidak menulis ke database",
    });
  } else {
    console.log(await sinkronGtk());
  }
} finally {
  await closeDb();
}
