import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { api, ok } from "./api";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const res = await api.auth.me.$get();
    return res.status === 401 ? null : ok(res);
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

export type Me = ReturnType<typeof useMe>;
