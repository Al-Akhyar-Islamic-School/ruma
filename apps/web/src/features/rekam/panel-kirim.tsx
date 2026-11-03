import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CloudOffIcon, CloudUploadIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMe } from "@/lib/auth";
import { hapusSesiLokal } from "./db";
import { DialogKonfirmasi } from "./dialog-konfirmasi";
import { bersihkanSetelahSukses, galatTetap, kirimSampaiSelesai, type RencanaKirim, type TahapKirim } from "./kirim";
import type { GalatUnggah, KodeGalat, PengunggahChunk, SnapshotUnggah } from "./unggah";

type AksiGalat = "ulang" | "buang" | "masuk";

const AKSI_GALAT: Record<KodeGalat, AksiGalat> = {
  login_berakhir: "masuk",
  tidak_ditemukan: "buang",
  sesi_ditutup: "buang",
  melebihi_durasi: "buang",
  ditolak: "ulang",
  tidak_bisa_diselesaikan: "buang",
};

const BACKOFF_AWAL_MS = 2_000;
const BACKOFF_MAKS_MS = 30_000;

/** Menunggu event `online` atau waktu habis, mana yang lebih dulu. */
function tungguJaringan(ms: number): Promise<void> {
  return new Promise<void>((selesai) => {
    const bangun = () => {
      clearTimeout(timer);
      window.removeEventListener("online", bangun);
      selesai();
    };
    const timer = setTimeout(bangun, ms);
    window.addEventListener("online", bangun);
  });
}

/**
 * Mengirim rekaman yang sudah selesai di perangkat: mengunggah potongan tersisa, memanggil `finish`, membersihkan blob
 * lokal, lalu membuka halaman hasil. Gagal jaringan diulang otomatis; galat tetap ditampilkan dengan pilihan jelas.
 * Rekaman di perangkat tidak pernah dibuang tanpa konfirmasi pengguna.
 */
export function PanelKirim({
  uuid,
  judul,
  rencana,
  pengunggah,
  snap,
  tipeSesi,
}: {
  uuid: string;
  judul: string;
  /** Harus stabil antar render (state/useMemo); perubahan identitas memulai ulang pengiriman. */
  rencana: RencanaKirim;
  pengunggah: PengunggahChunk;
  snap: SnapshotUnggah;
  /** Jenis sesi pada catatan lokal; menentukan penjelasan saat sesi tidak ditemukan. */
  tipeSesi?: "rapat" | "supervisi_kelas";
}) {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tahap, setTahap] = useState<TahapKirim | "mencoba-lagi">("mengunggah");
  const [galat, setGalat] = useState<GalatUnggah | null>(null);
  const [percobaan, setPercobaan] = useState(0);
  const [konfirmasiBuang, setKonfirmasiBuang] = useState(false);

  // Profil di cache bisa basi: pastikan saklar modul terbaru sebelum menawarkan membuang rekaman supervisi.
  const supervisiTidakDitemukan = galat?.kode === "tidak_ditemukan" && tipeSesi === "supervisi_kelas";
  useEffect(() => {
    if (supervisiTidakDitemukan) void qc.invalidateQueries({ queryKey: ["me"] });
  }, [supervisiTidakDitemukan, qc]);

  useEffect(() => {
    const sinyal = { batal: false };
    void (async () => {
      let gagal = 0;
      while (!sinyal.batal) {
        try {
          await kirimSampaiSelesai(uuid, rencana, pengunggah, sinyal, setTahap);
          if (sinyal.batal) return;
          await bersihkanSetelahSukses(uuid);
          void qc.invalidateQueries({ queryKey: ["sesi"] });
          void qc.invalidateQueries({ queryKey: ["rekam", "pemulihan"] });
          toast.success("Rekaman terkirim. Transkrip sedang diproses.");
          await navigate({ to: "/sesi/$uuid", params: { uuid }, replace: true });
          return;
        } catch (e) {
          if (sinyal.batal || (e instanceof DOMException && e.name === "AbortError")) return;
          const tetap = galatTetap(e);
          if (tetap) {
            setGalat(tetap);
            return;
          }
          gagal++;
          setTahap("mencoba-lagi");
          await tungguJaringan(Math.min(BACKOFF_MAKS_MS, BACKOFF_AWAL_MS * 2 ** (gagal - 1)));
        }
      }
    })();
    return () => {
      sinyal.batal = true;
    };
  }, [uuid, rencana, pengunggah, percobaan, qc, navigate]);

  let terunggah = 0;
  for (const [seq, status] of snap.potongan) if (seq < rencana.jumlahChunk && status === "terunggah") terunggah++;
  const persen = Math.round((terunggah / rencana.jumlahChunk) * 100);

  // Sesi supervisi menjadi 404 saat modulnya dimatikan: data lokal dipertahankan, tanpa pilihan membuang.
  const supervisiMati = supervisiTidakDitemukan && !me.modul.supervisi;
  const aksi = galat && !supervisiMati ? AKSI_GALAT[galat.kode] : null;

  const keBeranda = () => void navigate({ to: "/" });
  const coba = () => {
    pengunggah.cobaLagi();
    setGalat(null);
    setTahap("mengunggah");
    setPercobaan((p) => p + 1);
  };
  const buang = async () => {
    await hapusSesiLokal(uuid).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ["rekam", "pemulihan"] });
    toast.info("Rekaman di perangkat dibuang.");
    keBeranda();
  };

  let ikon = <LoaderCircleIcon className="size-10 animate-spin text-sky-400" aria-hidden />;
  let judulFase = "Mengirim rekaman";
  let teks = `Mengunggah ${terunggah} dari ${rencana.jumlahChunk} potongan`;
  if (galat) {
    ikon = <TriangleAlertIcon className="size-10 text-amber-400" aria-hidden />;
    judulFase = "Rekaman belum terkirim";
    teks = supervisiMati
      ? "Modul supervisi sedang dinonaktifkan admin, sehingga rekaman ini belum bisa dikirim. Rekaman tetap aman di perangkat dan bisa dikirim setelah modul dinyalakan lagi."
      : galat.pesan;
  } else if (!snap.online) {
    ikon = <CloudOffIcon className="size-10 text-amber-400" aria-hidden />;
    judulFase = "Menunggu koneksi";
    teks = "Rekaman aman di perangkat. Akan dikirim otomatis saat Anda online.";
  } else if (tahap === "mengirim") {
    ikon = <CloudUploadIcon className="size-10 text-sky-400" aria-hidden />;
    teks = "Menyelesaikan rekaman…";
  } else if (tahap === "mencoba-lagi") {
    teks = "Server belum bisa dihubungi. Mencoba lagi sebentar lagi…";
  }

  return (
    <>
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        {ikon}
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{judulFase}</h1>
          <p className="line-clamp-2 text-sm text-slate-400">{judul}</p>
        </div>
        {!galat && <Progress value={persen} aria-label="Kemajuan unggah" className="h-2 max-w-xs" />}
        <p role="status" aria-live="polite" className="max-w-sm text-sm text-slate-300">
          {teks}
        </p>
      </main>

      <footer className="space-y-3 px-4 pt-3 pb-4">
        {aksi === "masuk" && (
          <Button size="lg" className="h-14 w-full" onClick={() => void navigate({ to: "/login", search: { error: undefined } })}>
            Masuk lagi
          </Button>
        )}
        {aksi === "ulang" && (
          <Button size="lg" className="h-14 w-full" onClick={coba}>
            Coba lagi
          </Button>
        )}
        {aksi === "buang" && (
          <Button size="lg" variant="destructive" className="h-14 w-full" onClick={() => setKonfirmasiBuang(true)}>
            Buang rekaman di perangkat
          </Button>
        )}
        <Button size="lg" variant="secondary" className="h-14 w-full" onClick={keBeranda}>
          {galat ? "Kembali ke beranda" : "Kirim nanti dari beranda"}
        </Button>
        {!galat && <p className="text-center text-xs text-slate-400">Rekaman tersimpan di perangkat sampai server menerimanya.</p>}
      </footer>

      <DialogKonfirmasi
        open={konfirmasiBuang}
        onOpenChange={setKonfirmasiBuang}
        judul="Buang rekaman di perangkat?"
        deskripsi="Rekaman di perangkat ini dihapus permanen dan tidak bisa dikirim lagi. Potongan yang sudah ada di server tetap di sana."
        labelTetap="Simpan dulu"
        labelAksi="Buang rekaman"
        onAksi={() => void buang()}
      />
    </>
  );
}
