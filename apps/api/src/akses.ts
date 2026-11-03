import { and, eq, exists, inArray, or, sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { grupAnggota, gtkUnit, sesi, sesiUndangan, type User } from "./db/schema.js";
import { filterModul } from "./pengaturan.js";

/**
 * Kondisi SQL: `user` diundang ke sesi lewat salah satu dari empat jalur
 * (orang, grup, unit, seluruh organisasi). Dipakai di tiap query yang membaca sesi.
 *
 * Hanya untuk query core builder (`db.select().from(sesi)`). Query relasional (`db.query.sesi`) memberi alias
 * pada tabel sehingga referensi terkorelasi `kalam_sesi.id` gagal ("Unknown column").
 */
export function diundang(user: Pick<User, "email">) {
  const email = user.email.toLowerCase();
  const u = sesiUndangan;
  return exists(
    db
      .select({ x: sql`1` })
      .from(u)
      .where(
        and(
          eq(u.sesiId, sesi.id),
          or(
            eq(u.tipe, "organisasi"),
            and(eq(u.tipe, "orang"), eq(u.email, email)),
            and(
              eq(u.tipe, "grup"),
              inArray(u.grupId, db.select({ id: grupAnggota.grupId }).from(grupAnggota).where(eq(grupAnggota.email, email))),
            ),
            and(
              eq(u.tipe, "unit"),
              inArray(u.unit, db.select({ unit: gtkUnit.unit }).from(gtkUnit).where(eq(gtkUnit.email, email))),
            ),
          ),
        ),
      ),
  );
}

/** Mutasi (unggah, finish, undang) hanya oleh perekam. Sesi supervisi tak terlihat saat modulnya mati. */
export async function findOwn(user: User, uuid: string) {
  const [row] = await db
    .select()
    .from(sesi)
    .where(and(eq(sesi.uuid, uuid), eq(sesi.userId, user.id), await filterModul()))
    .limit(1);
  return row;
}

/**
 * Baca/dengar: perekam, yang diundang, atau superadmin. Admin biasa sengaja tidak termasuk: rekaman
 * kelas memuat suara murid (UU PDP) dan rapat bisa berlabel rahasia.
 */
export async function findReadable(user: User, uuid: string) {
  const [row] = await db
    .select()
    .from(sesi)
    .where(
      and(
        user.role === "superadmin"
          ? eq(sesi.uuid, uuid)
          : and(eq(sesi.uuid, uuid), or(eq(sesi.userId, user.id), diundang(user))),
        await filterModul(),
      ),
    )
    .limit(1);
  return row;
}
