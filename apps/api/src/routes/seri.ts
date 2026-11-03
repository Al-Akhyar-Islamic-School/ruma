import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthEnv } from "../auth/session.js";
import { db } from "../db/index.js";
import { seriRapat, sesi } from "../db/schema.js";

const buatSeriBody = z.object({
  nama: z.string().trim().min(1).max(255),
  deskripsi: z.string().trim().max(1000).optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

export const seriRapatRoutes = new Hono<AuthEnv>()
  .use(requireAuth)
  .get("/", async (c) => {
    const list = await db
      .select({
        id: seriRapat.id,
        nama: seriRapat.nama,
        deskripsi: seriRapat.deskripsi,
        googleDocsFileId: seriRapat.googleDocsFileId,
        googleDocsUrl: seriRapat.googleDocsUrl,
        createdAt: seriRapat.createdAt,
      })
      .from(seriRapat)
      .where(eq(seriRapat.ownerId, c.var.user.id))
      .orderBy(desc(seriRapat.updatedAt));
    return c.json(list);
  })
  .post("/", zValidator("json", buatSeriBody), async (c) => {
    const b = c.req.valid("json");
    const [res] = await db.insert(seriRapat).values({
      ownerId: c.var.user.id,
      nama: b.nama,
      deskripsi: b.deskripsi,
    });
    return c.json({ id: res.insertId, nama: b.nama }, 201);
  })
  .get("/:id", zValidator("param", idParam), async (c) => {
    const id = c.req.valid("param").id;
    const [item] = await db
      .select()
      .from(seriRapat)
      .where(and(eq(seriRapat.id, id), eq(seriRapat.ownerId, c.var.user.id)))
      .limit(1);
    if (!item) return c.json({ error: "not_found" }, 404);

    // Ambil daftar rapat di dalam seri ini
    const sesiList = await db
      .select({
        id: sesi.id,
        uuid: sesi.uuid,
        judul: sesi.judul,
        status: sesi.status,
        durasiDetik: sesi.durasiDetik,
        createdAt: sesi.createdAt,
      })
      .from(sesi)
      .where(eq(sesi.seriId, item.id))
      .orderBy(desc(sesi.createdAt));

    return c.json({ ...item, sesi: sesiList });
  });
