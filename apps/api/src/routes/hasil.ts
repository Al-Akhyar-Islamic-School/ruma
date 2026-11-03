import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { findOwn, findReadable } from "../akses.js";
import type { AuthEnv } from "../auth/session.js";
import { db } from "../db/index.js";
import { actionItems, dokumen, transkrip } from "../db/schema.js";
import { audioStorage } from "../storage.js";

const uuidParam = z.object({ uuid: z.uuid() });

const RANGE = /^bytes=(\d*)-(\d*)$/;

/** Mengirim berkas dari disk dengan dukungan Range (pemutar audio butuh ini untuk seek dan iOS Safari). */
async function kirimBerkas(berkas: string, rangeHeader: string | undefined, contentType: string) {
  let size: number;
  try {
    size = (await stat(berkas)).size;
  } catch {
    return Response.json({ error: "belum_tersedia" }, { status: 404 });
  }
  const dasar = { "content-type": contentType, "accept-ranges": "bytes", "cache-control": "private, no-store" };
  const stream = (opts?: { start: number; end: number }) =>
    Readable.toWeb(createReadStream(berkas, opts)) as unknown as ReadableStream;

  if (!rangeHeader) {
    return new Response(stream(), { headers: { ...dasar, "content-length": String(size) } });
  }
  const m = RANGE.exec(rangeHeader);
  let start = 0;
  let end = size - 1;
  if (m && (m[1] || m[2])) {
    if (m[1] === "") {
      start = Math.max(size - Number(m[2]), 0); // "bytes=-N": N byte terakhir
    } else {
      start = Number(m[1]);
      if (m[2]) end = Math.min(Number(m[2]), size - 1);
    }
  }
  if (!m || (!m[1] && !m[2]) || start > end || start >= size) {
    return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
  }
  return new Response(stream({ start, end }), {
    status: 206,
    headers: { ...dasar, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
  });
}

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
      .select()
      .from(actionItems)
      .where(eq(actionItems.dokumenId, d.id))
      .orderBy(asc(actionItems.id));
    return c.json({
      payload: d.payload,
      statusVerifikasi: d.statusVerifikasi,
      disetujuiPada: d.disetujuiPada,
      model: d.geminiModel,
      actionItems: items,
    });
  })
  // Perekam menyetujui draf AI: sejak itu dokumen terlihat oleh yang diundang.
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
  .get("/:uuid/audio", zValidator("param", uuidParam), async (c) => {
    const s = await findReadable(c.var.user, c.req.valid("param").uuid);
    if (!s) return c.json({ error: "not_found" }, 404);
    if (!s.audioPath) return c.json({ error: "belum_tersedia", status: s.status }, 404);
    return kirimBerkas(audioStorage.localPath(s.audioPath), c.req.header("range"), "audio/mpeg");
  });
