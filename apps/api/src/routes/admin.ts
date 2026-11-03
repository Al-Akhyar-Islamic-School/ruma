import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole, type AuthEnv } from "../auth/session.js";
import { db } from "../db/index.js";
import { permintaanSesi, PERMINTAAN_STATUS, ROLES, sesi, transkrip, users } from "../db/schema.js";
import { MODERATOR } from "../permissions.js";
import { SimgtkTidakDikonfigurasi, SinkronSedangBerjalan, sinkronGtk, statusGtk } from "../simgtk.js";

const WAKTU_PERSETUJUAN_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000;

const idParam = z.object({ id: z.coerce.number().int().positive() });

const putuskanBody = z.discriminatedUnion("keputusan", [
  z.object({
    keputusan: z.literal("disetujui"),
    durasi_diizinkan_menit: z.number().int().min(1).max(480),
    // Default 7 hari dari keputusan; persetujuan tidak berlaku selamanya.
    berlaku_sampai: z.iso.datetime().optional(),
    catatan: z.string().trim().max(500).optional(),
  }),
  z.object({ keputusan: z.literal("ditolak"), catatan: z.string().trim().min(1).max(500) }),
]);

const patchUserBody = z
  .object({ role: z.enum(ROLES), bisa_merekam: z.boolean() })
  .partial()
  .refine((v) => v.role !== undefined || v.bisa_merekam !== undefined, "tidak ada perubahan");

export const admin = new Hono<AuthEnv>()
  .use(requireAuth)

  // --- Moderasi permintaan sesi (admin & superadmin) ---
  .get(
    "/permintaan",
    requireRole(...MODERATOR),
    zValidator("query", z.object({ status: z.enum(PERMINTAAN_STATUS).default("menunggu") })),
    async (c) => {
      const rows = await db
        .select({
          permintaan: permintaanSesi,
          pemohon: { id: users.id, name: users.name, email: users.email },
        })
        .from(permintaanSesi)
        .innerJoin(users, eq(users.id, permintaanSesi.userId))
        .where(eq(permintaanSesi.status, c.req.valid("query").status))
        .orderBy(desc(permintaanSesi.createdAt))
        .limit(200);
      return c.json(rows);
    },
  )
  .post(
    "/permintaan/:id/putuskan",
    requireRole(...MODERATOR),
    zValidator("param", idParam),
    zValidator("json", putuskanBody),
    async (c) => {
      const { id } = c.req.valid("param");
      const b = c.req.valid("json");
      const p = await db.query.permintaanSesi.findFirst({ where: eq(permintaanSesi.id, id) });
      if (!p) return c.json({ error: "not_found" }, 404);

      const berlakuSampai =
        b.keputusan === "disetujui"
          ? new Date(b.berlaku_sampai ?? Date.now() + WAKTU_PERSETUJUAN_DEFAULT_MS)
          : null;
      if (berlakuSampai && berlakuSampai.getTime() <= Date.now()) {
        return c.json({ error: "berlaku_sampai_harus_di_masa_depan" }, 400);
      }

      // Guard status: dua admin memutuskan serentak, hanya yang pertama berhasil.
      const [res] = await db
        .update(permintaanSesi)
        .set({
          status: b.keputusan,
          durasiDiizinkanMenit: b.keputusan === "disetujui" ? b.durasi_diizinkan_menit : null,
          berlakuSampai,
          catatanAdmin: b.catatan ?? null,
          diputuskanOleh: c.var.user.id,
          diputuskanPada: new Date(),
        })
        .where(and(eq(permintaanSesi.id, id), eq(permintaanSesi.status, "menunggu")));
      if (res.affectedRows === 0) return c.json({ error: "sudah_diputuskan" }, 409);
      return c.json({ id, status: b.keputusan });
    },
  )

  // --- Kelola user (admin & superadmin) ---
  .get("/users", requireRole(...MODERATOR), async (c) => {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        bisaMerekam: users.bisaMerekam,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(users.name)
      .limit(500);
    return c.json(rows);
  })
  .patch(
    "/users/:id",
    requireRole(...MODERATOR),
    zValidator("param", idParam),
    zValidator("json", patchUserBody),
    async (c) => {
      const actor = c.var.user;
      const { id } = c.req.valid("param");
      const b = c.req.valid("json");
      const target = await db.query.users.findFirst({ where: eq(users.id, id) });
      if (!target) return c.json({ error: "not_found" }, 404);

      // superadmin hanya dari SUPERADMIN_EMAILS; admin hanya bisa diubah/diangkat oleh superadmin.
      if (target.role === "superadmin" || b.role === "superadmin") return c.json({ error: "forbidden" }, 403);
      if (actor.role !== "superadmin" && (MODERATOR.includes(target.role) || (b.role && MODERATOR.includes(b.role)))) {
        return c.json({ error: "forbidden" }, 403);
      }

      await db
        .update(users)
        .set({
          ...(b.role !== undefined && { role: b.role }),
          ...(b.bisa_merekam !== undefined && { bisaMerekam: b.bisa_merekam }),
        })
        .where(eq(users.id, id));
      return c.json({ id, ...b });
    },
  )

  // --- Superadmin: baca semua sesi ---
  .get(
    "/sesi",
    requireRole("superadmin"),
    zValidator("query", z.object({ user_id: z.coerce.number().int().positive().optional() })),
    async (c) => {
      const { user_id } = c.req.valid("query");
      const rows = await db
        .select({
          uuid: sesi.uuid,
          tipeSesi: sesi.tipeSesi,
          judul: sesi.judul,
          status: sesi.status,
          durasiDetik: sesi.durasiDetik,
          createdAt: sesi.createdAt,
          perekam: { id: users.id, name: users.name, email: users.email },
        })
        .from(sesi)
        .innerJoin(users, eq(users.id, sesi.userId))
        .where(user_id ? eq(sesi.userId, user_id) : undefined)
        .orderBy(desc(sesi.createdAt))
        .limit(200);
      return c.json(rows);
    },
  )

  // --- Direktori GTK dari SIM-GTK (admin & superadmin) ---
  .get("/gtk", requireRole(...MODERATOR), async (c) => c.json(await statusGtk()))
  .post("/gtk/sinkron", requireRole(...MODERATOR), async (c) => {
    try {
      return c.json(await sinkronGtk());
    } catch (e) {
      if (e instanceof SimgtkTidakDikonfigurasi) return c.json({ error: "simgtk_belum_dikonfigurasi" }, 503);
      if (e instanceof SinkronSedangBerjalan) return c.json({ error: "sinkron_sedang_berjalan" }, 409);
      console.error("sinkron SIM-GTK gagal", e);
      return c.json({ error: "sinkron_gagal", pesan: e instanceof Error ? e.message : String(e) }, 502);
    }
  })

  // --- Operasional antrean pemrosesan (admin & superadmin): hanya metadata, bukan isi rekaman ---
  .get("/antrean", requireRole(...MODERATOR), async (c) => {
    const rows = await db
      .select({
        uuid: sesi.uuid,
        tipeSesi: sesi.tipeSesi,
        judul: sesi.judul,
        status: sesi.status,
        percobaan: sesi.percobaan,
        galat: sesi.galat,
        cobaLagiSetelah: sesi.cobaLagiSetelah,
        createdAt: sesi.createdAt,
        perekam: { id: users.id, name: users.name },
      })
      .from(sesi)
      .innerJoin(users, eq(users.id, sesi.userId))
      .where(inArray(sesi.status, ["mentranskrip", "menganalisis", "gagal"]))
      .orderBy(desc(sesi.createdAt))
      .limit(200);
    return c.json(rows);
  })
  // Mengulang sesi yang gagal: lanjut dari tahap yang belum selesai (transkrip yang sudah ada tidak diulang).
  .post("/sesi/:uuid/ulangi", requireRole(...MODERATOR), zValidator("param", z.object({ uuid: z.uuid() })), async (c) => {
    const [s] = await db.select().from(sesi).where(eq(sesi.uuid, c.req.valid("param").uuid)).limit(1);
    if (!s) return c.json({ error: "not_found" }, 404);
    if (s.status !== "gagal") return c.json({ error: "sesi_tidak_gagal" }, 409);
    const [t] = await db.select({ id: transkrip.id }).from(transkrip).where(eq(transkrip.sesiId, s.id)).limit(1);
    await db
      .update(sesi)
      .set({
        status: t ? "menganalisis" : "mentranskrip",
        percobaan: 0,
        galat: null,
        cobaLagiSetelah: null,
        dikunciOleh: null,
        dikunciPada: null,
      })
      .where(and(eq(sesi.id, s.id), eq(sesi.status, "gagal")));
    return c.json({ uuid: s.uuid, status: t ? "menganalisis" : "mentranskrip" });
  });
