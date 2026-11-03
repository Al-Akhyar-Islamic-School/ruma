import { zValidator } from "@hono/zod-validator";
import { and, eq, exists, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { findOwn } from "../akses.js";
import type { AuthEnv } from "../auth/session.js";
import { db } from "../db/index.js";
import { grup, grupAnggota, gtk, sesiUndangan, UNIT } from "../db/schema.js";
import { kategoriByKode } from "../kategori.js";
import { emailBaku } from "../validasi.js";

const uuidParam = z.object({ uuid: z.uuid() });
const hapusParam = z.object({ uuid: z.uuid(), id: z.coerce.number().int().positive() });

const undangBody = z.discriminatedUnion("tipe", [
  z.object({ tipe: z.literal("orang"), emails: z.array(emailBaku).min(1).max(200) }),
  z.object({ tipe: z.literal("grup"), grup_id: z.number().int().positive() }),
  z.object({ tipe: z.literal("unit"), unit: z.enum(UNIT) }),
  z.object({ tipe: z.literal("organisasi") }),
]);

/**
 * Undangan sesi: siapa yang boleh mendengarkan dan membaca. Dipasang di dalam `sesiRoutes`
 * (sudah di belakang requireAuth). Hanya perekam yang boleh mengelola undangan.
 */
export const undanganRoutes = new Hono<AuthEnv>()
  .get("/:uuid/undangan", zValidator("param", uuidParam), async (c) => {
    const s = await findOwn(c.var.user, c.req.valid("param").uuid);
    if (!s) return c.json({ error: "not_found" }, 404);
    const u = sesiUndangan;
    const rows = await db
      .select({
        id: u.id,
        tipe: u.tipe,
        email: u.email,
        namaResmi: gtk.namaResmi,
        grupId: u.grupId,
        namaGrup: grup.nama,
        unit: u.unit,
        createdAt: u.createdAt,
      })
      .from(u)
      .leftJoin(gtk, eq(gtk.email, u.email))
      .leftJoin(grup, eq(grup.id, u.grupId))
      .where(eq(u.sesiId, s.id))
      .orderBy(u.id);
    return c.json(rows);
  })
  .post("/:uuid/undangan", zValidator("param", uuidParam), zValidator("json", undangBody), async (c) => {
    const user = c.var.user;
    const b = c.req.valid("json");
    const s = await findOwn(user, c.req.valid("param").uuid);
    if (!s) return c.json({ error: "not_found" }, 404);

    // ARCHITECTURE.md §5: rapat berkategori tertutup (mis. Pimpinan) tidak boleh terbuka untuk staf secara massal.
    if (s.metadata.kategori && (b.tipe === "unit" || b.tipe === "organisasi")) {
      const k = await kategoriByKode(s.metadata.kategori);
      if (k?.terbatas) return c.json({ error: "kategori_pimpinan_hanya_orang_atau_grup" }, 403);
    }

    const dasar = { sesiId: s.id, dibuatOleh: user.id };
    let rows: (typeof sesiUndangan.$inferInsert)[];
    switch (b.tipe) {
      case "orang": {
        // Perekam sudah punya akses penuh; undangan ke diri sendiri hanya noise.
        const emails = [...new Set(b.emails)].filter((e) => e !== user.email.toLowerCase());
        rows = emails.map((email) => ({ ...dasar, tipe: "orang", email, targetKey: `orang:${email}` }));
        break;
      }
      case "grup": {
        // Grup yang boleh dipakai: milik saya, atau grup yang menyertakan saya sebagai anggota.
        const [g] = await db
          .select({ id: grup.id })
          .from(grup)
          .where(
            and(
              eq(grup.id, b.grup_id),
              or(
                eq(grup.ownerId, user.id),
                exists(
                  db
                    .select({ x: sql`1` })
                    .from(grupAnggota)
                    .where(and(eq(grupAnggota.grupId, grup.id), eq(grupAnggota.email, user.email.toLowerCase()))),
                ),
              ),
            ),
          )
          .limit(1);
        if (!g) return c.json({ error: "grup_tidak_ditemukan" }, 404);
        rows = [{ ...dasar, tipe: "grup", grupId: g.id, targetKey: `grup:${g.id}` }];
        break;
      }
      case "unit":
        rows = [{ ...dasar, tipe: "unit", unit: b.unit, targetKey: `unit:${b.unit}` }];
        break;
      case "organisasi":
        rows = [{ ...dasar, tipe: "organisasi", targetKey: "organisasi" }];
        break;
    }
    if (rows.length === 0) return c.json({ ditambahkan: 0 });

    // IGNORE: undangan yang sama (unik per sesi + target) dilewati, bukan error.
    const [res] = await db.insert(sesiUndangan).ignore().values(rows);
    return c.json({ ditambahkan: res.affectedRows }, 201);
  })
  .delete("/:uuid/undangan/:id", zValidator("param", hapusParam), async (c) => {
    const { uuid, id } = c.req.valid("param");
    const s = await findOwn(c.var.user, uuid);
    if (!s) return c.json({ error: "not_found" }, 404);
    const [res] = await db
      .delete(sesiUndangan)
      .where(and(eq(sesiUndangan.id, id), eq(sesiUndangan.sesiId, s.id)));
    if (res.affectedRows === 0) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  });
