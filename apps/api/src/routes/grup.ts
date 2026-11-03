import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthEnv } from "../auth/session.js";
import { db } from "../db/index.js";
import { grup, grupAnggota, gtk, users } from "../db/schema.js";
import { emailBaku } from "../validasi.js";

const MAX_ANGGOTA = 500;

const idParam = z.object({ id: z.coerce.number().int().positive() });
const body = z.object({
  nama: z.string().trim().min(1).max(100),
  anggota: z.array(emailBaku).min(1).max(MAX_ANGGOTA),
});

const milik = (ownerId: number, id: number) =>
  db.query.grup.findFirst({ where: and(eq(grup.id, id), eq(grup.ownerId, ownerId)) });

/** Grup undangan milik pribadi: dibuat sekali, dipakai di banyak sesi. */
export const grupRoutes = new Hono<AuthEnv>()
  .use(requireAuth)
  .get("/", async (c) => {
    const rows = await db
      .select({ id: grup.id, nama: grup.nama, jumlahAnggota: count(grupAnggota.email), updatedAt: grup.updatedAt })
      .from(grup)
      .leftJoin(grupAnggota, eq(grupAnggota.grupId, grup.id))
      .where(eq(grup.ownerId, c.var.user.id))
      .groupBy(grup.id)
      .orderBy(desc(grup.updatedAt));
    return c.json(rows);
  })
  // Grup milik orang lain yang menyertakan saya (baca-saja). Harus terdaftar sebelum "/:id".
  // Sengaja tanpa daftar anggota lain: anggota tahu grupnya dan siapa pemiliknya, bukan siapa saja teman sekelompoknya.
  .get("/keanggotaan", async (c) => {
    const rows = await db
      .select({
        id: grup.id,
        nama: grup.nama,
        pemilik: users.name,
        jumlahAnggota: sql<number>`(select count(*) from kalam_grup_anggota ga where ga.grup_id = ${grup.id})`.mapWith(Number),
      })
      .from(grupAnggota)
      .innerJoin(grup, eq(grup.id, grupAnggota.grupId))
      .innerJoin(users, eq(users.id, grup.ownerId))
      .where(and(eq(grupAnggota.email, c.var.user.email.toLowerCase()), ne(grup.ownerId, c.var.user.id)))
      .orderBy(grup.nama);
    return c.json(rows);
  })
  // Anggota keluar dari grup: hanya menghapus keanggotaan saya; grup dan anggota lain tidak berubah.
  // Akses ke rekaman yang diundang lewat grup ini ikut hilang.
  .delete("/keanggotaan/:id", zValidator("param", idParam), async (c) => {
    const [res] = await db
      .delete(grupAnggota)
      .where(and(eq(grupAnggota.grupId, c.req.valid("param").id), eq(grupAnggota.email, c.var.user.email.toLowerCase())));
    if (res.affectedRows === 0) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  })
  .get("/:id", zValidator("param", idParam), async (c) => {
    const g = await milik(c.var.user.id, c.req.valid("param").id);
    if (!g) return c.json({ error: "not_found" }, 404);
    const anggota = await db
      .select({ email: grupAnggota.email, namaResmi: gtk.namaResmi })
      .from(grupAnggota)
      .leftJoin(gtk, eq(gtk.email, grupAnggota.email))
      .where(eq(grupAnggota.grupId, g.id))
      .orderBy(grupAnggota.email);
    return c.json({ id: g.id, nama: g.nama, anggota });
  })
  .post("/", zValidator("json", body), async (c) => {
    const b = c.req.valid("json");
    const id = await db.transaction(async (tx) => {
      const [res] = await tx.insert(grup).values({ ownerId: c.var.user.id, nama: b.nama });
      await tx.insert(grupAnggota).values([...new Set(b.anggota)].map((email) => ({ grupId: res.insertId, email })));
      return res.insertId;
    });
    return c.json({ id }, 201);
  })
  // Mengganti nama dan seluruh anggota. Sesi yang sudah memakai grup ini otomatis mengikuti anggota terbaru.
  .put("/:id", zValidator("param", idParam), zValidator("json", body), async (c) => {
    const g = await milik(c.var.user.id, c.req.valid("param").id);
    if (!g) return c.json({ error: "not_found" }, 404);
    const b = c.req.valid("json");
    await db.transaction(async (tx) => {
      await tx.update(grup).set({ nama: b.nama }).where(eq(grup.id, g.id));
      await tx.delete(grupAnggota).where(eq(grupAnggota.grupId, g.id));
      await tx.insert(grupAnggota).values([...new Set(b.anggota)].map((email) => ({ grupId: g.id, email })));
    });
    return c.json({ id: g.id });
  })
  // Menghapus grup juga mencabut akses sesi yang diberikan lewat grup ini (FK cascade).
  .delete("/:id", zValidator("param", idParam), async (c) => {
    const g = await milik(c.var.user.id, c.req.valid("param").id);
    if (!g) return c.json({ error: "not_found" }, 404);
    await db.delete(grup).where(eq(grup.id, g.id));
    return c.json({ ok: true });
  });
