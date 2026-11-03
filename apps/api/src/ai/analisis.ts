import { z } from "zod";
import type { TipeSesi } from "../db/schema.js";
import { env } from "../env.js";
import * as cloudflare from "./cloudflare.js";
import * as gemini from "./gemini.js";
import { ekstrakJson } from "./parser-json.js";
import { GalatLayanan } from "./layanan.js";
import { SYSTEM_RAPAT, SYSTEM_SUPERVISI } from "./prompts.js";

/**
 * Batas transkrip untuk cadangan Llama di Cloudflare. Perkiraan konservatif (±3 karakter/token, konteks model
 * 24k token termasuk prompt dan jawaban); di atas ini cadangan dilewati daripada memotong transkrip diam-diam.
 */
const BATAS_CADANGAN_KARAKTER = 40_000;

const skor = z.preprocess((v) => (v == null ? null : Number(v)), z.number().int().min(1).max(4).nullable());
const teks = z.string().default("");
const daftar = z.array(z.string()).default([]);

const skemaRapat = z.looseObject({
  judul_notulen: teks,
  tanggal: teks,
  tempat: teks,
  pemimpin_rapat: teks,
  peserta_terdeteksi: daftar,
  ringkasan_eksekutif: z.string().min(1),
  agenda_dan_keputusan: z
    .array(z.looseObject({ agenda: teks, pembahasan: teks, keputusan: teks }))
    .default([]),
  action_items: z
    .array(
      z.looseObject({
        no: z.number().optional(),
        tugas: z.string().min(1),
        pic: teks,
        tenggat_waktu: z.string().nullish(),
        status: z.string().default("pending"),
      }),
    )
    .default([]),
});

const skemaSupervisi = z.looseObject({
  rubrik_observasi: z.looseObject({
    kegiatan_pendahuluan: z.looseObject({ skor, temuan_faktual: teks, bukti_transkrip: daftar }),
    kegiatan_inti: z.looseObject({ skor, bukti_transkrip: daftar }),
    kegiatan_penutup: z.looseObject({ skor, temuan_faktual: teks, bukti_transkrip: daftar }),
  }),
  praktik_baik_guru: daftar,
  area_pengembangan: daftar,
  pertanyaan_reflektif: daftar,
  draf_catatan_umpan_balik_kepsek: teks,
});

export type HasilRapat = z.infer<typeof skemaRapat>;

export { ekstrakJson };

export type MasukanAnalisis = {
  tipe: TipeSesi;
  /** Objek konteks (judul, tanggal, guru, dst.) yang digabung dengan transkrip menjadi pesan user. */
  konteks: Record<string, string | undefined>;
  transkrip: string;
};

export type HasilAnalisis = { payload: Record<string, unknown>; model: string };

/** Gemini dulu; bila gagal (jaringan, gateway mati, JSON rusak) coba Llama di Cloudflare selama transkrip muat. */
export async function analisis(m: MasukanAnalisis): Promise<HasilAnalisis> {
  const sistem = m.tipe === "rapat" ? SYSTEM_RAPAT : SYSTEM_SUPERVISI;
  const skema = m.tipe === "rapat" ? skemaRapat : skemaSupervisi;
  const messages = [
    { role: "system" as const, content: sistem },
    { role: "user" as const, content: JSON.stringify({ ...m.konteks, transkrip_mentah: m.transkrip }) },
  ];

  const sumber = [
    { nama: env.GEMINI_MODEL, jalan: gemini.chat },
    ...(m.transkrip.length <= BATAS_CADANGAN_KARAKTER ? [{ nama: env.CF_LLM_MODEL, jalan: cloudflare.llm }] : []),
  ];

  const galat: string[] = [];
  for (const s of sumber) {
    try {
      const payload = skema.parse(ekstrakJson(await s.jalan(messages)));
      return { payload, model: s.nama };
    } catch (e) {
      galat.push(`${s.nama}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`analisis via ${s.nama} gagal`, e);
    }
  }
  throw new GalatLayanan(galat.join(" | "));
}
