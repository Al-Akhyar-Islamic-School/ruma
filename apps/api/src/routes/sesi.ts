import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { requireAuth, type AuthEnv } from "../auth/session.js";
import { diundang, findOwn, findReadable } from "../akses.js";
import { db } from "../db/index.js";
import { audioChunks, sesi, users } from "../db/schema.js";
import { kategoriBolehDipilih } from "../kategori.js";
import { bisaBuatSesiLangsung } from "../permissions.js";
import { audioMime, requireSupervisiMeta, sesiSpecShape } from "../sesi-spec.js";
import { filterModul, modulSupervisiAktif, workerAktif } from "../pengaturan.js";
import { audioStorage, chunkKey } from "../storage.js";
import { hasilRoutes } from "./hasil.js";
import { undanganRoutes } from "./undangan.js";

// 30 detik Opus 32 kbps ≈ 120 KB; 2 MB memberi ruang lebar untuk bitrate/format lain.
const MAX_CHUNK_BYTES = 2 * 1024 * 1024;
const MAX_CHUNK_SEQ = 20_000;
// Panjang potongan rekaman klien (ARCHITECTURE.md §2.2). Dipakai menurunkan batas jumlah chunk dari batas durasi.
const CHUNK_SECONDS = 30;
/**
 * Toleransi setelah batas durasi yang disetujui: rapat sering molor, dan memotong rekaman di tengah rapat adalah
 * kerugian terbesar. Klien memperingatkan sebelum batas dan berhenti sendiri di batas + toleransi; server menjadi
 * pagar yang tak bisa dipalsukan di titik yang sama. Nilai yang sama ada di apps/web (`features/rekam/batas-durasi.ts`).
 */
const TOLERANSI_DURASI_DETIK = 15 * 60;

const createBody = z
  .object({ ...sesiSpecShape, audio_mime: audioMime })
  .superRefine(requireSupervisiMeta);

/** Jumlah chunk maksimum untuk batas durasi; +2 untuk chunk terakhir yang parsial dan jeda pause/resume. */
const maxChunks = (maksDurasiDetik: number) => Math.ceil((maksDurasiDetik + TOLERANSI_DURASI_DETIK) / CHUNK_SECONDS) + 2;

const uuidParam = z.object({ uuid: z.uuid() });
const chunkParam = z.object({
  uuid: z.uuid(),
  seq: z.coerce.number().int().min(0).max(MAX_CHUNK_SEQ),
});
const finishBody = z.object({
  jumlah_chunk: z.number().int().min(1).max(MAX_CHUNK_SEQ + 1),
  durasi_detik: z.number().int().min(0).max(24 * 3600),
  // Momen penting yang ditandai perekam (detik sejak awal rekaman); AI diminta memperhatikannya.
  penanda_detik: z.array(z.number().int().min(0).max(24 * 3600)).max(200).default([]),
});

export const sesiRoutes = new Hono<AuthEnv>()
  .use(requireAuth)
  .get("/", async (c) => {
    const rows = await db
      .select({
        uuid: sesi.uuid,
        tipeSesi: sesi.tipeSesi,
        judul: sesi.judul,
        status: sesi.status,
        durasiDetik: sesi.durasiDetik,
        createdAt: sesi.createdAt,
        metadata: sesi.metadata,
      })
      .from(sesi)
      .where(and(eq(sesi.userId, c.var.user.id), await filterModul()))
      .orderBy(desc(sesi.createdAt))
      .limit(100);
    return c.json(rows);
  })
  // Sesi milik orang lain yang mengundang saya (orang, grup, unit, atau seluruh organisasi).
  // Harus terdaftar sebelum "/:uuid".
  .get("/dibagikan", async (c) => {
    const rows = await db
      .select({
        uuid: sesi.uuid,
        tipeSesi: sesi.tipeSesi,
        judul: sesi.judul,
        status: sesi.status,
        durasiDetik: sesi.durasiDetik,
        createdAt: sesi.createdAt,
        metadata: sesi.metadata,
        perekam: { id: users.id, name: users.name },
      })
      .from(sesi)
      .innerJoin(users, eq(users.id, sesi.userId))
      .where(and(ne(sesi.userId, c.var.user.id), diundang(c.var.user), await filterModul()))
      .orderBy(desc(sesi.createdAt))
      .limit(100);
    return c.json(rows);
  })
  .post("/", zValidator("json", createBody), async (c) => {
    const user = c.var.user;
    const b = c.req.valid("json");
    if (!bisaBuatSesiLangsung(user)) {
      return c.json({ error: "perlu_persetujuan", petunjuk: "ajukan lewat POST /permintaan" }, 403);
    }
    if (b.tipe_sesi === "supervisi_kelas" && !(await modulSupervisiAktif())) {
      return c.json({ error: "modul_nonaktif", modul: "supervisi" }, 403);
    }
    if (!(await kategoriBolehDipilih(b.metadata.kategori))) {
      return c.json({ error: "kategori_tidak_valid" }, 422);
    }
    const uuid = crypto.randomUUID();
    await db.insert(sesi).values({
      uuid,
      userId: user.id,
      seriId: b.seri_id ?? null,
      simgtkAgendaId: b.simgtk_agenda_id ?? null,
      tipeSesi: b.tipe_sesi,
      judul: b.judul,
      audioMime: b.audio_mime,
      metadata: b.metadata,
    });
    return c.json({ uuid, status: "merekam" }, 201);
  })
  .get("/:uuid", zValidator("param", uuidParam), async (c) => {
    const s = await findReadable(c.var.user, c.req.valid("param").uuid);
    if (!s) return c.json({ error: "not_found" }, 404);
    // Klien memakai daftar seq ini untuk tahu chunk mana yang masih harus diunggah ulang.
    const chunks = await db
      .select({ seq: audioChunks.seq })
      .from(audioChunks)
      .where(eq(audioChunks.sesiId, s.id))
      .orderBy(asc(audioChunks.seq));
    const pemilik = s.userId === c.var.user.id;
    const diproses = s.status === "mentranskrip" || s.status === "menganalisis";
    return c.json({
      uuid: s.uuid,
      tipeSesi: s.tipeSesi,
      judul: s.judul,
      metadata: s.metadata,
      seriId: s.seriId,
      status: s.status,
      durasiDetik: s.durasiDetik,
      maksDurasiDetik: s.maksDurasiDetik,
      adalahPerekam: pemilik,
      audioTersedia: s.audioPath !== null,
      // Detail galat pemrosesan hanya untuk perekam; yang diundang tidak perlu melihatnya.
      galat: pemilik ? s.galat : null,
      // Keadaan pemrosesan supaya UI jujur: progres, percobaan ulang, dan apakah ada worker yang menjaga antrean.
      pemrosesan: {
        workerAktif: diproses ? await workerAktif() : null,
        percobaan: s.percobaan,
        cobaLagiSetelah: s.cobaLagiSetelah,
        progres:
          s.progresTotal !== null && s.progresSelesai !== null
            ? { selesai: s.progresSelesai, total: s.progresTotal }
            : null,
      },
      createdAt: s.createdAt,
      chunks: chunks.map((r) => r.seq),
    });
  })
  .put(
    "/:uuid/chunks/:seq",
    bodyLimit({ maxSize: MAX_CHUNK_BYTES, onError: (c) => c.json({ error: "chunk_too_large" }, 413) }),
    zValidator("param", chunkParam),
    async (c) => {
      const { uuid, seq } = c.req.valid("param");
      const s = await findOwn(c.var.user, uuid);
      if (!s) return c.json({ error: "not_found" }, 404);
      if (s.status !== "merekam") return c.json({ error: "sesi_sudah_ditutup" }, 409);
      if (s.maksDurasiDetik !== null && seq >= maxChunks(s.maksDurasiDetik)) {
        return c.json({ error: "melebihi_durasi_izin", maksDurasiDetik: s.maksDurasiDetik }, 409);
      }

      const data = new Uint8Array(await c.req.arrayBuffer());
      if (data.byteLength === 0) return c.json({ error: "chunk_kosong" }, 400);

      const key = chunkKey(uuid, seq);
      await audioStorage.put(key, data);
      // Idempotent: unggah ulang seq yang sama menimpa berkas dan ukuran.
      await db
        .insert(audioChunks)
        .values({ sesiId: s.id, seq, storageKey: key, sizeBytes: data.byteLength })
        .onDuplicateKeyUpdate({ set: { sizeBytes: data.byteLength } });
      return c.json({ seq, size: data.byteLength });
    },
  )
  .post("/:uuid/finish", zValidator("param", uuidParam), zValidator("json", finishBody), async (c) => {
    const { uuid } = c.req.valid("param");
    const { jumlah_chunk, durasi_detik, penanda_detik } = c.req.valid("json");
    const s = await findOwn(c.var.user, uuid);
    if (!s) return c.json({ error: "not_found" }, 404);
    if (s.status !== "merekam") return c.json({ error: "sesi_sudah_ditutup" }, 409);
    // durasi_detik dilaporkan klien; batas jumlah chunk di unggahan menjadi pagar yang tidak bisa dipalsukan.
    if (
      s.maksDurasiDetik !== null &&
      (durasi_detik > s.maksDurasiDetik + TOLERANSI_DURASI_DETIK || jumlah_chunk > maxChunks(s.maksDurasiDetik))
    ) {
      return c.json({ error: "melebihi_durasi_izin", maksDurasiDetik: s.maksDurasiDetik }, 409);
    }

    const chunks = await db
      .select({ seq: audioChunks.seq, size: audioChunks.sizeBytes })
      .from(audioChunks)
      .where(eq(audioChunks.sesiId, s.id));
    const have = new Set(chunks.map((r) => r.seq));
    const missing = Array.from({ length: jumlah_chunk }, (_, i) => i).filter((i) => !have.has(i));
    const extra = chunks.filter((r) => r.seq >= jumlah_chunk).map((r) => r.seq);
    if (missing.length || extra.length) return c.json({ error: "chunk_tidak_lengkap", missing, extra }, 409);

    const [res] = await db
      .update(sesi)
      .set({
        status: "mentranskrip",
        durasiDetik: durasi_detik,
        audioSizeBytes: chunks.reduce((n, r) => n + r.size, 0),
        metadata: penanda_detik.length ? { ...s.metadata, penanda: [...new Set(penanda_detik)].sort((a, b) => a - b) } : s.metadata,
      })
      .where(and(eq(sesi.id, s.id), eq(sesi.status, "merekam")));
    if (res.affectedRows === 0) return c.json({ error: "sesi_sudah_ditutup" }, 409);
    return c.json({ uuid, status: "mentranskrip" });
  })
  .route("/", undanganRoutes)
  .route("/", hasilRoutes);
