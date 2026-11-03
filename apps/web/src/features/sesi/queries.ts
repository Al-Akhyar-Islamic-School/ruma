import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, ok } from "@/lib/api";

/** Selama status ini, worker server masih bekerja: poll sampai status akhir (selesai/gagal). */
const STATUS_DIPROSES = ["mentranskrip", "menganalisis"];
const INTERVAL_POLL_MS = 4000;

const ambilSesi = async (uuid: string) => ok(await api.sesi[":uuid"].$get({ param: { uuid } }));
const ambilTranskrip = async (uuid: string) => ok(await api.sesi[":uuid"].transkrip.$get({ param: { uuid } }));
const ambilDokumen = async (uuid: string) => ok(await api.sesi[":uuid"].dokumen.$get({ param: { uuid } }));

/** Bentuk respons sukses (200) dari rute server; diturunkan otomatis dari tipe Hono. */
export type DetailSesi = InferResponseType<(typeof api.sesi)[":uuid"]["$get"], 200>;
/** Keadaan worker/percobaan/progres selama sesi diproses (bagian dari respons detail sesi). */
export type PemrosesanSesi = DetailSesi["pemrosesan"];
export type DataTranskrip = InferResponseType<(typeof api.sesi)[":uuid"]["transkrip"]["$get"], 200>;
export type DataDokumen = InferResponseType<(typeof api.sesi)[":uuid"]["dokumen"]["$get"], 200>;

export const sesiQuery = (uuid: string) =>
  queryOptions({
    queryKey: ["sesi", uuid],
    queryFn: () => ambilSesi(uuid),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status && STATUS_DIPROSES.includes(status) ? INTERVAL_POLL_MS : false;
    },
  });

export const transkripQuery = (uuid: string, enabled: boolean) =>
  queryOptions({ queryKey: ["sesi", uuid, "transkrip"], queryFn: () => ambilTranskrip(uuid), enabled });

export const dokumenQuery = (uuid: string, enabled: boolean) =>
  queryOptions({ queryKey: ["sesi", uuid, "dokumen"], queryFn: () => ambilDokumen(uuid), enabled });
