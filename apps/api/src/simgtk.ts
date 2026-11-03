import { count, lt, max, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db/index.js";
import { gtk, gtkUnit, UNIT, type Unit } from "./db/schema.js";
import { env } from "./env.js";

const BATCH = 500;

export class SimgtkTidakDikonfigurasi extends Error {
  constructor() {
    super("SIMGTK_API_URL / SIMGTK_TOKEN belum diisi");
  }
}
export class SinkronSedangBerjalan extends Error {}

// Kontrak (dari e-Rapor & SPMB): GET {url}/getGuruList -> [{id, name, email, kode_unit?, biodata: {kode_unit?, unit_kerja?: {kode}}}].
// Elemen rusak dibuang, bukan menggagalkan seluruh sinkronisasi.
const text = z.string().nullish().catch(undefined);
const item = z.looseObject({
  id: z.number().nullish().catch(undefined),
  name: text,
  email: text,
  kode_unit: text,
  biodata: z
    .looseObject({
      kode_unit: text,
      unit_kerja: z.looseObject({ kode: text }).nullish().catch(undefined),
    })
    .nullish()
    .catch(undefined),
});

/** SIM-GTK menamai TK sebagai "RA" (istilah Kemenag) di sebagian endpoint. */
const KODE_ALIAS: Record<string, string> = { RA: "TK" };

type Baris = { simgtkId: number | null; namaResmi: string; units: Set<Unit> };

export type DaftarGtk = {
  rows: Map<string, Baris>;
  tanpaEmail: number;
  elemenRusak: number;
  /** Kode unit SIM-GTK yang tidak termasuk TK/SD/SMP/SMA, beserta jumlahnya. */
  unitTidakDikenal: Record<string, number>;
};

export async function ambilDaftarGtk(): Promise<DaftarGtk> {
  if (!env.SIMGTK_API_URL || !env.SIMGTK_TOKEN) throw new SimgtkTidakDikonfigurasi();

  const res = await fetch(`${env.SIMGTK_API_URL}/getGuruList`, {
    headers: { authorization: `Bearer ${env.SIMGTK_TOKEN}`, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`SIM-GTK membalas HTTP ${res.status}`);
  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) throw new Error("respons SIM-GTK bukan array");

  const out: DaftarGtk = { rows: new Map(), tanpaEmail: 0, elemenRusak: 0, unitTidakDikenal: {} };
  for (const el of raw) {
    const parsed = item.safeParse(el);
    if (!parsed.success) {
      out.elemenRusak++;
      continue;
    }
    const g = parsed.data;
    const email = g.email?.trim().toLowerCase();
    if (!email) {
      out.tanpaEmail++;
      continue;
    }

    const row = out.rows.get(email) ?? { simgtkId: g.id ?? null, namaResmi: "", units: new Set<Unit>() };
    row.namaResmi ||= g.name?.trim() ?? "";
    out.rows.set(email, row);

    const kode = (g.kode_unit ?? g.biodata?.kode_unit ?? g.biodata?.unit_kerja?.kode ?? "").trim().toUpperCase();
    if (!kode) continue;
    const unit = KODE_ALIAS[kode] ?? kode;
    if ((UNIT as readonly string[]).includes(unit)) row.units.add(unit as Unit);
    else out.unitTidakDikenal[kode] = (out.unitTidakDikenal[kode] ?? 0) + 1;
  }
  return out;
}

export type HasilSinkron = {
  total: number;
  perUnit: Record<Unit, number>;
  dinonaktifkan: number;
  tanpaEmail: number;
  elemenRusak: number;
  unitTidakDikenal: Record<string, number>;
};

export const hitungPerUnit = (rows: Iterable<Baris>) => {
  const perUnit = Object.fromEntries(UNIT.map((u) => [u, 0])) as Record<Unit, number>;
  for (const r of rows) for (const u of r.units) perUnit[u]++;
  return perUnit;
};

let berjalan = false;

/**
 * Menyalin nama resmi dan unit GTK dari SIM-GTK. Hanya membaca SIM-GTK.
 * Semua-atau-tidak-sama-sekali: fetch selesai dulu, baru menulis dalam satu transaksi, dan daftar kosong
 * ditolak agar gangguan SIM-GTK tidak mengosongkan keanggotaan unit (dan mencabut akses undangan).
 */
export async function sinkronGtk(): Promise<HasilSinkron> {
  if (berjalan) throw new SinkronSedangBerjalan();
  berjalan = true;
  try {
    const d = await ambilDaftarGtk();
    if (d.rows.size === 0) throw new Error("SIM-GTK mengembalikan daftar kosong; sinkronisasi dibatalkan");

    // Detik bulat: kolom TIMESTAMP tanpa pecahan, supaya `synced_at < mulai` tidak menjerat baris yang baru ditulis.
    const mulai = new Date(Math.floor(Date.now() / 1000) * 1000);
    const baris = [...d.rows].map(([email, r]) => ({ email, ...r }));

    const dinonaktifkan = await db.transaction(async (tx) => {
      for (let i = 0; i < baris.length; i += BATCH) {
        await tx
          .insert(gtk)
          .values(
            baris.slice(i, i + BATCH).map((r) => ({
              email: r.email,
              simgtkId: r.simgtkId,
              namaResmi: r.namaResmi || r.email,
              aktif: true,
              syncedAt: mulai,
            })),
          )
          .onDuplicateKeyUpdate({
            set: {
              simgtkId: sql.raw("values(simgtk_id)"),
              namaResmi: sql.raw("values(nama_resmi)"),
              aktif: sql.raw("values(aktif)"),
              syncedAt: sql.raw("values(synced_at)"),
            },
          });
      }
      // Yang tidak muncul lagi di SIM-GTK (synced_at lama): nonaktif, keanggotaan unit dihapus di bawah.
      const [off] = await tx.update(gtk).set({ aktif: false }).where(lt(gtk.syncedAt, mulai));

      await tx.delete(gtkUnit);
      const units = baris.flatMap((r) => [...r.units].map((unit) => ({ email: r.email, unit })));
      for (let i = 0; i < units.length; i += BATCH) {
        await tx.insert(gtkUnit).values(units.slice(i, i + BATCH));
      }
      return off.affectedRows;
    });

    return {
      total: baris.length,
      perUnit: hitungPerUnit(d.rows.values()),
      dinonaktifkan,
      tanpaEmail: d.tanpaEmail,
      elemenRusak: d.elemenRusak,
      unitTidakDikenal: d.unitTidakDikenal,
    };
  } finally {
    berjalan = false;
  }
}

export async function statusGtk() {
  const [[tot], perUnit] = await Promise.all([
    db.select({ total: count(), terakhir: max(gtk.syncedAt) }).from(gtk),
    db.select({ unit: gtkUnit.unit, n: count() }).from(gtkUnit).groupBy(gtkUnit.unit),
  ]);
  return {
    dikonfigurasi: Boolean(env.SIMGTK_API_URL && env.SIMGTK_TOKEN),
    total: tot?.total ?? 0,
    terakhirSinkron: tot?.terakhir ?? null,
    perUnit: Object.fromEntries(perUnit.map((r) => [r.unit, r.n])),
  };
}

export type AgendaAcara = {
  id?: string | number;
  title: string;
  start_date: string;
  end_date: string;
  unit?: string;
  keterangan?: string;
};

/** Mengambil kalender akademik / agenda rapat dari SIMGTK (GET /calendar-academic) */
export async function ambilAgendaSimgtk(unit?: Unit): Promise<AgendaAcara[]> {
  if (!env.SIMGTK_API_URL) return [];

  const targetUnit = unit === "TK" ? "RA" : unit || "YPI";
  const url = `${env.SIMGTK_API_URL}/calendar-academic?unit=${encodeURIComponent(targetUnit)}`;

  try {
    const res = await fetch(url, {
      headers: env.SIMGTK_TOKEN ? { authorization: `Bearer ${env.SIMGTK_TOKEN}`, accept: "application/json" } : { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: unknown[] } | unknown[];
    const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    return items.map((it: any) => ({
      id: it.id,
      title: String(it.title || it.name || it.kegiatan || "Agenda Sekolah").trim(),
      start_date: String(it.start_date || it.tgl_mulai || "").trim(),
      end_date: String(it.end_date || it.tgl_selesai || it.start_date || "").trim(),
      unit: String(it.unit || targetUnit).trim(),
      keterangan: it.description ? String(it.description).trim() : undefined,
    }));
  } catch (e) {
    console.error("Gagal mengambil agenda SIMGTK:", e);
    return [];
  }
}
