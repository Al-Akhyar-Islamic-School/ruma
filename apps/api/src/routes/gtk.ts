import { zValidator } from "@hono/zod-validator";
import { and, eq, like, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthEnv } from "../auth/session.js";
import { db } from "../db/index.js";
import { gtk, gtkUnit, type Unit } from "../db/schema.js";

const query = z.object({ cari: z.string().trim().min(2).max(100) });
const MAKS_HASIL = 20;

/** Pencarian direktori GTK (hasil sinkron SIM-GTK) untuk pemilih guru dan undangan per orang. */
export const gtkRoutes = new Hono<AuthEnv>()
  .use(requireAuth)
  .get("/", zValidator("query", query), async (c) => {
    // Escape wildcard LIKE agar "%" atau "_" dari pengguna dicari sebagai huruf biasa.
    const pola = `%${c.req.valid("query").cari.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = await db
      .select({ email: gtk.email, namaResmi: gtk.namaResmi, unit: gtkUnit.unit })
      .from(gtk)
      .leftJoin(gtkUnit, eq(gtkUnit.email, gtk.email))
      .where(and(eq(gtk.aktif, true), or(like(gtk.namaResmi, pola), like(gtk.email, pola))))
      .orderBy(gtk.namaResmi)
      .limit(200);

    const per = new Map<string, { email: string; namaResmi: string; units: Unit[] }>();
    for (const r of rows) {
      const g = per.get(r.email) ?? { email: r.email, namaResmi: r.namaResmi, units: [] };
      if (r.unit) g.units.push(r.unit);
      per.set(r.email, g);
    }
    return c.json([...per.values()].slice(0, MAKS_HASIL));
  });
