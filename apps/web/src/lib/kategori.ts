import { queryOptions, useQuery } from "@tanstack/react-query";
import { api, ok } from "./api";

export type KategoriRapat = { id: number; kode: string; nama: string; terbatas: boolean; aktif: boolean };

/** Semua kategori, termasuk yang nonaktif (agar label sesi lama tetap terbaca). */
export const kategoriQuery = queryOptions({
  queryKey: ["kategori"],
  queryFn: async (): Promise<KategoriRapat[]> => ok(await api.kategori.$get()),
  staleTime: 5 * 60_000,
});

const KOSONG: KategoriRapat[] = [];

/** Daftar kategori; kosong selama memuat atau bila gagal dimuat (kategori bersifat opsional dan tidak boleh menghalangi). */
export function useKategori(): KategoriRapat[] {
  return useQuery(kategoriQuery).data ?? KOSONG;
}

/** Nama kategori untuk `kode`; bila belum dimuat atau tidak ada, pakai `kode` apa adanya. */
export function labelKategori(daftar: readonly KategoriRapat[], kode: string): string {
  return daftar.find((k) => k.kode === kode)?.nama ?? kode;
}

/** Hanya yang aktif: untuk pilihan saat membuat sesi atau permintaan baru. */
export const kategoriAktif = (daftar: readonly KategoriRapat[]): KategoriRapat[] => daftar.filter((k) => k.aktif);

/** Kategori tertutup: rapat hanya boleh dibuka untuk orang atau grup tertentu. */
export function kategoriTerbatas(daftar: readonly KategoriRapat[], kode: string | undefined): boolean {
  return kode !== undefined && (daftar.find((k) => k.kode === kode)?.terbatas ?? false);
}
