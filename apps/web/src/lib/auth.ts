import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, ok } from "./api";

/** Respons `GET /auth/me` bila login; `null` bila belum (401). */
export type DataMe = InferResponseType<typeof api.auth.me.$get, 200> | null;

async function ambilMe(): Promise<DataMe> {
  const res = await api.auth.me.$get();
  return res.status === 401 ? null : ok(res);
}

/**
 * Salinan `me` terakhir yang berhasil diambil. Dipakai HANYA saat jaringan gagal (bukan 401/5xx), supaya perekam yang
 * sudah punya rekaman di perangkat tetap terbuka saat dimuat ulang tanpa sinyal (pemulihan setelah crash). Isinya
 * bukan rahasia (nama, email, peran, penanda fitur); cookie sesi tetap httpOnly dan server menegakkan semua izin.
 */
const KUNCI_CADANGAN_ME = "ruma.me";

function simpanCadangan(me: DataMe) {
  try {
    if (me) localStorage.setItem(KUNCI_CADANGAN_ME, JSON.stringify(me));
    else localStorage.removeItem(KUNCI_CADANGAN_ME);
  } catch {
    // Penyimpanan penuh atau diblokir: cadangan sekadar tidak ada.
  }
}

function bacaCadangan(): DataMe {
  try {
    const mentah = localStorage.getItem(KUNCI_CADANGAN_ME);
    return mentah ? (JSON.parse(mentah) as DataMe) : null;
  } catch {
    return null;
  }
}

/** Panggil saat keluar: jangan menyisakan identitas pengguna di perangkat bersama. */
export const hapusCadanganMe = () => simpanCadangan(null);

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    try {
      const me = await ambilMe();
      simpanCadangan(me); // null (401) menghapus cadangan
      return me;
    } catch (e) {
      if (e instanceof TypeError) {
        const cadangan = bacaCadangan();
        if (cadangan) return cadangan;
      }
      throw e;
    }
  },
  // Pendek: saklar modul (supervisi) diubah superadmin dan harus cepat terlihat oleh pengguna lain.
  staleTime: 60_000,
  retry: false,
});

/** Pengguna yang sedang login. Hanya dipakai di dalam rute `_app` (sudah dijaga: pasti login). */
export function useMe() {
  const { data } = useSuspenseQuery(meQuery);
  if (!data) throw new Error("Belum login");
  return data;
}

export type Me = NonNullable<DataMe>;
