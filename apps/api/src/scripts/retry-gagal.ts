import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { mulaiWorker } from "../antrean.js";
import { closeDb, db } from "../db/index.js";
import { sesi } from "../db/schema.js";

async function main() {
  console.log("=== MEMERIKSA SESI DENGAN STATUS GAGAL ATAU BERMASALAH ===");

  const daftarGagal = await db
    .select({
      id: sesi.id,
      uuid: sesi.uuid,
      judul: sesi.judul,
      status: sesi.status,
      percobaan: sesi.percobaan,
      galat: sesi.galat,
      createdAt: sesi.createdAt,
    })
    .from(sesi)
    .where(or(isNotNull(sesi.galat), inArray(sesi.status, ["gagal", "mentranskrip", "menganalisis"])))
    .orderBy(desc(sesi.id));

  if (daftarGagal.length === 0) {
    console.log("Tidak ada sesi yang berstatus gagal atau memiliki galat.");
    await closeDb();
    return;
  }

  console.log(`Ditemukan ${daftarGagal.length} sesi:`);
  for (const s of daftarGagal) {
    console.log(`- [#${s.id}] "${s.judul}" (${s.uuid})`);
    console.log(`  Status: ${s.status}, Percobaan: ${s.percobaan}`);
    console.log(`  Galat: ${s.galat || "(tidak ada pesan galat)"}`);
  }

  console.log("\n🔄 Mereset status sesi agar dapat diproses ulang oleh worker...");
  for (const s of daftarGagal) {
    await db
      .update(sesi)
      .set({
        status: s.status === "menganalisis" ? "menganalisis" : "mentranskrip",
        percobaan: 0,
        galat: null,
        cobaLagiSetelah: null,
        dikunciOleh: null,
        dikunciPada: null,
      })
      .where(eq(sesi.id, s.id));
    console.log(`  ✅ Sesi #${s.id} "${s.judul}" direset ke '${s.status === "menganalisis" ? "menganalisis" : "mentranskrip"}'.`);
  }

  console.log("\n🚀 Menjalankan worker pemrosesan transkripsi sekarang...");
  await mulaiWorker({ sekali: true, berhenti: () => false });

  console.log("\n✨ Pemrosesan antrean selesai!");
  await closeDb();
}

main().catch(async (err) => {
  console.error("Gagal menjalankan retry:", err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
