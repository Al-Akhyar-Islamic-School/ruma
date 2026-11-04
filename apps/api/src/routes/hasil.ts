import { Readable } from "node:stream";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, getTableColumns, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { diundang, findOwn, findReadable } from "../akses.js";
import type { AuthEnv } from "../auth/session.js";
import { db } from "../db/index.js";
import { actionItems, dokumen, gtk, seriRapat, sesi, transkrip, users } from "../db/schema.js";
import { audioStorage } from "../storage.js";
import { emailBaku } from "../validasi.js";
import { statusDriveUser, urlOAuthDrive } from "../integrasi/google-auth.js";
import { eksporKeGoogleDocs, type DataNotulen } from "../integrasi/google-docs.js";
import { daftarPesertaDariUndangan } from "../integrasi/peserta-undangan.js";
import { kirimNotulenKeSimgtk } from "../integrasi/simgtk-agenda.js";
import { env } from "../env.js";

const uuidParam = z.object({ uuid: z.uuid() });
const tugasParam = z.object({ uuid: z.uuid(), id: z.coerce.number().int().positive() });


/**
 * Hasil pemrosesan sesi. Dipasang di dalam `sesiRoutes` (sudah di belakang requireAuth).
 * Baca: perekam, yang diundang, superadmin (`findReadable`). Dokumen berstatus draf hanya terlihat oleh
 * perekam dan superadmin sampai perekam menyetujuinya.
 */
export const hasilRoutes = new Hono<AuthEnv>()
  .get("/:uuid/transkrip", zValidator("param", uuidParam), async (c) => {
    const s = await findReadable(c.var.user, c.req.valid("param").uuid);
    if (!s) return c.json({ error: "not_found" }, 404);
    const [t] = await db.select().from(transkrip).where(eq(transkrip.sesiId, s.id)).limit(1);
    if (!t) return c.json({ error: "belum_tersedia", status: s.status }, 404);
    return c.json({ rawText: t.rawText, segments: t.segments, model: t.whisperModel });
  })
  .get("/:uuid/dokumen", zValidator("param", uuidParam), async (c) => {
    const user = c.var.user;
    const s = await findReadable(user, c.req.valid("param").uuid);
    if (!s) return c.json({ error: "not_found" }, 404);
    const [d] = await db.select().from(dokumen).where(eq(dokumen.sesiId, s.id)).limit(1);
    const pemilikAtauSuper = s.userId === user.id || user.role === "superadmin";
    if (!d || (d.statusVerifikasi === "draf" && !pemilikAtauSuper)) {
      return c.json({ error: "belum_tersedia", status: s.status }, 404);
    }
    const items = await db
      .select({ ...getTableColumns(actionItems), picNamaResmi: gtk.namaResmi })
      .from(actionItems)
      .leftJoin(gtk, eq(gtk.email, actionItems.picEmail))
      .where(eq(actionItems.dokumenId, d.id))
      .orderBy(asc(actionItems.id));
    return c.json({
      payload: d.payload,
      statusVerifikasi: d.statusVerifikasi,
      disetujuiPada: d.disetujuiPada,
      model: d.geminiModel,
      googleDocsUrl: d.googleDocsUrl ?? null,
      actionItems: items,
    });
  })
  .post("/:uuid/dokumen/setujui", zValidator("param", uuidParam), async (c) => {
    const s = await findOwn(c.var.user, c.req.valid("param").uuid);
    if (!s) return c.json({ error: "not_found" }, 404);
    const [res] = await db
      .update(dokumen)
      .set({ statusVerifikasi: "disetujui", disetujuiOleh: c.var.user.id, disetujuiPada: new Date() })
      .where(and(eq(dokumen.sesiId, s.id), eq(dokumen.statusVerifikasi, "draf")));
    if (res.affectedRows === 0) return c.json({ error: "tidak_ada_draf" }, 409);
    return c.json({ ok: true });
  })
  // Perekam menandai penanggung jawab (PIC) sebuah tugas dari direktori GTK. pic_email null = melepas tanda.
  .patch(
    "/:uuid/tugas/:id",
    zValidator("param", tugasParam),
    zValidator("json", z.object({ pic_email: emailBaku.nullable() })),
    async (c) => {
      const { uuid, id } = c.req.valid("param");
      const { pic_email } = c.req.valid("json");
      const s = await findOwn(c.var.user, uuid);
      if (!s) return c.json({ error: "not_found" }, 404);

      // Tugas harus milik dokumen sesi ini.
      const [item] = await db
        .select({ id: actionItems.id })
        .from(actionItems)
        .innerJoin(dokumen, eq(dokumen.id, actionItems.dokumenId))
        .where(and(eq(actionItems.id, id), eq(dokumen.sesiId, s.id)))
        .limit(1);
      if (!item) return c.json({ error: "not_found" }, 404);

      const [pengguna] = pic_email
        ? await db.select({ id: users.id }).from(users).where(eq(users.email, pic_email)).limit(1)
        : [];
      await db
        .update(actionItems)
        .set({ picEmail: pic_email, picUserId: pengguna?.id ?? null })
        .where(eq(actionItems.id, item.id));

      const [resmi] = pic_email
        ? await db.select({ nama: gtk.namaResmi }).from(gtk).where(eq(gtk.email, pic_email)).limit(1)
        : [];
      // Sudah bisakah orang itu membaca rekaman ini (perekam, atau diundang)? UI menawarkan undangan bila belum.
      let bisaMembaca: boolean | null = null;
      if (pic_email) {
        const [r] = await db
          .select({ id: sesi.id })
          .from(sesi)
          .where(and(eq(sesi.id, s.id), or(eq(sesi.userId, pengguna?.id ?? 0), diundang({ email: pic_email }))))
          .limit(1);
        bisaMembaca = Boolean(r);
      }
      return c.json({ id: item.id, picEmail: pic_email, picNamaResmi: resmi?.nama ?? null, bisaMembaca });
    },
  )
  .get("/:uuid/audio", zValidator("param", uuidParam), async (c) => {
    const s = await findReadable(c.var.user, c.req.valid("param").uuid);
    if (!s) return c.json({ error: "not_found" }, 404);
    if (!s.audioPath) return c.json({ error: "belum_tersedia", status: s.status }, 404);

    // Cek batas waktu retensi 90 hari (90 * 24 * 3600 * 1000 ms)
    const usiaMs = Date.now() - s.createdAt.getTime();
    const RETENSI_90_HARI_MS = 90 * 24 * 3600 * 1000;
    if (usiaMs > RETENSI_90_HARI_MS) {
      return c.json(
        {
          error: "audio_kedaluwarsa",
          pesan: "Audio rekaman telah kedaluwarsa sesuai kebijakan retensi 90 hari.",
        },
        410
      );
    }

    const range = c.req.header("range");
    const hasilStream = await audioStorage.getStream(s.audioPath, range);
    if (!hasilStream) {
      return c.json(
        {
          error: "audio_tidak_ditemukan",
          pesan: "Berkas audio tidak ditemukan di penyimpanan objek atau telah kedaluwarsa.",
        },
        410
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": hasilStream.contentType,
      "Accept-Ranges": "bytes",
      "Content-Length": String(hasilStream.contentLength),
      "Cache-Control": "private, max-age=3600",
    };
    if (hasilStream.contentRange) {
      headers["Content-Range"] = hasilStream.contentRange;
    }

    const webStream = Readable.toWeb(hasilStream.stream) as unknown as ReadableStream;
    return new Response(webStream, {
      status: hasilStream.statusCode,
      headers,
    });
  })
  // Status integrasi Google Docs untuk sesi ini
  .get("/:uuid/dokumen/google-docs/status", zValidator("param", uuidParam), async (c) => {
    const user = c.var.user;
    const s = await findReadable(user, c.req.valid("param").uuid);
    if (!s) return c.json({ error: "not_found" }, 404);
    const [d] = await db.select().from(dokumen).where(eq(dokumen.sesiId, s.id)).limit(1);
    const driveTersambung = await statusDriveUser(user.id);
    return c.json({
      driveTersambung,
      urlAuth: driveTersambung ? null : urlOAuthDrive(`sesi_${s.uuid}`),
      googleDocsUrl: d?.googleDocsUrl ?? null,
    });
  })
  // Ekspor notulen yang disetujui ke Google Docs
  .post("/:uuid/dokumen/google-docs/ekspor", zValidator("param", uuidParam), async (c) => {
    const user = c.var.user;
    const s = await findOwn(user, c.req.valid("param").uuid);
    if (!s) return c.json({ error: "not_found" }, 404);
    const [d] = await db.select().from(dokumen).where(eq(dokumen.sesiId, s.id)).limit(1);
    if (!d || d.statusVerifikasi !== "disetujui") {
      return c.json({ error: "dokumen_belum_disetujui" }, 400);
    }

    try {
      let fileIdToUse = d.googleDocsFileId;
      let isAppend = false;
      let namaSeri: string | undefined;

      // Cek apakah sesi ini bagian dari Seri Rapat berkala
      if (s.seriId) {
        const [seri] = await db.select().from(seriRapat).where(eq(seriRapat.id, s.seriId)).limit(1);
        if (seri) {
          namaSeri = seri.nama;
          if (seri.googleDocsFileId) {
            fileIdToUse = seri.googleDocsFileId;
            isAppend = true;
          }
        }
      }

      const pesertaUndangan = await daftarPesertaDariUndangan(s.id);
      const hasil = await eksporKeGoogleDocs(
        user.id,
        s.judul,
        d.payload as DataNotulen,
        fileIdToUse,
        pesertaUndangan,
        { isAppend, namaSeri }
      );

      await db
        .update(dokumen)
        .set({
          googleDocsFileId: hasil.fileId,
          googleDocsUrl: hasil.url,
        })
        .where(eq(dokumen.id, d.id));

      // Jika bagian dari seri, simpan juga berkas ini sebagai dokumen induk seri rapat
      if (s.seriId) {
        await db
          .update(seriRapat)
          .set({
            googleDocsFileId: hasil.fileId,
            googleDocsUrl: hasil.url,
          })
          .where(eq(seriRapat.id, s.seriId));
      }

      // Jika sesi ditautkan ke Agenda SIMGTK, kirim balik hasil notulen & tautan docs secara otomatis (Sync-back)
      if (s.simgtkAgendaId) {
        const payloadData = d.payload as DataNotulen;
        // Ambil daftar tugas dari tabel ruma_action_items agar pic_email yang sudah ditandai ikut terkirim
        const dbActionItems = await db
          .select({
            tugas: actionItems.tugas,
            detail: actionItems.detail,
            picEmail: actionItems.picEmail,
            picNama: actionItems.picNama,
            tenggatWaktu: actionItems.tenggatWaktu,
          })
          .from(actionItems)
          .where(eq(actionItems.dokumenId, d.id));

        // Ambil juga dari peserta rapat untuk mencocokkan nama jika pic_email belum ditandai manual
        const pesertas = await daftarPesertaDariUndangan(s.id);
        const cariEmailPeserta = (namaPic: string): string | null => {
          const n = namaPic.toLowerCase();
          const p = pesertas.find((item) => item.nama.toLowerCase().includes(n) || n.includes(item.nama.toLowerCase()));
          return p?.email || null;
        };

        const tindakLanjutList = (dbActionItems.length > 0 ? dbActionItems : (payloadData.action_items || []).map((t) => ({
          tugas: t.tugas,
          detail: (t as any).detail || null,
          picEmail: null,
          picNama: t.pic || "",
          tenggatWaktu: t.tenggat_waktu || null,
        }))).map((t) => ({
          deskripsi: t.tugas,
          detail: t.detail || (t.picNama ? `PIC: ${t.picNama}` : null),
          penanggung_jawab_email: t.picEmail || cariEmailPeserta(t.picNama) || user.email,
          tenggat: t.tenggatWaktu ?? null,
        }));
        const blokRingkasan: string[] = [];
        if (payloadData.ringkasan_eksekutif?.trim()) {
          blokRingkasan.push(payloadData.ringkasan_eksekutif.trim());
        }
        if (payloadData.agenda_dan_keputusan && payloadData.agenda_dan_keputusan.length > 0) {
          blokRingkasan.push("\n--- AGENDA & KEPUTUSAN ---");
          payloadData.agenda_dan_keputusan.forEach((item, idx) => {
            blokRingkasan.push(`\n${idx + 1}. ${item.agenda}`);
            if (item.pembahasan?.trim()) {
              blokRingkasan.push(`   Pembahasan: ${item.pembahasan.trim()}`);
            }
            if (item.keputusan?.trim()) {
              blokRingkasan.push(`   Keputusan: ${item.keputusan.trim()}`);
            }
          });
        }
        const teksRingkasanLengkap = blokRingkasan.join("\n").trim() || s.judul;

        void kirimNotulenKeSimgtk(s.simgtkAgendaId, {
          email: user.email,
          ringkasan: teksRingkasanLengkap,
          ruma_session_url: `${env.APP_URL}/sesi/${s.uuid}`,
          google_docs_url: hasil.url,
          tindak_lanjut: tindakLanjutList,
        }).catch((err) => {
          console.error(`Sync-back SIMGTK agenda ${s.simgtkAgendaId} gagal:`, err);
        });
      }


      return c.json({ ok: true, url: hasil.url });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 500);
    }
  });
