import { eq, ne } from "drizzle-orm";
import { db } from "./db/index.js";
import { pengaturan, permintaanSesi, sesi, users } from "./db/schema.js";

const KUNCI_MODUL_SUPERVISI = "modul_supervisi";

/** Modul supervisi kelas MATI secara default; superadmin menyalakannya di panel Pengaturan. */
export async function modulSupervisiAktif(): Promise<boolean> {
  const [r] = await db
    .select({ nilai: pengaturan.nilai })
    .from(pengaturan)
    .where(eq(pengaturan.kunci, KUNCI_MODUL_SUPERVISI))
    .limit(1);
  return r?.nilai === true;
}

export async function setModulSupervisi(aktif: boolean, oleh: number) {
  await db
    .insert(pengaturan)
    .values({ kunci: KUNCI_MODUL_SUPERVISI, nilai: aktif, diubahOleh: oleh })
    .onDuplicateKeyUpdate({ set: { nilai: aktif, diubahOleh: oleh } });
}

/** Siapa dan kapan terakhir mengubah saklar (null bila belum pernah diubah). */
export async function riwayatModulSupervisi() {
  const [r] = await db
    .select({ pada: pengaturan.updatedAt, oleh: users.name })
    .from(pengaturan)
    .leftJoin(users, eq(users.id, pengaturan.diubahOleh))
    .where(eq(pengaturan.kunci, KUNCI_MODUL_SUPERVISI))
    .limit(1);
  return r ?? null;
}

/**
 * Kondisi SQL untuk query sesi: saat modul supervisi mati, sesi supervisi TIDAK terlihat oleh siapa pun
 * (daftar, detail, hasil, audio). Datanya tetap utuh dan muncul lagi begitu modul dinyalakan.
 * `undefined` = tanpa filter (diabaikan oleh `and()` Drizzle).
 */
export async function filterModul() {
  return (await modulSupervisiAktif()) ? undefined : ne(sesi.tipeSesi, "supervisi_kelas");
}

/** Padanan `filterModul` untuk tabel permintaan sesi: permintaan supervisi disembunyikan saat modulnya mati. */
export async function filterModulPermintaan() {
  return (await modulSupervisiAktif()) ? undefined : ne(permintaanSesi.tipeSesi, "supervisi_kelas");
}
