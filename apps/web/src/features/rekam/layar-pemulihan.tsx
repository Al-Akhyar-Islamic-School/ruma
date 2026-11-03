import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { awalanBerurutan, hapusSesiLokal, ringkasChunk, type SesiLokal, ubahSesiLokal } from "./db";
import { DialogKonfirmasi } from "./dialog-konfirmasi";
import { KerangkaGelap } from "./kerangka";
import type { RencanaKirim } from "./kirim";
import { PanelKirim } from "./panel-kirim";
import { usePengunggah } from "./unggah";

const DURASI_MAKS_DETIK = 24 * 3600;
const DETIK_PER_POTONGAN = 30;

type Keadaan = { jenis: "menyiapkan" } | { jenis: "siap"; rencana: RencanaKirim } | { jenis: "kosong" } | { jenis: "galat" };

/**
 * Mode pemulihan: rekaman terhenti (halaman dimuat ulang, aplikasi ditutup, atau baru selesai saat offline). Tidak merekam lagi:
 * mengunggah potongan yang tersisa, lalu `finish` dengan potongan berurutan yang ada dan durasi taksiran.
 */
export function LayarPemulihan({
  uuid,
  judul,
  maksDurasiDetik,
  lokal,
  seqServer,
}: {
  uuid: string;
  judul: string;
  maksDurasiDetik: number | null;
  /** Catatan rekaman di perangkat ini (null bila hanya server yang punya potongan). */
  lokal: SesiLokal | null;
  /** Potongan yang sudah ada di server; null bila server tidak terjangkau (offline). */
  seqServer: number[] | null;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { pengunggah, snap } = usePengunggah(uuid);
  const [keadaan, setKeadaan] = useState<Keadaan>({ jenis: "menyiapkan" });
  const [konfirmasiBuang, setKonfirmasiBuang] = useState(false);

  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const chunkLokal = lokal ? await ringkasChunk(uuid) : [];
        const diServer = new Set(seqServer ?? []);
        const jumlahChunk = awalanBerurutan([...chunkLokal.map((c) => c.seq), ...diServer]);
        if (batal) return;
        if (jumlahChunk === 0) {
          setKeadaan({ jenis: "kosong" });
          return;
        }
        const lokalPerSeq = new Map(chunkLokal.map((c) => [c.seq, c]));
        const daftar = Array.from({ length: jumlahChunk }, (_, seq) => ({
          seq,
          terunggah: diServer.has(seq) || lokalPerSeq.get(seq)?.terunggah === true,
        }));
        const tersimpan = lokal?.durasiDetik ?? 0;
        const rencana: RencanaKirim = {
          jumlahChunk,
          durasiDetik: Math.min(tersimpan > 0 ? tersimpan : jumlahChunk * DETIK_PER_POTONGAN, maksDurasiDetik ?? DURASI_MAKS_DETIK, DURASI_MAKS_DETIK),
          penanda: lokal?.penanda ?? [],
        };
        if (lokal) await ubahSesiLokal(uuid, { status: "menunggu-kirim", ...rencana }).catch(() => undefined);
        if (batal) return;
        pengunggah.muat(daftar);
        setKeadaan({ jenis: "siap", rencana });
      } catch {
        if (!batal) setKeadaan({ jenis: "galat" });
      }
    })();
    return () => {
      batal = true;
    };
  }, [uuid, lokal, seqServer, maksDurasiDetik, pengunggah]);

  const keBeranda = () => void navigate({ to: "/" });
  const buang = async () => {
    await hapusSesiLokal(uuid).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ["rekam", "pemulihan"] });
    toast.info("Rekaman di perangkat dibuang.");
    keBeranda();
  };

  if (keadaan.jenis === "siap") {
    return (
      <KerangkaGelap>
        <PanelKirim uuid={uuid} judul={judul} rencana={keadaan.rencana} pengunggah={pengunggah} snap={snap} tipeSesi={lokal?.tipeSesi} />
      </KerangkaGelap>
    );
  }

  if (keadaan.jenis === "menyiapkan") {
    return (
      <KerangkaGelap>
        <main role="status" className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <LoaderCircleIcon className="size-10 animate-spin text-sky-400" aria-hidden />
          <p className="text-sm text-slate-300">Memeriksa rekaman di perangkat…</p>
        </main>
      </KerangkaGelap>
    );
  }

  const galatBaca = keadaan.jenis === "galat";
  return (
    <KerangkaGelap>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <TriangleAlertIcon className="size-10 text-amber-400" aria-hidden />
        <h1 className="text-xl font-semibold">{galatBaca ? "Rekaman di perangkat tidak terbaca" : "Tidak ada potongan yang bisa dikirim"}</h1>
        <p className="max-w-sm text-sm text-slate-300">
          {galatBaca
            ? "Penyimpanan perangkat tidak bisa dibuka. Muat ulang halaman ini; bila terus berulang, rekaman tidak bisa dipulihkan dari perangkat ini."
            : "Potongan awal rekaman tidak ada di perangkat maupun di server, jadi rekaman ini tidak bisa diselesaikan."}
        </p>
      </main>
      <footer className="space-y-3 px-4 pt-3 pb-4">
        {lokal && !galatBaca && (
          <Button size="lg" variant="destructive" className="h-14 w-full" onClick={() => setKonfirmasiBuang(true)}>
            Buang rekaman di perangkat
          </Button>
        )}
        <Button size="lg" variant="secondary" className="h-14 w-full" onClick={keBeranda}>
          Kembali ke beranda
        </Button>
      </footer>
      <DialogKonfirmasi
        open={konfirmasiBuang}
        onOpenChange={setKonfirmasiBuang}
        judul="Buang rekaman di perangkat?"
        deskripsi="Rekaman di perangkat ini dihapus permanen dan tidak bisa dikirim lagi."
        labelTetap="Simpan dulu"
        labelAksi="Buang rekaman"
        onAksi={() => void buang()}
      />
    </KerangkaGelap>
  );
}
