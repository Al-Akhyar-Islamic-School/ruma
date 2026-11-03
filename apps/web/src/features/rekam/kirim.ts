import { ApiError, api, ok } from "@/lib/api";
import { hapusChunkLokal, ubahSesiLokal } from "./db";
import { type GalatUnggah, GalatUnggahError, galatTetapDariRespons, type PengunggahChunk } from "./unggah";

export type RencanaKirim = { jumlahChunk: number; durasiDetik: number; penanda: number[] };

export type TahapKirim = "mengunggah" | "mengirim";

/** Putaran unggah-ulang maksimum bila server terus melaporkan potongan hilang. */
const PUTARAN_MAKS = 3;

/** Rekaman tidak bisa diselesaikan dari perangkat ini (mis. potongan hilang); mengulang tidak membantu. */
export class TidakBisaDiselesaikanError extends Error {}

/** Galat yang tidak akan sembuh dengan mengulang; `null` berarti layak diulang (jaringan, 5xx). */
export function galatTetap(e: unknown): GalatUnggah | null {
  if (e instanceof GalatUnggahError) return e.galat;
  if (e instanceof TidakBisaDiselesaikanError) return { kode: "tidak_bisa_diselesaikan", pesan: e.message };
  if (e instanceof ApiError) return galatTetapDariRespons(e.status, e.kode);
  return null;
}

function bacaDaftarSeq(body: unknown, kunci: "missing" | "extra"): number[] {
  if (!body || typeof body !== "object" || !(kunci in body)) return [];
  const nilai = (body as Record<string, unknown>)[kunci];
  return Array.isArray(nilai) ? nilai.filter((n): n is number => typeof n === "number") : [];
}

/**
 * Menunggu antrean unggah kosong lalu memanggil `finish`. Bila server melaporkan potongan hilang (409 `chunk_tidak_lengkap`),
 * potongan itu diunggah ulang dari perangkat dan `finish` dicoba lagi.
 * Melempar `GalatUnggahError`/`ApiError` (galat tetap atau sementara), `TypeError` (jaringan), atau `Error` biasa.
 */
export async function kirimSampaiSelesai(
  uuid: string,
  rencana: RencanaKirim,
  pengunggah: PengunggahChunk,
  sinyal: { batal: boolean },
  saatTahap: (t: TahapKirim) => void,
): Promise<void> {
  for (let putaran = 0; ; putaran++) {
    saatTahap("mengunggah");
    await pengunggah.tunggu();
    if (sinyal.batal) return;
    saatTahap("mengirim");
    try {
      await ok(
        await api.sesi[":uuid"].finish.$post({
          param: { uuid },
          json: { jumlah_chunk: rencana.jumlahChunk, durasi_detik: rencana.durasiDetik, penanda_detik: rencana.penanda },
        }),
      );
      return;
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 409 && e.kode === "chunk_tidak_lengkap") || putaran >= PUTARAN_MAKS) throw e;
      if (bacaDaftarSeq(e.body, "extra").length > 0) {
        throw new TidakBisaDiselesaikanError("Server menyimpan potongan yang tidak cocok dengan rekaman di perangkat ini, jadi rekaman tidak bisa diselesaikan otomatis.");
      }
      for (const seq of bacaDaftarSeq(e.body, "missing")) {
        if (!(await pengunggah.punya(seq))) {
          throw new TidakBisaDiselesaikanError(`Potongan ${seq + 1} belum ada di server dan sudah tidak ada di perangkat ini, jadi rekaman tidak bisa diselesaikan.`);
        }
        pengunggah.ulang(seq);
      }
    }
  }
}

/** Setelah server menerima rekaman: buang blob lokal dan tandai selesai. Gagal membersihkan tidak menggagalkan pengiriman. */
export async function bersihkanSetelahSukses(uuid: string): Promise<void> {
  await hapusChunkLokal(uuid).catch(() => undefined);
  await ubahSesiLokal(uuid, { status: "selesai" }).catch(() => undefined);
}
