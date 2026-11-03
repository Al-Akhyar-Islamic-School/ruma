import type { AppType } from "@kalam/api/app";
import { type ClientResponse, hc } from "hono/client";
import type { ClientErrorStatusCode, ServerErrorStatusCode } from "hono/utils/http-status";

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/** `fetch` dengan cookie sesi (web dan API berbeda origin tetapi same-site). Dipakai juga untuk body biner/streaming. */
export const apiFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, { ...init, credentials: "include" });

/** Klien bertipe penuh dari rute Hono. Contoh: `ok(await api.sesi[":uuid"].$get({ param: { uuid } }))`. */
export const api = hc<AppType>(API_URL, { fetch: apiFetch });

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** Nilai field `error` dari body JSON API (mis. "perlu_persetujuan"), atau "http_<status>". */
    readonly kode: string,
    readonly body: unknown,
  ) {
    super(kode);
  }
}

/**
 * Mengembalikan body JSON respons sukses (bertipe), atau melempar `ApiError` untuk status non-2xx.
 * Gunakan ini untuk semua panggilan `api.*`.
 */
/** Body dari anggota respons yang bukan status galat (4xx/5xx). Status generik (mis. 200|404) tetap dihitung sukses. */
type Sukses<R> = R extends ClientResponse<infer T, infer S, any>
  ? [S] extends [ClientErrorStatusCode | ServerErrorStatusCode]
    ? never
    : T
  : never;

export async function ok<R extends ClientResponse<any, any, any>>(res: R): Promise<Sukses<R>> {
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* body bukan JSON */
    }
    const kode =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `http_${res.status}`;
    throw new ApiError(res.status, kode, body);
  }
  return res.json() as Promise<Sukses<R>>;
}

const PESAN: Record<string, string> = {
  unauthenticated: "Sesi login berakhir. Masuk lagi.",
  forbidden: "Anda tidak punya izin untuk tindakan ini.",
  not_found: "Data tidak ditemukan, atau Anda tidak punya akses.",
  perlu_persetujuan: "Anda belum punya izin merekam. Ajukan permintaan ke admin lebih dulu.",
  sesi_sudah_ditutup: "Sesi ini sudah ditutup.",
  melebihi_durasi_izin: "Durasi rekaman melebihi batas yang diizinkan.",
  chunk_tidak_lengkap: "Sebagian potongan audio belum terunggah.",
  kategori_pimpinan_hanya_orang_atau_grup: "Kategori rapat ini tertutup: hanya bisa dibuka untuk orang atau grup tertentu.",
  belum_disetujui: "Permintaan ini belum disetujui.",
  persetujuan_kedaluwarsa: "Persetujuan sudah kedaluwarsa. Ajukan permintaan baru.",
  persetujuan_sudah_dipakai: "Persetujuan ini sudah dipakai untuk satu sesi.",
  terlalu_banyak_permintaan_menunggu: "Terlalu banyak permintaan yang masih menunggu. Tunggu keputusan admin.",
  tidak_perlu_permintaan: "Anda sudah boleh merekam langsung tanpa permintaan.",
  kategori_sudah_ada: "Kategori dengan nama itu sudah ada.",
  kategori_tidak_valid: "Kategori tidak dikenal atau sudah dinonaktifkan.",
  modul_nonaktif: "Modul ini sedang dinonaktifkan oleh admin.",
  grup_tidak_ditemukan: "Grup tidak ditemukan, atau Anda bukan lagi anggotanya.",
  // Galat server tak terduga (mis. database belum dimigrasi). Bukan kesalahan pengguna: arahkan ke admin.
  server_error: "Server sedang bermasalah. Coba lagi sebentar; bila berulang, hubungi admin.",
  http_500: "Server sedang bermasalah. Coba lagi sebentar; bila berulang, hubungi admin.",
  http_502: "Server tidak bisa dijangkau. Coba lagi sebentar.",
  http_503: "Server sedang tidak tersedia. Coba lagi sebentar.",
};

/** Pesan galat berbahasa Indonesia untuk ditampilkan ke pengguna. */
export function pesanGalat(e: unknown): string {
  if (e instanceof ApiError) return PESAN[e.kode] ?? `Terjadi kesalahan (${e.kode}).`;
  if (e instanceof TypeError) return "Tidak bisa terhubung ke server. Periksa koneksi internet Anda.";
  return e instanceof Error ? e.message : "Terjadi kesalahan.";
}
