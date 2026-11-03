import { zValidator } from "@hono/zod-validator";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole, type AuthEnv } from "../auth/session.js";
import { db } from "../db/index.js";
import { kategoriRapat } from "../db/schema.js";
import { daftarKategori, kodeKategoriUnik, namaKategoriAda } from "../kategori.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });
const nama = z.string().trim().min(1).max(100);

const tambahBody = z.object({ nama, terbatas: z.boolean().optional() });
const ubahBody = z
  .object({ nama, terbatas: z.boolean(), aktif: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "tidak ada perubahan");

/** Daftar kategori rapat: dibaca semua pengguna login (untuk pilihan dan label). */
export const kategoriRoutes = new Hono<AuthEnv>().use(requireAuth).get("/", async (c) => c.json(await daftarKategori()));

/** Kelola kategori rapat (hanya superadmin). Dipasang di bawah /admin/kategori. */
export const kategoriAdminRoutes = new Hono<AuthEnv>()
  .use(requireAuth, requireRole("superadmin"))
  .post("/", zValidator("json", tambahBody), async (c) => {
    const b = c.req.valid("json");
    if (await namaKategoriAda(b.nama)) return c.json({ error: "kategori_sudah_ada" }, 409);
    const kode = await kodeKategoriUnik(b.nama);
    const [agg] = await db
      .select({ maks: sql<number>`coalesce(max(${kategoriRapat.urutan}), 0)`.mapWith(Number) })
      .from(kategoriRapat);
    const [res] = await db
      .insert(kategoriRapat)
      .values({ kode, nama: b.nama, terbatas: b.terbatas ?? false, urutan: (agg?.maks ?? 0) + 1 });
    return c.json({ id: res.insertId, kode }, 201);
  })
  .patch("/:id", zValidator("param", idParam), zValidator("json", ubahBody), async (c) => {
    const { id } = c.req.valid("param");
    const b = c.req.valid("json");
    const [ada] = await db.select({ id: kategoriRapat.id }).from(kategoriRapat).where(eq(kategoriRapat.id, id)).limit(1);
    if (!ada) return c.json({ error: "not_found" }, 404);
    if (b.nama !== undefined && (await namaKategoriAda(b.nama, id))) return c.json({ error: "kategori_sudah_ada" }, 409);
    await db.update(kategoriRapat).set(b).where(eq(kategoriRapat.id, id));
    return c.json({ ok: true });
  });
