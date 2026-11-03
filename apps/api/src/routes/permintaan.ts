import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthEnv } from "../auth/session.js";
import { db } from "../db/index.js";
import { permintaanSesi, sesi } from "../db/schema.js";
import { bisaBuatSesiLangsung } from "../permissions.js";
import { kategoriBolehDipilih } from "../kategori.js";
import { audioMime, requireSupervisiMeta, sesiSpecShape } from "../sesi-spec.js";
import { filterModulPermintaan, modulSupervisiAktif } from "../pengaturan.js";

const MAX_MENUNGGU_PER_USER = 5;

const createBody = z
  .object({
    ...sesiSpecShape,
    alasan: z.string().trim().min(10).max(2000),
    durasi_menit: z.number().int().min(1).max(480),
  })
  .superRefine(requireSupervisiMeta);

const idParam = z.object({ id: z.coerce.number().int().positive() });

class PersetujuanDipakai extends Error {}

export const permintaanRoutes = new Hono<AuthEnv>()
  .use(requireAuth)
  .get("/", async (c) => {
    const rows = await db
      .select()
      .from(permintaanSesi)
      .where(and(eq(permintaanSesi.userId, c.var.user.id), await filterModulPermintaan()))
      .orderBy(desc(permintaanSesi.createdAt))
      .limit(100);
    return c.json(rows);
  })
  .post("/", zValidator("json", createBody), async (c) => {
    const user = c.var.user;
    if (bisaBuatSesiLangsung(user)) return c.json({ error: "tidak_perlu_permintaan" }, 409);
    if (c.req.valid("json").tipe_sesi === "supervisi_kelas" && !(await modulSupervisiAktif())) {
      return c.json({ error: "modul_nonaktif", modul: "supervisi" }, 403);
    }
    if (!(await kategoriBolehDipilih(c.req.valid("json").metadata.kategori))) {
      return c.json({ error: "kategori_tidak_valid" }, 422);
    }

    const [{ menunggu = 0 } = {}] = await db
      .select({ menunggu: sql<number>`count(*)` })
      .from(permintaanSesi)
      .where(and(eq(permintaanSesi.userId, user.id), eq(permintaanSesi.status, "menunggu")));
    if (Number(menunggu) >= MAX_MENUNGGU_PER_USER) {
      return c.json({ error: "terlalu_banyak_permintaan_menunggu" }, 409);
    }

    const b = c.req.valid("json");
    const [res] = await db.insert(permintaanSesi).values({
      userId: user.id,
      tipeSesi: b.tipe_sesi,
      judul: b.judul,
      metadata: b.metadata,
      alasan: b.alasan,
      durasiDimintaMenit: b.durasi_menit,
    });
    return c.json({ id: res.insertId, status: "menunggu" }, 201);
  })
  // Memakai persetujuan: membuat sesi dengan isian yang disetujui dan batas durasi dari admin.
  .post(
    "/:id/mulai",
    zValidator("param", idParam),
    zValidator("json", z.object({ audio_mime: audioMime })),
    async (c) => {
      const { id } = c.req.valid("param");
      const { audio_mime } = c.req.valid("json");
      const p = await db.query.permintaanSesi.findFirst({
        where: and(eq(permintaanSesi.id, id), eq(permintaanSesi.userId, c.var.user.id)),
      });
      if (!p) return c.json({ error: "not_found" }, 404);
      if (p.tipeSesi === "supervisi_kelas" && !(await modulSupervisiAktif())) {
        return c.json({ error: "modul_nonaktif", modul: "supervisi" }, 403);
      }
      if (p.status !== "disetujui" || p.durasiDiizinkanMenit === null) {
        return c.json({ error: "belum_disetujui", status: p.status }, 409);
      }
      if (p.sesiId !== null) return c.json({ error: "persetujuan_sudah_dipakai" }, 409);
      if (p.berlakuSampai && p.berlakuSampai.getTime() < Date.now()) {
        return c.json({ error: "persetujuan_kedaluwarsa" }, 409);
      }

      const uuid = crypto.randomUUID();
      try {
        await db.transaction(async (tx) => {
          const [ins] = await tx.insert(sesi).values({
            uuid,
            userId: p.userId,
            tipeSesi: p.tipeSesi,
            judul: p.judul,
            metadata: p.metadata,
            audioMime: audio_mime,
            maksDurasiDetik: p.durasiDiizinkanMenit! * 60,
          });
          // Klaim atomik: dua permintaan serentak, hanya satu yang berhasil mengisi sesi_id.
          const [claim] = await tx
            .update(permintaanSesi)
            .set({ sesiId: ins.insertId })
            .where(and(eq(permintaanSesi.id, p.id), isNull(permintaanSesi.sesiId)));
          if (claim.affectedRows === 0) throw new PersetujuanDipakai();
        });
      } catch (e) {
        if (e instanceof PersetujuanDipakai) return c.json({ error: "persetujuan_sudah_dipakai" }, 409);
        throw e;
      }
      return c.json({ uuid, status: "merekam", maksDurasiDetik: p.durasiDiizinkanMenit * 60 }, 201);
    },
  );
