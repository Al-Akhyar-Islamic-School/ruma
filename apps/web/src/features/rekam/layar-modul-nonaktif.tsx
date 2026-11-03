import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArchiveIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { hapusSesiLokal, type SesiLokal } from "./db";
import { DialogKonfirmasi } from "./dialog-konfirmasi";
import { KerangkaGelap } from "./kerangka";

/**
 * Rekaman supervisi yang tersimpan di perangkat tetapi sesinya tidak lagi terbaca server (404). Saat modul supervisi
 * dimatikan admin, sesi supervisi menjadi tak terlihat. Data lokal dipertahankan dan tidak dicoba dikirim; saat modul
 * dinyalakan lagi, "Periksa lagi" (atau membuka ulang dari beranda) melanjutkan pemulihan normal.
 */
export function LayarModulNonaktif({
  lokal,
  jumlahChunk,
  modulAktif,
  onPeriksaLagi,
}: {
  lokal: SesiLokal;
  jumlahChunk: number;
  /** Nilai saklar saat ini dari profil. Bila menyala tetapi sesi tetap 404, sesi memang tidak ada di server. */
  modulAktif: boolean;
  onPeriksaLagi: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [konfirmasiBuang, setKonfirmasiBuang] = useState(false);

  const buang = async () => {
    await hapusSesiLokal(lokal.uuid).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ["rekam", "pemulihan"] });
    toast.info("Rekaman di perangkat dibuang.");
    void navigate({ to: "/" });
  };

  return (
    <KerangkaGelap>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <ArchiveIcon className="size-10 text-amber-400" aria-hidden />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Rekaman belum selesai</h1>
          <p className="line-clamp-2 text-sm text-slate-400">{lokal.judul}</p>
        </div>
        <p className="max-w-sm text-sm text-slate-300">
          {modulAktif
            ? "Sesi supervisi ini tidak ditemukan di server, jadi rekaman belum bisa dikirim."
            : "Modul supervisi sedang dinonaktifkan admin, sehingga rekaman ini belum bisa dikirim."}{" "}
          {jumlahChunk > 0
            ? `${jumlahChunk} potongan rekaman tetap aman di perangkat ini`
            : "Belum ada potongan rekaman di perangkat ini"}
          {modulAktif ? "." : " dan akan bisa dikirim setelah modul dinyalakan lagi."}
        </p>
      </main>
      <footer className="space-y-3 px-4 pt-3 pb-4">
        <Button size="lg" className="h-14 w-full" onClick={onPeriksaLagi}>
          Periksa lagi
        </Button>
        {modulAktif && (
          <Button size="lg" variant="destructive" className="h-14 w-full" onClick={() => setKonfirmasiBuang(true)}>
            Buang rekaman di perangkat
          </Button>
        )}
        <Button size="lg" variant="secondary" className="h-14 w-full" onClick={() => void navigate({ to: "/" })}>
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
