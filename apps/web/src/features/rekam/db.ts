import { type DBSchema, type IDBPDatabase, openDB } from "idb";

/** `merekam`: potongan masih dikumpulkan / belum diselesaikan. `menunggu-kirim`: rekaman selesai di perangkat, tinggal dikirim. `selesai`: sudah diterima server. */
export type StatusLokal = "merekam" | "menunggu-kirim" | "selesai";

export type SesiLokal = {
  uuid: string;
  /** Pemilik rekaman (`me.id`); perangkat bersama tidak boleh menampilkan rekaman orang lain. */
  userId: number;
  judul: string;
  tipeSesi: "rapat" | "supervisi_kelas";
  audioMime: string;
  maksDurasiDetik: number | null;
  status: StatusLokal;
  /** Jumlah potongan yang sudah direkam (seq tertinggi + 1). */
  jumlahChunk: number;
  /** Detik rekam saat potongan terakhir tersimpan, atau durasi akhir setelah selesai. */
  durasiDetik: number;
  /** Detik rekam saat tombol Tandai ditekan. */
  penanda: number[];
  /** Epoch ms. */
  dibuat: number;
};

export type ChunkLokal = { uuid: string; seq: number; blob: Blob; ukuran: number; terunggah: boolean };

export type RingkasChunk = { seq: number; ukuran: number; terunggah: boolean };

interface KalamRekamDb extends DBSchema {
  sesi: { key: string; value: SesiLokal; indexes: { userId: number } };
  chunk: { key: [string, number]; value: ChunkLokal };
}

const NAMA_DB = "kalam-rekam";
const SIMPAN_SELESAI_MS = 30 * 24 * 3600 * 1000;

let dbPromise: Promise<IDBPDatabase<KalamRekamDb>> | null = null;

function db(): Promise<IDBPDatabase<KalamRekamDb>> {
  dbPromise ??= openDB<KalamRekamDb>(NAMA_DB, 1, {
    upgrade(d) {
      d.createObjectStore("sesi", { keyPath: "uuid" }).createIndex("userId", "userId");
      d.createObjectStore("chunk", { keyPath: ["uuid", "seq"] });
    },
  }).catch((e: unknown) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

const rentangChunk = (uuid: string) => IDBKeyRange.bound([uuid, 0], [uuid, Number.MAX_SAFE_INTEGER]);

export async function simpanSesiLokal(s: SesiLokal): Promise<void> {
  await (await db()).put("sesi", s);
}

/** Mengembalikan `null` bila tidak ada atau milik pengguna lain. */
export async function ambilSesiLokal(uuid: string, userId: number): Promise<SesiLokal | null> {
  const s = await (await db()).get("sesi", uuid);
  return s && s.userId === userId ? s : null;
}

/** Menambahkan catatan sesi hanya bila belum ada (tidak menimpa potongan/penanda yang sudah tercatat). */
export async function pastikanSesiLokal(s: SesiLokal): Promise<void> {
  const d = await db();
  const tx = d.transaction("sesi", "readwrite");
  if (!(await tx.store.get(s.uuid))) await tx.store.put(s);
  await tx.done;
}

/** Memperbarui sebagian bidang; tidak melakukan apa pun bila catatan tidak ada. */
export async function ubahSesiLokal(uuid: string, perubahan: Partial<Omit<SesiLokal, "uuid" | "userId">>): Promise<void> {
  const d = await db();
  const tx = d.transaction("sesi", "readwrite");
  const lama = await tx.store.get(uuid);
  if (lama) await tx.store.put({ ...lama, ...perubahan });
  await tx.done;
}

export async function simpanChunk(c: ChunkLokal): Promise<void> {
  await (await db()).put("chunk", c);
}

export async function ambilBlob(uuid: string, seq: number): Promise<Blob | null> {
  const c = await (await db()).get("chunk", [uuid, seq]);
  return c?.blob ?? null;
}

export async function tandaiTerunggah(uuid: string, seq: number): Promise<void> {
  const d = await db();
  const tx = d.transaction("chunk", "readwrite");
  const c = await tx.store.get([uuid, seq]);
  if (c && !c.terunggah) await tx.store.put({ ...c, terunggah: true });
  await tx.done;
}

/** Daftar potongan lokal terurut menurut seq, tanpa isi blob. */
export async function ringkasChunk(uuid: string): Promise<RingkasChunk[]> {
  const semua = await (await db()).getAll("chunk", rentangChunk(uuid));
  return semua.map((c) => ({ seq: c.seq, ukuran: c.ukuran, terunggah: c.terunggah }));
}

/** Menghapus blob audio lokal (catatan sesi tetap ada). */
export async function hapusChunkLokal(uuid: string): Promise<void> {
  await (await db()).delete("chunk", rentangChunk(uuid));
}

/** Menghapus catatan sesi beserta semua potongannya. */
export async function hapusSesiLokal(uuid: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(["sesi", "chunk"], "readwrite");
  await Promise.all([tx.objectStore("sesi").delete(uuid), tx.objectStore("chunk").delete(rentangChunk(uuid)), tx.done]);
}

/** Jumlah potongan berurutan dari seq 0 tanpa celah. Server menyambung potongan apa adanya, jadi celah tidak boleh ikut. */
export function awalanBerurutan(seqs: Iterable<number>): number {
  const ada = new Set(seqs);
  let n = 0;
  while (ada.has(n)) n++;
  return n;
}

export type ItemPemulihan = { sesi: SesiLokal; jumlah: number; belumTerunggah: number };

/** Rekaman milik `userId` yang punya potongan di perangkat tetapi belum diterima server sebagai sesi selesai. */
export async function daftarPemulihan(userId: number): Promise<ItemPemulihan[]> {
  const d = await db();
  const semua = await d.getAllFromIndex("sesi", "userId", userId);
  const batas = Date.now() - SIMPAN_SELESAI_MS;
  const hasil: ItemPemulihan[] = [];
  for (const sesi of semua) {
    if (sesi.status === "selesai") {
      if (sesi.dibuat < batas) await d.delete("sesi", sesi.uuid);
      continue;
    }
    const chunk = await ringkasChunk(sesi.uuid);
    if (chunk.length === 0) continue;
    hasil.push({ sesi, jumlah: chunk.length, belumTerunggah: chunk.filter((c) => !c.terunggah).length });
  }
  return hasil.sort((a, b) => b.sesi.dibuat - a.sesi.dibuat);
}
