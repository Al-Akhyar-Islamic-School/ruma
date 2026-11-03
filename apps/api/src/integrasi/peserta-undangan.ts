import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { grup, grupAnggota, gtk, gtkUnit, sesiUndangan, users } from "../db/schema.js";

export interface PesertaInfo {
  nama: string;
  email: string;
}

/**
 * Mengambil daftar orang/peserta rapat dari undangan yang ada di database ruma.
 * Mencakup undangan tipe:
 * 1. "orang" -> email langsung + nama resmi GTK / nama user
 * 2. "grup" -> anggota-anggota grup tersebut
 * 3. "unit" -> seluruh GTK di unit tersebut
 */
export async function daftarPesertaDariUndangan(sesiId: number): Promise<PesertaInfo[]> {
  const undangan = await db
    .select({
      tipe: sesiUndangan.tipe,
      email: sesiUndangan.email,
      grupId: sesiUndangan.grupId,
      unit: sesiUndangan.unit,
    })
    .from(sesiUndangan)
    .where(eq(sesiUndangan.sesiId, sesiId));

  const emailSet = new Set<string>();

  // 1. Kumpulkan email langsung
  for (const u of undangan) {
    if (u.tipe === "orang" && u.email) {
      emailSet.add(u.email.toLowerCase());
    }
  }

  // 2. Kumpulkan email dari grup
  const grupIds = undangan.filter((u) => u.tipe === "grup" && u.grupId !== null).map((u) => u.grupId!);
  if (grupIds.length > 0) {
    const anggota = await db
      .select({ email: grupAnggota.email })
      .from(grupAnggota)
      .where(inArray(grupAnggota.grupId, grupIds));
    for (const a of anggota) {
      emailSet.add(a.email.toLowerCase());
    }
  }

  // 3. Kumpulkan email dari unit GTK
  const unitNames = undangan.filter((u) => u.tipe === "unit" && u.unit !== null).map((u) => u.unit!);
  if (unitNames.length > 0) {
    const gtkUnits = await db
      .select({ email: gtkUnit.email })
      .from(gtkUnit)
      .where(inArray(gtkUnit.unit, unitNames));
    for (const g of gtkUnits) {
      emailSet.add(g.email.toLowerCase());
    }
  }

  if (emailSet.size === 0) {
    return [];
  }

  const emails = [...emailSet];

  // Cari nama resmi dari GTK dan nama dari tabel users
  const [dataGtk, dataUsers] = await Promise.all([
    db.select({ email: gtk.email, namaResmi: gtk.namaResmi }).from(gtk).where(inArray(gtk.email, emails)),
    db.select({ email: users.email, name: users.name }).from(users).where(inArray(users.email, emails)),
  ]);

  const namaMap = new Map<string, string>();
  for (const u of dataUsers) {
    namaMap.set(u.email.toLowerCase(), u.name);
  }
  for (const g of dataGtk) {
    // Nama resmi GTK lebih diutamakan jika ada
    namaMap.set(g.email.toLowerCase(), g.namaResmi);
  }

  return emails.map((email) => ({
    email,
    nama: namaMap.get(email) || email,
  }));
}
