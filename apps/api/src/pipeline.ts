import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { analisis } from "./ai/analisis.js";
import { transkripsi, type HasilWhisper } from "./ai/cloudflare.js";
import { GalatPermanen } from "./ai/layanan.js";
import { daftarBagianLama, durasiDetik, keMp3, potongDiHening, sambung } from "./audio.js";
import { db } from "./db/index.js";
import { actionItems, audioChunks, dokumen, gtk, sesi, transkrip, users, type Segment } from "./db/schema.js";
import { env } from "./env.js";
import { audioStorage } from "./storage.js";
import { kategoriByKode } from "./kategori.js";
import { buangPengulangan, hms, susunTeks } from "./transkrip.js";

type Sesi = typeof sesi.$inferSelect;

// Sekolah di Makassar: tanggal dokumen mengikuti zona ini, bukan UTC server.
const ZONA = "Asia/Makassar";
const tanggalLokal = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: ZONA }).format(d);

/** Minimal teks bermakna agar transkrip dianggap berisi percakapan (bukan rekaman sunyi/derau). */
const MIN_KARAKTER_TRANSKRIP = 20;

/**
 * Tahap 1: potongan audio -> MP3 pemutar -> Whisper per bagian -> `kalam_transkrip`.
 * Dapat dilanjutkan: MP3 dan hasil Whisper per bagian di-cache di `<uuid>/work`, jadi percobaan ulang
 * tidak menghabiskan kuota Whisper untuk bagian yang sudah selesai.
 */
export async function tahapTranskripsi(s: Sesi) {
  const mulai = Date.now();
  const dir = audioStorage.localPath(`${s.uuid}/work`);
  await mkdir(dir, { recursive: true });

  const playbackKey = `${s.uuid}/playback.mp3`;
  const playback = audioStorage.localPath(playbackKey);
  if (!existsSync(playback)) {
    const chunks = await db
      .select({ key: audioChunks.storageKey })
      .from(audioChunks)
      .where(eq(audioChunks.sesiId, s.id))
      .orderBy(asc(audioChunks.seq));
    if (chunks.length === 0) throw new GalatPermanen("tidak ada potongan audio");

    const raw = path.join(dir, "audio.raw");
    await sambung(chunks.map((c) => audioStorage.localPath(c.key)), raw);
    const tmp = path.join(dir, "playback.tmp.mp3");
    await keMp3(raw, tmp);
    await rename(tmp, playback); // rename atomik: playback.mp3 ada = transkode selesai
    await rm(raw);
  }

  // Bersihkan potongan lama, lalu potong ulang tanpa transkode di titik hening (kalimat tidak terpotong).
  await Promise.all((await daftarBagianLama(dir)).map((f) => rm(f)));
  const bagian = await potongDiHening(playback, dir, env.WHISPER_SEGMENT_DETIK);
  await db.update(sesi).set({ progresSelesai: 0, progresTotal: bagian.length }).where(eq(sesi.id, s.id));

  // Garis waktu: durasi nyata tiap bagian (bukan asumsi N detik) supaya penanda waktu tidak bergeser.
  const semua: Segment[] = [];
  let offset = 0;
  for (const [i, berkas] of bagian.entries()) {
    const dur = await durasiDetik(berkas);
    // Kunci cache memuat durasi bagian: bila pemotongan berubah (panjang berbeda), cache lama tidak dipakai.
    const cache = path.join(dir, `whisper_${i}_${Math.round(dur * 1000)}.json`);
    let h: HasilWhisper;
    if (existsSync(cache)) {
      h = JSON.parse(await readFile(cache, "utf8")) as HasilWhisper;
    } else {
      h = await transkripsi(berkas);
      await writeFile(cache, JSON.stringify(h));
    }
    const segs = h.segments.length > 0 ? h.segments : h.text.trim() ? [{ start: 0, end: dur, text: h.text }] : [];
    for (const x of segs) {
      const text = x.text.trim();
      if (text) semua.push({ start: x.start + offset, end: x.end + offset, text });
    }
    offset += dur;
    await db.update(sesi).set({ progresSelesai: i + 1 }).where(eq(sesi.id, s.id));
  }

  const bersih = buangPengulangan(semua);
  const rawText = susunTeks(bersih);
  if (bersih.map((x) => x.text).join(" ").length < MIN_KARAKTER_TRANSKRIP) {
    throw new GalatPermanen("transkrip kosong: rekaman sunyi atau tidak terdengar");
  }

  await db.transaction(async (tx) => {
    const nilai = {
      sesiId: s.id,
      rawText,
      segments: bersih,
      whisperModel: env.WHISPER_MODEL,
      durasiTranskripMs: Date.now() - mulai,
    };
    await tx.insert(transkrip).values(nilai).onDuplicateKeyUpdate({ set: nilai });
    // Lanjut ke tahap 2 dengan kunci tetap dipegang; percobaan dihitung ulang untuk tahap baru.
    await tx
      .update(sesi)
      .set({
        status: "menganalisis",
        audioPath: playbackKey,
        durasiDetik: Math.round(offset),
        percobaan: 1,
        galat: null,
        progresSelesai: null,
        progresTotal: null,
      })
      .where(eq(sesi.id, s.id));
  });
  await rm(dir, { recursive: true, force: true });
}

const TANGGAL_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Tahap 2: transkrip -> Gemini (cadangan Llama) -> `kalam_dokumen` (+ `kalam_action_items` untuk rapat). */
export async function tahapAnalisis(s: Sesi) {
  const [tr] = await db.select().from(transkrip).where(eq(transkrip.sesiId, s.id)).limit(1);
  if (!tr) throw new Error("transkrip tidak ditemukan untuk sesi ini");

  const meta = s.metadata;
  const [perekam] = await db.select().from(users).where(eq(users.id, s.userId)).limit(1);
  const namaResmi = async (email?: string) =>
    email ? (await db.select().from(gtk).where(eq(gtk.email, email.toLowerCase())).limit(1))[0]?.namaResmi : undefined;
  const observer = (await namaResmi(perekam?.email)) ?? perekam?.name;
  const tanggal = tanggalLokal(s.createdAt);
  const durasiMenit = Math.round(s.durasiDetik / 60);
  // Momen yang ditandai perekam; AI diminta memberi perhatian khusus (PRD FR-04).
  const momenPenting = meta.penanda?.length ? meta.penanda.map(hms).join(", ") : undefined;

  let konteks: Record<string, string | undefined>;
  let metadata: Record<string, unknown>;
  let guruTargetId: number | null = null;

  if (s.tipeSesi === "rapat") {
    // AI membaca nama kategori ("Rapat komite"), bukan kodenya.
    const kategoriNama = meta.kategori ? ((await kategoriByKode(meta.kategori))?.nama ?? meta.kategori) : undefined;
    konteks = { judul_sesi: s.judul, tanggal, kategori_rapat: kategoriNama, momen_penting: momenPenting };
    metadata = { judul_rapat: s.judul, tanggal, durasi_menit: durasiMenit, kategori: meta.kategori ?? null };
  } else {
    const guru = (await namaResmi(meta.guruEmail)) ?? meta.guruEmail;
    konteks = {
      judul_sesi: s.judul,
      tanggal,
      guru,
      mata_pelajaran: meta.mapel,
      kelas: meta.kelas,
      materi_pembelajaran: meta.materi,
      momen_penting: momenPenting,
      observer,
    };
    metadata = {
      guru_yang_diobservasi: guru,
      guru_email: meta.guruEmail,
      mata_pelajaran: meta.mapel,
      kelas: meta.kelas,
      materi_pembelajaran: meta.materi,
      observer,
      tanggal_observasi: tanggal,
      durasi_menit: durasiMenit,
    };
    // Guru yang belum pernah login tidak punya baris users; tautannya terisi setelah ada.
    if (meta.guruEmail) {
      const [g] = await db.select({ id: users.id }).from(users).where(eq(users.email, meta.guruEmail)).limit(1);
      guruTargetId = g?.id ?? null;
    }
  }

  const hasil = await analisis({ tipe: s.tipeSesi, konteks, transkrip: tr.rawText });
  const payload = { tipe_sesi: s.tipeSesi, metadata, ...hasil.payload };

  await db.transaction(async (tx) => {
    const [ada] = await tx.select({ id: dokumen.id }).from(dokumen).where(eq(dokumen.sesiId, s.id)).limit(1);
    if (!ada) {
      const [ins] = await tx
        .insert(dokumen)
        .values({ sesiId: s.id, payload, guruTargetId, geminiModel: hasil.model });
      const items = s.tipeSesi === "rapat" ? ((hasil.payload.action_items as ActionItem[] | undefined) ?? []) : [];
      if (items.length > 0) {
        await tx.insert(actionItems).values(
          items.map((a) => ({
            dokumenId: ins.insertId,
            tugas: a.tugas,
            picNama: (a.pic || "-").slice(0, 150),
            // Tenggat relatif ("Sebelum PTS") tidak muat di kolom DATE; tetap ada di payload dokumen.
            tenggatWaktu:
              a.tenggat_waktu && TANGGAL_ISO.test(a.tenggat_waktu) && !Number.isNaN(Date.parse(a.tenggat_waktu))
                ? a.tenggat_waktu
                : null,
          })),
        );
      }
    }
    await tx.update(sesi).set({ status: "selesai", percobaan: 0, galat: null }).where(eq(sesi.id, s.id));
  });
}

type ActionItem = { tugas: string; pic?: string; tenggat_waktu?: string | null };
