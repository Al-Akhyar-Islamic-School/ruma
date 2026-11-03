import { z } from "zod";
import { TIPE_SESI } from "./db/schema.js";
import { emailBaku } from "./validasi.js";

/** Isian sesi (PRD FR-02) yang dipakai bersama oleh pembuatan langsung dan permintaan moderasi. */
export const sesiSpecShape = {
  tipe_sesi: z.enum(TIPE_SESI),
  judul: z.string().trim().min(1).max(255),
  seri_id: z.number().int().positive().nullish(),
  metadata: z
    .object({
      // Kode `ruma_kategori_rapat`; keberadaan dan status aktifnya dicek di rute (butuh database).
      kategori: z.string().trim().min(1).max(40).optional(),
      // Guru yang disupervisi dipilih dari daftar GTK (SIM-GTK) lewat email; belum tentu pernah login.
      guruEmail: emailBaku.optional(),
      kelas: z.string().trim().max(100).optional(),
      mapel: z.string().trim().max(100).optional(),
      materi: z.string().trim().max(255).optional(),
    })
    .default({}),
};

type Spec = { tipe_sesi: (typeof TIPE_SESI)[number]; metadata: Record<string, unknown> };

/** Supervisi wajib menyebut guru, kelas, dan mapel. */
export function requireSupervisiMeta(v: Spec, ctx: z.RefinementCtx) {
  if (v.tipe_sesi !== "supervisi_kelas") return;
  for (const k of ["guruEmail", "kelas", "mapel"]) {
    if (v.metadata[k] === undefined) {
      ctx.addIssue({ code: "custom", path: ["metadata", k], message: "wajib untuk supervisi" });
    }
  }
}

export const audioMime = z
  .string()
  .regex(/^audio\/[\w.+-]+(;\s*codecs=[\w.,"-]+)?$/i)
  .max(100);
