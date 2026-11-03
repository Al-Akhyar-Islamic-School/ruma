import { zValidator } from "@hono/zod-validator";
import { and, eq, like, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthEnv } from "../auth/session.js";
import { db } from "../db/index.js";
import { gtk, gtkUnit, users, type Unit } from "../db/schema.js";

const query = z.object({ cari: z.string().trim().min(2).max(100) });
const MAKS_HASIL = 20;

type Orang = { email: string; namaResmi: string; units: Unit[]; sumber: "gtk" | "pengguna" };

/** Escape wildcard LIKE agar "%" atau "_" dari pengguna dicari sebagai huruf biasa. */
const polaCari = (cari: string) => `%${cari.replace(/[\\%_]/g, "\\$&")}%`;

async function cariGtk(pola: string): Promise<Orang[]> {
  const rows = await db
    .select({ email: gtk.email, namaResmi: gtk.namaResmi, unit: gtkUnit.unit })
    .from(gtk)
    .leftJoin(gtkUnit, eq(gtkUnit.email, gtk.email))
    .where(and(eq(gtk.aktif, true), or(like(gtk.namaResmi, pola), like(gtk.email, pola))))
    .orderBy(gtk.namaResmi)
    .limit(200);

  const per = new Map<string, Orang>();
  for (const r of rows) {
    const g = per.get(r.email) ?? { email: r.email, namaResmi: r.namaResmi, units: [], sumber: "gtk" as const };
    if (r.unit) g.units.push(r.unit);
    per.set(r.email, g);
  }
  return [...per.values()];
}

/**
 * Pencarian orang untuk pemilih: direktori GTK (hasil sinkron SIM-GTK) saja, atau (`/orang`) digabung dengan
 * pengguna yang sudah pernah masuk ke aplikasi tetapi tidak ada di direktori GTK (mis. akun admin atau akun baru).
 * Semua pemanggil sudah login dengan akun Workspace sekolah; GTK sudah terbuka untuk mereka, jadi daftar pengguna
 * tidak membuka hal baru selain nama dan email sesama akun sekolah.
 */
export const gtkRoutes = new Hono<AuthEnv>()
  .use(requireAuth)
  .get("/", zValidator("query", query), async (c) => {
    const daftar = await cariGtk(polaCari(c.req.valid("query").cari));
    return c.json(daftar.slice(0, MAKS_HASIL));
  })
  .get("/orang", zValidator("query", query), async (c) => {
    const pola = polaCari(c.req.valid("query").cari);
    const daftar = await cariGtk(pola);
    const sudah = new Set(daftar.map((o) => o.email.toLowerCase()));

    const pengguna = await db
      .select({ email: users.email, nama: users.name })
      .from(users)
      .where(or(like(users.name, pola), like(users.email, pola)))
      .orderBy(users.name)
      .limit(50);
    for (const u of pengguna) {
      const email = u.email.toLowerCase();
      if (sudah.has(email)) continue; // entri GTK lebih lengkap (nama resmi + unit)
      sudah.add(email);
      daftar.push({ email, namaResmi: u.nama, units: [], sumber: "pengguna" });
    }
    daftar.sort((a, b) => a.namaResmi.localeCompare(b.namaResmi, "id"));
    return c.json(daftar.slice(0, MAKS_HASIL));
  });
