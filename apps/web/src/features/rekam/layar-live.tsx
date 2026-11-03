import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { LoaderCircleIcon } from "lucide-react";
import { ErrorNotice } from "@/components/app/feedback";
import { Button } from "@/components/ui/button";
import { ApiError, api, ok } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { labelKategori, useKategori } from "@/lib/kategori";
import { ambilSesiLokal, hapusSesiLokal, ringkasChunk, type SesiLokal } from "./db";
import { KerangkaGelap } from "./kerangka";
import { LayarModulNonaktif } from "./layar-modul-nonaktif";
import { LayarPemulihan } from "./layar-pemulihan";
import { LayarRekam } from "./layar-rekam";
import { pilihMimeRekam } from "./mime";

const ambilSesiServer = async (uuid: string) => ok(await api.sesi[":uuid"].$get({ param: { uuid } }));
type SesiServer = Awaited<ReturnType<typeof ambilSesiServer>>;

type Awal = { server: SesiServer | null; lokal: SesiLokal | null; jumlahChunkLokal: number; supervisiTidakTersedia: boolean };

type Meta = { kelas?: string; mapel?: string; kategori?: string };

const bacaMeta = (m: unknown): Meta => (m && typeof m === "object" ? (m as Meta) : {});

/**
 * Memuat sesi dari server dan catatan lokal sekaligus. Bila server tidak terjangkau tetapi rekaman ada di perangkat,
 * tetap dilanjutkan dengan data lokal (offline-first).
 */
async function muatAwal(uuid: string, userId: number): Promise<Awal> {
  const lokal = await ambilSesiLokal(uuid, userId).catch(() => null);
  let server: SesiServer | null = null;
  let supervisiTidakTersedia = false;
  try {
    server = await ambilSesiServer(uuid);
  } catch (e) {
    const supervisiTidakTersedia404 = e instanceof ApiError && e.status === 404 && lokal?.tipeSesi === "supervisi_kelas";
    // Sesi supervisi menjadi 404 saat modul supervisi dimatikan; data lokal dipertahankan dan tidak dicoba dikirim.
    if (supervisiTidakTersedia404) supervisiTidakTersedia = true;
    else if (lokal === null || (e instanceof ApiError && e.status !== 404)) throw e;
  }
  // Server sudah menutup sesi: salinan di perangkat tidak berguna lagi.
  if (server && lokal && server.status !== "merekam") await hapusSesiLokal(uuid).catch(() => undefined);
  const jumlahChunkLokal = lokal ? (await ringkasChunk(uuid).catch(() => [])).length : 0;
  return { server, lokal, jumlahChunkLokal, supervisiTidakTersedia };
}

/**
 * Isi rute `/rekam/$uuid`. Memutuskan mode: perekam live untuk sesi baru (dari setup atau dari permintaan),
 * pemulihan untuk sesi yang rekamannya terhenti, atau pengalihan ke halaman hasil bila sesi sudah tidak merekam.
 */
export function LayarLive({ uuid }: { uuid: string }) {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const awal = useQuery({
    queryKey: ["rekam", "awal", uuid, me.id],
    queryFn: () => muatAwal(uuid, me.id),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const daftarKategori = useKategori();

  if (awal.isPending) {
    return (
      <KerangkaGelap>
        <main role="status" className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <LoaderCircleIcon className="size-10 animate-spin text-sky-400" aria-hidden />
          <p className="text-sm text-slate-300">Menyiapkan perekam…</p>
        </main>
      </KerangkaGelap>
    );
  }

  if (awal.isError) {
    return (
      <KerangkaGelap>
        <main className="flex flex-1 flex-col justify-center gap-4 px-4">
          <ErrorNotice error={awal.error} title="Tidak bisa membuka perekam" onRetry={() => void awal.refetch()} />
          <Button size="lg" variant="secondary" className="h-14 w-full" onClick={() => void navigate({ to: "/" })}>
            Kembali ke beranda
          </Button>
        </main>
      </KerangkaGelap>
    );
  }

  if (awal.data.supervisiTidakTersedia && awal.data.lokal) {
    return (
      <LayarModulNonaktif
        lokal={awal.data.lokal}
        jumlahChunk={awal.data.jumlahChunkLokal}
        modulAktif={me.modul.supervisi}
        onPeriksaLagi={() => {
          void qc.invalidateQueries({ queryKey: ["me"] });
          void awal.refetch();
        }}
      />
    );
  }

  const { server, lokal, jumlahChunkLokal } = awal.data;

  if (server && (!server.adalahPerekam || server.status !== "merekam")) {
    return <Navigate to="/sesi/$uuid" params={{ uuid }} replace />;
  }

  const judul = server?.judul ?? lokal?.judul ?? "Rekaman";
  const maksDurasiDetik = server?.maksDurasiDetik ?? lokal?.maksDurasiDetik ?? null;
  const adaPotongan = jumlahChunkLokal > 0 || (server?.chunks.length ?? 0) > 0;

  if (adaPotongan || lokal?.status === "menunggu-kirim") {
    return <LayarPemulihan key={uuid} uuid={uuid} judul={judul} maksDurasiDetik={maksDurasiDetik} lokal={lokal} seqServer={server?.chunks ?? null} />;
  }

  const tipeSesi = server?.tipeSesi ?? lokal?.tipeSesi ?? "rapat";
  const meta = bacaMeta(server?.metadata);
  const subjudul =
    tipeSesi === "supervisi_kelas"
      ? [meta.kelas, meta.mapel].filter(Boolean).join(" — ") || null
      : meta.kategori
        ? labelKategori(daftarKategori, meta.kategori)
        : null;

  return (
    <LayarRekam
      key={uuid}
      uuid={uuid}
      userId={me.id}
      judul={judul}
      tipeSesi={tipeSesi}
      subjudul={subjudul}
      maksDurasiDetik={maksDurasiDetik}
      mime={lokal?.audioMime ?? pilihMimeRekam() ?? "audio/webm"}
    />
  );
}
