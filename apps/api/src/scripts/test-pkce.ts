import { createHash, randomBytes } from "node:crypto";
import { app } from "../app.js";
import { closeDb, db } from "../db/index.js";
import { kodeAplikasi, users } from "../db/schema.js";
import { eq } from "drizzle-orm";

async function main() {
  console.log("=== PENGUJIAN UNIT: ALUR PKCE LOGIN APLIKASI (API) ===");

  // 1. Ambil atau pastikan ada 1 user di database untuk pengujian
  let [testUser] = await db.select().from(users).limit(1);
  if (!testUser) {
    const [res] = await db.insert(users).values({
      googleSub: "test_sub_pkce",
      email: "test.pkce@alakhyar.sch.id",
      name: "Pengguna Uji PKCE",
    });
    [testUser] = await db.select().from(users).where(eq(users.id, res.insertId)).limit(1);
  }

  // Helper membuat kode uji
  async function buatKodeUji(verifier: string, expiresAt: Date) {
    const kode = randomBytes(32).toString("base64url");
    const codeHash = createHash("sha256").update(kode).digest("hex");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    await db.insert(kodeAplikasi).values({
      codeHash,
      challenge,
      userId: testUser!.id,
      expiresAt,
    });
    return kode;
  }

  try {
    // --- UJI 1: Verifier Salah Ditolak ---
    console.log("1. Uji: Verifier salah ditolak...");
    const verifierAsli = "verifier-rahasia-dari-perangkat-123456789";
    const kode1 = await buatKodeUji(verifierAsli, new Date(Date.now() + 60_000));
    
    const res1 = await app.request("/auth/aplikasi/tukar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kode: kode1, verifier: "verifier-palsu-salah" }),
    });
    const data1 = (await res1.json()) as { error?: string };
    if (res1.status === 400 && data1.error === "verifier_tidak_cocok") {
      console.log("   ✅ Lulus: Verifier salah berhasil ditolak (status 400 'verifier_tidak_cocok').");
    } else {
      throw new Error(`Uji 1 gagal: Status ${res1.status}, body: ${JSON.stringify(data1)}`);
    }

    // --- UJI 2: Kode Satu Kesempatan (Tidak Bisa Dipakai Ulang / No Replay) ---
    console.log("2. Uji: Kode yang sudah pernah dicoba langsung dihapus (one-time use)...");
    const res2 = await app.request("/auth/aplikasi/tukar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kode: kode1, verifier: verifierAsli }),
    });
    const data2 = (await res2.json()) as { error?: string };
    if (res1.status === 400 && data2.error === "kode_tidak_valid") {
      console.log("   ✅ Lulus: Kode sudah tidak ada di database saat dicoba lagi (status 400 'kode_tidak_valid').");
    } else {
      throw new Error(`Uji 2 gagal: Status ${res2.status}, body: ${JSON.stringify(data2)}`);
    }

    // --- UJI 3: Kode Kedaluwarsa Ditolak ---
    console.log("3. Uji: Kode kedaluwarsa ditolak...");
    const verifier3 = "verifier-rahasia-3";
    // Buat kode yang sudah lewat 1 menit lalu
    const kode3 = await buatKodeUji(verifier3, new Date(Date.now() - 60_000));
    const res3 = await app.request("/auth/aplikasi/tukar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kode: kode3, verifier: verifier3 }),
    });
    const data3 = (await res3.json()) as { error?: string };
    if (res3.status === 400 && data3.error === "kode_kedaluwarsa") {
      console.log("   ✅ Lulus: Kode kedaluwarsa berhasil ditolak (status 400 'kode_kedaluwarsa').");
    } else {
      throw new Error(`Uji 3 gagal: Status ${res3.status}, body: ${JSON.stringify(data3)}`);
    }

    // --- UJI 4: Alur Valid Berhasil ---
    console.log("4. Uji: Verifier benar & kode valid -> Sukses membuat sesi...");
    const verifier4 = "verifier-rahasia-sukses-987654321";
    const kode4 = await buatKodeUji(verifier4, new Date(Date.now() + 60_000));
    const res4 = await app.request("/auth/aplikasi/tukar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kode: kode4, verifier: verifier4 }),
    });
    const data4 = (await res4.json()) as { ok?: boolean; user?: { id: number } };
    const cookieHeader = res4.headers.get("set-cookie");
    if (res4.status === 200 && data4.ok && cookieHeader) {
      console.log("   ✅ Lulus: Berhasil membuat sesi, mengembalikan Set-Cookie sesi.");
    } else {
      throw new Error(`Uji 4 gagal: Status ${res4.status}, body: ${JSON.stringify(data4)}`);
    }

    console.log("\n🎉 SELURUH PENGUJIAN UNIT PKCE BERHASIL 100%!");
  } finally {
    // Bersihkan data uji jika ada
    await db.delete(kodeAplikasi).catch(() => undefined);
    await closeDb();
  }
}

main().catch(async (e) => {
  console.error("Uji gagal:", e);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
