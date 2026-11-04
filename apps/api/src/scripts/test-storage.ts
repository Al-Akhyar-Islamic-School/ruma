import { audioStorage } from "../storage.js";
import { buatKlienR2 } from "../r2.js";
import { env } from "../env.js";

async function main() {
  console.log("=== PEMERIKSAAN STATUS PENYIMPANAN AUDIO ===");
  console.log(`Backend aktif: ${audioStorage.isR2 ? "Cloudflare R2" : "Disk Lokal (Fallback)"}`);
  console.log(`R2 Bucket: ${env.R2_BUCKET_NAME || "(belum diisi)"}`);
  console.log(`R2 Account ID: ${env.R2_ACCOUNT_ID || env.CF_ACCOUNT_ID || "(belum diisi)"}`);
  console.log(`R2 Access Key: ${env.R2_ACCESS_KEY_ID ? "Terisi (***)" : "(belum diisi)"}`);
  console.log(`R2 Secret Key: ${env.R2_SECRET_ACCESS_KEY ? "Terisi (***)" : "(belum diisi)"}`);

  if (!audioStorage.isR2) {
    console.log("\n⚠️  Mode saat ini: Fallback ke DiskStorage lokal (data disimpan di " + env.AUDIO_DIR + ").");
    console.log("Untuk mengaktifkan Cloudflare R2, isi variabel R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, dan R2_BUCKET_NAME di apps/api/.env");
    return;
  }

  console.log("\n⏳ Menguji koneksi Cloudflare R2...");
  const testKey = `__test__/ping-${Date.now()}.txt`;
  const testData = Buffer.from("Halo dari ruma. (Al Akhyar Audio Test)");

  try {
    // 1. Uji Upload (Put)
    console.log(`1. Mengunggah objek uji ke R2: ${testKey}`);
    await audioStorage.put(testKey, testData, "text/plain");
    console.log("   ✅ Upload sukses!");

    // 2. Uji Baca Aliran (Get Stream)
    console.log("2. Membaca objek uji dari R2...");
    const hasilStream = await audioStorage.getStream(testKey);
    if (!hasilStream) {
      throw new Error("Objek uji tidak ditemukan saat dibaca kembali dari R2.");
    }
    console.log(`   ✅ Stream sukses! Ukuran: ${hasilStream.contentLength} bytes, Status: ${hasilStream.statusCode}`);

    // 3. Uji Range Request (HTTP 206)
    console.log("3. Menguji HTTP Range Request (bytes=0-9)...");
    const rangeStream = await audioStorage.getStream(testKey, "bytes=0-9");
    if (!rangeStream || rangeStream.statusCode !== 206) {
      throw new Error("Range request gagal atau tidak mengembalikan status 206.");
    }
    console.log(`   ✅ Range request sukses! Content-Range: ${rangeStream.contentRange}`);

    // 4. Uji Hapus (Delete)
    console.log("4. Membersihkan objek uji dari R2...");
    await audioStorage.delete(testKey);
    console.log("   ✅ Hapus sukses!");

    console.log("\n🎉 SELURUH PENGUJIAN CLOUDFLARE R2 BERHASIL!");
  } catch (err) {
    console.error("\n❌ UJI KONEKSI R2 GAGAL:", err);
    process.exit(1);
  }
}

main().catch(console.error);
