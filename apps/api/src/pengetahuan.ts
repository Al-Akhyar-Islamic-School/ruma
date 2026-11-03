import { and, desc, eq, ne, or, sql, type SQL } from "drizzle-orm";
import { diundang } from "./akses.js";
import { db } from "./db/index.js";
import { dokumen, sesi, transkrip, users, type User } from "./db/schema.js";

/**
 * Knowledge Management dasar: pencarian dan daftar keputusan lintas rapat.
 *
 * Aturan akses sama dengan membaca satu sesi (`findReadable`): perekam, yang diundang, atau superadmin;
 * dokumen berstatus `draf` hanya terlihat oleh perekam dan superadmin. Hanya sesi `rapat`: lembar supervisi
 * memuat penilaian individu guru dan suara murid, jadi tidak ikut diindeks lintas sesi.
 */

export type BagianCocok = "judul" | "keputusan" | "tugas" | "ringkasan" | "transkrip";
export type Cocok = { bagian: BagianCocok; cuplikan: string; detik: number | null };

export const MAKS_HASIL_CARI = 30;
export const MAKS_SESI_KEPUTUSAN = 100;

/** Rapat yang boleh dibaca `user`, selain yang masih direkam. */
export function rapatBolehDibaca(user: User): SQL {
  const akses = user.role === "superadmin" ? sql`true` : or(eq(sesi.userId, user.id), diundang(user));
  return and(eq(sesi.tipeSesi, "rapat"), ne(sesi.status, "merekam"), akses) as SQL;
}

/** Syarat join dokumen: draf tidak ikut bagi yang bukan perekam/superadmin (bukan sekadar disembunyikan di hasil). */
export function dokumenTerlihat(user: User): SQL {
  const bebas = user.role === "superadmin" ? sql`true` : eq(sesi.userId, user.id);
  return and(eq(dokumen.sesiId, sesi.id), or(bebas, eq(dokumen.statusVerifikasi, "disetujui"))) as SQL;
}

/** Kata kunci: dipisah spasi, maks 6, minimal 2 huruf. Semua kata harus muncul (boleh di bagian berbeda). */
export function pecahKata(q: string): string[] {
  return [...new Set(q.toLowerCase().split(/\s+/).filter((k) => k.length >= 2))].slice(0, 6);
}

const hindariWildcard = (k: string) => k.replace(/[\\%_]/g, (c) => `\\${c}`);

function kondisiKata(kata: string[]): SQL[] {
  return kata.map((k) => {
    const p = `%${hindariWildcard(k)}%`;
    return or(
      sql`${sesi.judul} like ${p}`,
      sql`cast(${dokumen.payload} as char) like ${p}`,
      sql`${transkrip.rawText} like ${p}`,
    ) as SQL;
  });
}

function cuplik(teks: string, kata: string[], lebar = 90): string | null {
  const rendah = teks.toLowerCase();
  let idx = -1;
  for (const k of kata) {
    const i = rendah.indexOf(k);
    if (i >= 0 && (idx < 0 || i < idx)) idx = i;
  }
  if (idx < 0) return null;
  const awal = Math.max(0, idx - lebar / 2);
  const akhir = Math.min(teks.length, idx + lebar * 1.5);
  return `${awal > 0 ? "…" : ""}${teks.slice(awal, akhir).replace(/\s+/g, " ").trim()}${akhir < teks.length ? "…" : ""}`;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];

/** Potongan teks yang cocok, berurutan menurut kegunaan: judul, keputusan, tugas, ringkasan, transkrip. */
export function kumpulkanCocok(judul: string, payload: Record<string, unknown> | null, rawText: string | null, kata: string[]): Cocok[] {
  const hasil: Cocok[] = [];
  const tambah = (bagian: BagianCocok, teks: string, detik: number | null = null) => {
    const c = cuplik(teks, kata);
    if (c) hasil.push({ bagian, cuplikan: c, detik });
  };
  tambah("judul", judul);
  if (payload) {
    for (const a of arr(payload.agenda_dan_keputusan)) {
      tambah("keputusan", [str(a.agenda), str(a.keputusan), str(a.pembahasan)].filter(Boolean).join(": "));
    }
    for (const t of arr(payload.action_items)) tambah("tugas", str(t.tugas));
    tambah("ringkasan", str(payload.ringkasan_eksekutif));
  }
  if (rawText) {
    let n = 0;
    for (const baris of rawText.split("\n")) {
      if (n >= 2) break;
      const m = /^\[(\d+):(\d\d):(\d\d)\]\s*(.*)$/.exec(baris);
      const isi = m ? (m[4] ?? "") : baris;
      const c = cuplik(isi, kata);
      if (c) {
        hasil.push({ bagian: "transkrip", cuplikan: c, detik: m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null });
        n++;
      }
    }
  }
  // Maks 5 cuplikan per rapat agar daftar hasil tetap ringkas.
  return hasil.slice(0, 5);
}

export async function cariRapat(user: User, q: string) {
  const kata = pecahKata(q);
  if (kata.length === 0) return { hasil: [], terpotong: false };
  const rows = await db
    .select({
      uuid: sesi.uuid,
      judul: sesi.judul,
      createdAt: sesi.createdAt,
      metadata: sesi.metadata,
      pemilik: users.name,
      payload: dokumen.payload,
      rawText: transkrip.rawText,
    })
    .from(sesi)
    .innerJoin(users, eq(users.id, sesi.userId))
    .leftJoin(dokumen, dokumenTerlihat(user))
    .leftJoin(transkrip, eq(transkrip.sesiId, sesi.id))
    .where(and(rapatBolehDibaca(user), ...kondisiKata(kata)))
    .orderBy(desc(sesi.createdAt))
    .limit(MAKS_HASIL_CARI + 1);
  return {
    terpotong: rows.length > MAKS_HASIL_CARI,
    hasil: rows.slice(0, MAKS_HASIL_CARI).map((r) => ({
      uuid: r.uuid,
      judul: r.judul,
      createdAt: r.createdAt,
      kategori: r.metadata.kategori ?? null,
      pemilik: r.pemilik,
      cocok: kumpulkanCocok(r.judul, r.payload, r.rawText, kata),
    })),
  };
}

export async function daftarKeputusan(user: User, cari?: string) {
  const rows = await db
    .select({ uuid: sesi.uuid, judul: sesi.judul, createdAt: sesi.createdAt, metadata: sesi.metadata, payload: dokumen.payload })
    .from(sesi)
    .innerJoin(dokumen, dokumenTerlihat(user))
    .where(rapatBolehDibaca(user))
    .orderBy(desc(sesi.createdAt))
    .limit(MAKS_SESI_KEPUTUSAN + 1);
  const kata = cari ? pecahKata(cari) : [];
  const items = rows.slice(0, MAKS_SESI_KEPUTUSAN).flatMap((r) =>
    arr(r.payload.agenda_dan_keputusan)
      .map((a) => ({
        uuid: r.uuid,
        judul: r.judul,
        // Tanggal rapat dari dokumen bila ada; selain itu tanggal sesi dibuat.
        tanggal: str(r.payload.tanggal) || r.createdAt.toISOString().slice(0, 10),
        kategori: r.metadata.kategori ?? null,
        agenda: str(a.agenda),
        keputusan: str(a.keputusan),
      }))
      .filter((x) => x.keputusan.trim() !== "")
      .filter((x) => kata.every((k) => `${x.agenda} ${x.keputusan} ${x.judul}`.toLowerCase().includes(k))),
  );
  return { items, terpotong: rows.length > MAKS_SESI_KEPUTUSAN };
}
