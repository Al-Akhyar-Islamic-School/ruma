import { formatTanggal } from "@/lib/format";

/**
 * Pengakses defensif untuk payload dokumen. Payload dihasilkan AI dan hanya divalidasi longgar di server,
 * jadi setiap field bisa hilang atau bertipe lain. Semua fungsi di sini tidak melempar dan selalu
 * mengembalikan bentuk yang aman dirender (teks kosong, daftar kosong, atau null).
 */

export type Rekaman = Record<string, unknown>;

export function adalahRekaman(v: unknown): v is Rekaman {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** String (dipangkas) atau angka -> teks. Lainnya -> "". */
export function bacaTeks(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** Teks panjang: string, atau daftar string yang digabung per baris. */
export function bacaParagraf(v: unknown): string {
  if (Array.isArray(v)) return v.map(bacaTeks).filter(Boolean).join("\n");
  return bacaTeks(v);
}

export function bacaDaftarTeks(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(bacaTeks).filter(Boolean);
  const satu = bacaTeks(v);
  return satu ? [satu] : [];
}

/** Skor rubrik: bilangan 1-4, selain itu null (tidak teramati). */
export function bacaSkor(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  return Number.isFinite(n) && n >= 1 && n <= 4 ? n : null;
}

const pertama = (...kandidat: unknown[]): string => kandidat.map(bacaTeks).find(Boolean) ?? "";

/** "2026-11-03" -> "3 Nov 2026"; teks bebas dari AI ditampilkan apa adanya. */
export function tampilTanggal(s: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? formatTanggal(s) : s;
}

// --- Rapat ---

export type AgendaRapat = { agenda: string; pembahasan: string; keputusan: string };

export type DokumenRapat = {
  judul: string;
  tanggal: string;
  tempat: string;
  pemimpin: string;
  peserta: string[];
  ringkasan: string;
  agenda: AgendaRapat[];
};

export function bacaDokumenRapat(payload: unknown): DokumenRapat {
  const p: Rekaman = adalahRekaman(payload) ? payload : {};
  const meta: Rekaman = adalahRekaman(p.metadata) ? p.metadata : {};
  const peserta = bacaDaftarTeks(p.peserta_terdeteksi);
  const daftarAgenda = p.agenda_dan_keputusan ?? p.agenda_pembahasan;
  const agenda = (Array.isArray(daftarAgenda) ? daftarAgenda.filter(adalahRekaman) : [])
    .map((a) => ({
      agenda: pertama(a.agenda, a.topik),
      pembahasan: bacaParagraf(a.pembahasan),
      keputusan: bacaParagraf(a.keputusan),
    }))
    .filter((a) => a.agenda || a.pembahasan || a.keputusan);
  return {
    judul: pertama(p.judul_notulen, meta.judul_rapat),
    tanggal: tampilTanggal(pertama(p.tanggal, meta.tanggal)),
    tempat: pertama(p.tempat, meta.tempat),
    pemimpin: pertama(p.pemimpin_rapat, meta.pemimpin_rapat),
    peserta: peserta.length > 0 ? peserta : bacaDaftarTeks(meta.peserta_terdeteksi),
    ringkasan: bacaParagraf(p.ringkasan_eksekutif),
    agenda,
  };
}

// --- Supervisi ---

/**
 * Ambang label ringkasan skor. SEMENTARA: sekolah belum membakukan ambang ini; nilai di bawah hanyalah
 * usulan kerja dan harus diganti begitu rubrik resmi ditetapkan. Urut dari tertinggi; ambang dibandingkan
 * dengan rata-rata yang sudah dibulatkan satu desimal (sama dengan angka yang tampil di layar).
 */
export const AMBANG_LABEL_SKOR = [
  { min: 3.5, label: "Sangat baik" },
  { min: 2.5, label: "Baik" },
  { min: 1.5, label: "Cukup" },
] as const;
const LABEL_SKOR_TERENDAH = "Perlu pendampingan";

export const SKOR_MAKS = 4;

export type RingkasanSkor = { rata: number; label: string; teks: string };

export function labelSkor(rata: number): string {
  return AMBANG_LABEL_SKOR.find((a) => rata >= a.min)?.label ?? LABEL_SKOR_TERENDAH;
}

/** Rata-rata skor non-null; null bila tidak ada satu pun bagian yang teramati. */
export function hitungRingkasanSkor(skor: (number | null)[]): RingkasanSkor | null {
  const ada = skor.filter((s): s is number => s !== null);
  if (ada.length === 0) return null;
  const rata = Math.round((ada.reduce((a, b) => a + b, 0) / ada.length) * 10) / 10;
  const teks = rata.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return { rata, label: labelSkor(rata), teks: `${teks} / ${SKOR_MAKS}` };
}

export type BagianRubrik = {
  kunci: string;
  judul: string;
  skor: number | null;
  temuan: { label: string; teks: string }[];
  bukti: string[];
};

const DEFINISI_BAGIAN: readonly {
  kunci: string;
  judul: string;
  temuan: readonly (readonly [kunci: string, label: string])[];
}[] = [
  { kunci: "kegiatan_pendahuluan", judul: "Kegiatan awal", temuan: [["temuan_faktual", "Temuan"]] },
  {
    kunci: "kegiatan_inti",
    judul: "Kegiatan inti",
    temuan: [
      ["temuan_faktual", "Temuan"],
      ["penguasaan_materi", "Penguasaan materi"],
      ["pembelajaran_berdiferensiasi", "Pembelajaran berdiferensiasi"],
      ["interaksi_dan_keaktifan_murid", "Interaksi dan keaktifan murid"],
      ["keaktifan_siswa", "Keaktifan murid"],
    ],
  },
  { kunci: "kegiatan_penutup", judul: "Kegiatan penutup", temuan: [["temuan_faktual", "Temuan"]] },
];

export type DokumenSupervisi = {
  identitas: { label: string; nilai: string }[];
  ringkasanSkor: RingkasanSkor | null;
  bagian: BagianRubrik[];
  praktikBaik: string[];
  areaPengembangan: string[];
  pertanyaanReflektif: string[];
  catatanUmpanBalik: string;
};

export function bacaDokumenSupervisi(payload: unknown): DokumenSupervisi {
  const p: Rekaman = adalahRekaman(payload) ? payload : {};
  const meta: Rekaman = adalahRekaman(p.metadata) ? p.metadata : {};
  const rubrik: Rekaman = adalahRekaman(p.rubrik_observasi) ? p.rubrik_observasi : {};

  const durasi = bacaTeks(meta.durasi_menit);
  const identitas = [
    { label: "Guru", nilai: bacaTeks(meta.guru_yang_diobservasi) },
    { label: "Mata pelajaran", nilai: bacaTeks(meta.mata_pelajaran) },
    { label: "Kelas", nilai: bacaTeks(meta.kelas) },
    { label: "Materi", nilai: bacaTeks(meta.materi_pembelajaran) },
    { label: "Observer", nilai: bacaTeks(meta.observer) },
    { label: "Tanggal", nilai: tampilTanggal(bacaTeks(meta.tanggal_observasi)) },
    { label: "Durasi", nilai: durasi ? `${durasi} menit` : "" },
  ].filter((i) => i.nilai);

  const bagian = DEFINISI_BAGIAN.map<BagianRubrik>((d) => {
    const b: Rekaman = adalahRekaman(rubrik[d.kunci]) ? (rubrik[d.kunci] as Rekaman) : {};
    return {
      kunci: d.kunci,
      judul: d.judul,
      skor: bacaSkor(b.skor),
      temuan: d.temuan
        .map(([kunci, label]) => ({ label, teks: bacaParagraf(b[kunci]) }))
        .filter((t) => t.teks),
      bukti: bacaDaftarTeks(b.bukti_transkrip),
    };
  });

  return {
    identitas,
    ringkasanSkor: hitungRingkasanSkor(bagian.map((b) => b.skor)),
    bagian,
    praktikBaik: bacaDaftarTeks(p.praktik_baik_guru),
    areaPengembangan: bacaDaftarTeks(p.area_pengembangan),
    pertanyaanReflektif: bacaDaftarTeks(p.pertanyaan_reflektif),
    catatanUmpanBalik: bacaParagraf(p.draf_catatan_umpan_balik_kepsek),
  };
}

// --- Penanda waktu di dalam teks bukti ---

export type PotonganTeks = { jenis: "teks"; isi: string } | { jenis: "waktu"; label: string; detik: number };

/** `[HH:MM:SS]` atau `[MM:SS]`. */
const PENANDA_WAKTU = /\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]/g;

/** Memecah teks menjadi potongan biasa dan penanda waktu yang bisa dijadikan tombol lompat. */
export function potongPenandaWaktu(teks: string): PotonganTeks[] {
  const hasil: PotonganTeks[] = [];
  let akhir = 0;
  for (const m of teks.matchAll(PENANDA_WAKTU)) {
    const awal = m.index ?? 0;
    if (awal > akhir) hasil.push({ jenis: "teks", isi: teks.slice(akhir, awal) });
    const detik = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
    hasil.push({ jenis: "waktu", label: m[0].slice(1, -1), detik });
    akhir = awal + m[0].length;
  }
  if (akhir < teks.length) hasil.push({ jenis: "teks", isi: teks.slice(akhir) });
  return hasil;
}

// --- Tugas ---

export type TenggatPayload = { tugas: string; tenggat: string };

/**
 * Tenggat tertulis dari `payload.action_items`. Kolom tanggal di DB hanya menampung YYYY-MM-DD, sedangkan AI
 * sering menulis tenggat relatif ("Sebelum PTS", "Pekan depan"); teks aslinya hanya ada di payload.
 * Urutan daftar sama dengan payload sehingga bisa dipakai sebagai cadangan pencocokan menurut indeks.
 */
export function bacaTenggatPayload(payload: unknown): TenggatPayload[] {
  const daftar = adalahRekaman(payload) ? payload.action_items : null;
  if (!Array.isArray(daftar)) return [];
  return daftar.map((a) => {
    const item: Rekaman = adalahRekaman(a) ? a : {};
    return { tugas: bacaTeks(item.tugas), tenggat: bacaTeks(item.tenggat_waktu) };
  });
}

const normal = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Teks tenggat dari payload untuk tugas ke-`indeks`: cocokkan menurut isi tugas, cadangan menurut urutan. */
export function cariTenggatPayload(daftar: TenggatPayload[], tugas: string, indeks: number): string {
  const cocok = daftar.find((d) => d.tugas !== "" && normal(d.tugas) === normal(tugas));
  return (cocok ?? daftar[indeks])?.tenggat ?? "";
}

// --- Nama PIC dari AI -> kata kunci pencarian GTK ---

const SAPAAN_DEPAN = /^(?:(?:pak|bapak|bu|ibu|ust|ustadz|ustadzah|kak|kakak)\b\.?\s*)+/i;

/**
 * "Pak Ihwan" -> "Ihwan". Hanya nama pertama bila AI menulis beberapa orang ("Bu Rahma dan Pak Agung").
 * Hasil kosong berarti tidak ada kata kunci yang layak dicari.
 */
export function namaUntukPencarian(picNama: string): string {
  const pertamaSaja = picNama.split(/[,;&/]|\bdan\b/i)[0] ?? "";
  return pertamaSaja
    .trim()
    .replace(SAPAAN_DEPAN, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
