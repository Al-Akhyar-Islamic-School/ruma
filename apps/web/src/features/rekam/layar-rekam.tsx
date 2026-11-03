import { useQueryClient } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { FlagIcon, MicIcon, PauseIcon, PlayIcon, SunIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatTimer } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BukuBesar } from "./buku-besar";
import { hapusSesiLokal, pastikanSesiLokal, simpanChunk, ubahSesiLokal } from "./db";
import { DialogKonfirmasi } from "./dialog-konfirmasi";
import { KerangkaGelap } from "./kerangka";
import type { RencanaKirim } from "./kirim";
import { cekDukunganRekam } from "./mime";
import { PanelKirim } from "./panel-kirim";
import { hitungPotongan, usePengunggah } from "./unggah";
import { type PotonganBaru, usePerekam } from "./use-perekam";
import { useWakeLock } from "./use-wake-lock";
import { Waveform } from "./waveform";

const PENANDA_MAKS = 200;
const DURASI_MAKS_DETIK = 24 * 3600;
const KONFIRMASI_SELESAI_MS = 3_000;

export type PropsLayarRekam = {
  uuid: string;
  userId: number;
  judul: string;
  tipeSesi: "rapat" | "supervisi_kelas";
  /** Mis. "Kelas 7 Al Halim — IPAS" untuk supervisi. */
  subjudul: string | null;
  maksDurasiDetik: number | null;
  /** MIME yang disimpan saat sesi dibuat (`audio_mime`). */
  mime: string;
};

/** Layar perekam live (DESIGN.md Layar 2): timer, waveform, buku besar potongan, dan kontrol di sepertiga bawah. */
export function LayarRekam({ uuid, userId, judul, tipeSesi, subjudul, maksDurasiDetik, mime }: PropsLayarRekam) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dukungan = useMemo(() => cekDukunganRekam(), []);
  const { pengunggah, snap } = usePengunggah(uuid);
  const hitungan = hitungPotongan(snap.potongan);

  const [penanda, setPenanda] = useState<number[]>([]);
  const [penyimpananBermasalah, setPenyimpananBermasalah] = useState(false);
  const [rencana, setRencana] = useState<RencanaKirim | null>(null);
  const [menutup, setMenutup] = useState(false);
  const [kosong, setKosong] = useState(false);
  const [menungguKonfirmasi, setMenungguKonfirmasi] = useState(false);
  const [dialogBatal, setDialogBatal] = useState(false);

  const penandaRef = useRef<number[]>([]);
  const masalahSimpanRef = useRef(false);
  const siapLokal = useRef<Promise<void>>(Promise.resolve());
  const sedangSelesai = useRef(false);
  const timerKonfirmasi = useRef<number | undefined>(undefined);

  const tandaiMasalahSimpan = useCallback(() => {
    masalahSimpanRef.current = true;
    setPenyimpananBermasalah(true);
  }, []);

  // Setiap potongan disimpan ke IndexedDB lebih dulu, baru diunggah. Bila penyimpanan gagal, blob dipegang di memori dan tetap diunggah.
  const simpanPotongan = useCallback(
    async (p: PotonganBaru) => {
      await siapLokal.current;
      try {
        await simpanChunk({ uuid, seq: p.seq, blob: p.blob, ukuran: p.blob.size, terunggah: false });
        await ubahSesiLokal(uuid, { jumlahChunk: p.seq + 1, durasiDetik: p.detik });
        pengunggah.tambah(p.seq);
      } catch {
        tandaiMasalahSimpan();
        pengunggah.tambah(p.seq, p.blob);
      }
    },
    [uuid, pengunggah, tandaiMasalahSimpan],
  );

  const perekam = usePerekam({
    mime,
    maksDurasiDetik,
    onPotongan: simpanPotongan,
    onBatasDurasi: () => void selesaikan(true),
  });
  const { fase } = perekam;
  const sedangMerekam = fase === "merekam" || fase === "dijeda";
  const layarMenyala = useWakeLock(sedangMerekam);

  // Tombol kembali / tutup tab saat merekam: peringatkan dulu. Rekaman yang ditinggalkan bisa dilanjutkan dari beranda.
  const penghalang = useBlocker({
    shouldBlockFn: () => perekam.aktif(),
    enableBeforeUnload: () => perekam.aktif(),
    withResolver: true,
  });

  useEffect(() => () => window.clearTimeout(timerKonfirmasi.current), []);

  const selesaikan = async (otomatis: boolean) => {
    if (sedangSelesai.current) return;
    sedangSelesai.current = true;
    setMenutup(true);
    setMenungguKonfirmasi(false);
    if (otomatis) toast.info("Batas durasi tercapai. Rekaman diselesaikan otomatis.");

    const hasil = await perekam.berhenti();
    if (hasil.jumlahChunk === 0) {
      // Tidak ada audio yang tertangkap; server menolak finish tanpa potongan.
      setMenutup(false);
      setKosong(true);
      return;
    }
    const durasiDetik = Math.min(hasil.detik, maksDurasiDetik ?? DURASI_MAKS_DETIK, DURASI_MAKS_DETIK);
    const hasilRencana: RencanaKirim = {
      jumlahChunk: hasil.jumlahChunk,
      durasiDetik,
      penanda: penandaRef.current.filter((d) => d <= DURASI_MAKS_DETIK),
    };
    let tercatat = true;
    await ubahSesiLokal(uuid, { status: "menunggu-kirim", ...hasilRencana }).catch(() => {
      tercatat = false;
    });

    if (!navigator.onLine && tercatat && !masalahSimpanRef.current) {
      void qc.invalidateQueries({ queryKey: ["rekam", "pemulihan"] });
      toast.info("Rekaman aman di perangkat. Akan dikirim saat online.");
      void navigate({ to: "/" });
      return;
    }
    setRencana(hasilRencana);
  };

  const mulaiRekam = () => {
    // Pembuatan catatan lokal berjalan paralel dengan permintaan izin mikrofon; `perekam.mulai` harus dipanggil dalam ketukan ini.
    siapLokal.current = pastikanSesiLokal({
      uuid,
      userId,
      judul,
      tipeSesi,
      audioMime: mime,
      maksDurasiDetik,
      status: "merekam",
      jumlahChunk: 0,
      durasiDetik: 0,
      penanda: [],
      dibuat: Date.now(),
    }).catch(tandaiMasalahSimpan);
    void perekam.mulai();
  };

  const tandai = () => {
    if (!sedangMerekam) return;
    if (penandaRef.current.length >= PENANDA_MAKS) {
      toast.info(`Batas ${PENANDA_MAKS} penanda tercapai.`);
      return;
    }
    navigator.vibrate?.(40);
    const detik = perekam.detikSekarang();
    const baru = [...penandaRef.current, detik];
    penandaRef.current = baru;
    setPenanda(baru);
    void ubahSesiLokal(uuid, { penanda: baru }).catch(() => undefined);
    toast(`Momen ditandai pada ${formatTimer(detik)}`, { duration: 1500 });
  };

  // Dua ketukan agar tidak sengaja selesai saat HP di saku: ketukan pertama membuka jendela 3 detik.
  const ketukSelesai = () => {
    if (fase === "terhenti" || menungguKonfirmasi) {
      void selesaikan(false);
      return;
    }
    setMenungguKonfirmasi(true);
    window.clearTimeout(timerKonfirmasi.current);
    timerKonfirmasi.current = window.setTimeout(() => setMenungguKonfirmasi(false), KONFIRMASI_SELESAI_MS);
  };

  const ketukBatal = () => {
    if (sedangMerekam || fase === "terhenti") setDialogBatal(true);
    else void navigate({ to: "/" });
  };

  const batalkan = async () => {
    setDialogBatal(false);
    setMenutup(true);
    await perekam.berhenti(true);
    await hapusSesiLokal(uuid).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ["rekam", "pemulihan"] });
    toast.info("Rekaman dibatalkan dan dibuang dari perangkat.");
    void navigate({ to: "/" });
  };

  const rekamLagi = () => {
    penandaRef.current = [];
    setPenanda([]);
    sedangSelesai.current = false;
    setKosong(false);
    perekam.ulangi();
  };

  if (rencana) {
    return (
      <KerangkaGelap>
        <PanelKirim uuid={uuid} judul={judul} rencana={rencana} pengunggah={pengunggah} snap={snap} tipeSesi={tipeSesi} />
      </KerangkaGelap>
    );
  }

  if (kosong) {
    return (
      <KerangkaGelap>
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <TriangleAlertIcon className="size-10 text-amber-400" aria-hidden />
          <h1 className="text-xl font-semibold">Belum ada audio yang tersimpan</h1>
          <p className="max-w-sm text-sm text-slate-300">Rekaman terlalu singkat atau mikrofon tidak menangkap suara, jadi tidak ada yang bisa dikirim.</p>
        </main>
        <footer className="space-y-3 px-4 pt-3 pb-4">
          <Button size="lg" variant="record" className="h-14 w-full" onClick={rekamLagi}>
            Rekam lagi
          </Button>
          <Button size="lg" variant="secondary" className="h-14 w-full" onClick={() => void navigate({ to: "/" })}>
            Kembali ke beranda
          </Button>
        </footer>
      </KerangkaGelap>
    );
  }

  const siap = fase === "siap" || fase === "meminta-izin";
  const sisa = maksDurasiDetik === null ? null : Math.max(0, maksDurasiDetik - perekam.detik);
  const label = menutup
    ? "Menyimpan potongan terakhir…"
    : { siap: "Siap merekam", "meminta-izin": "Menunggu izin mikrofon…", merekam: "Merekam", dijeda: "Dijeda", terhenti: "Rekaman terhenti", berhenti: "Selesai" }[fase];

  return (
    <KerangkaGelap>
      <header className="flex items-center justify-between px-3 pt-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Batalkan rekaman" onClick={ketukBatal} disabled={menutup} className="text-slate-300 hover:bg-slate-800 hover:text-slate-50">
          <XIcon aria-hidden />
        </Button>
        <p className="text-sm font-medium text-slate-300">{tipeSesi === "supervisi_kelas" ? "Mode: Supervisi kelas" : "Mode: Rapat"}</p>
        <span className="size-12" aria-hidden />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-4 text-center">
        <div className="space-y-1">
          <h1 className="line-clamp-2 text-xl leading-snug font-semibold">{judul}</h1>
          {subjudul && <p className="text-sm text-slate-400">{subjudul}</p>}
        </div>

        <p className={cn("font-mono text-6xl font-semibold tracking-tight tabular-nums", fase === "dijeda" || siap ? "text-slate-400" : "text-slate-50")}>
          {formatTimer(perekam.detik)}
        </p>

        <p role="status" className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-200 uppercase">
          <span
            aria-hidden
            className={cn("size-2.5 rounded-full", fase === "merekam" && !menutup ? "animate-pulse bg-rose-500" : fase === "dijeda" || fase === "terhenti" ? "bg-amber-400" : "bg-slate-500")}
          />
          {label}
        </p>

        {sisa !== null && !menutup && (
          <p className={cn("rounded-full bg-slate-900 px-3 py-1 text-xs font-medium ring-1 ring-slate-800", sisa <= 60 ? "text-rose-300" : sisa <= 300 ? "text-amber-300" : "text-slate-300")}>
            {siap ? "Batas rekaman" : "Sisa waktu"} <span className="font-mono tabular-nums">{formatTimer(siap ? (maksDurasiDetik ?? 0) : sisa)}</span>
          </p>
        )}

        <Waveform analyser={perekam.analyser} aktif={fase === "merekam"} className="h-24 w-full max-w-md" />

        <p aria-live="polite" className="flex items-center gap-1.5 text-sm text-slate-300">
          <FlagIcon className="size-4 text-amber-400" aria-hidden />
          {penanda.length} momen penting ditandai
        </p>

        {!dukungan.ok && (
          <p role="alert" className="max-w-sm rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {dukungan.pesan}
          </p>
        )}
        {perekam.galat && (
          <p role="alert" className="max-w-sm rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {perekam.galat}
          </p>
        )}
        {fase === "terhenti" && (
          <p role="alert" className="max-w-sm rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Perangkat menghentikan rekaman (mis. ada telepon masuk atau mikrofon terlepas). Potongan yang sudah ada aman di perangkat. Ketuk Selesaikan dan kirim.
          </p>
        )}
        {snap.galat && (
          <p role="alert" className="max-w-sm rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {snap.galat.kode === "tidak_ditemukan" && tipeSesi === "supervisi_kelas"
              ? "Server tidak menemukan sesi supervisi ini; modul supervisi mungkin dinonaktifkan admin."
              : snap.galat.pesan}{" "}
            Rekaman tetap tersimpan di perangkat.
          </p>
        )}
      </main>

      <div className="px-4 pb-3">
        <BukuBesar
          potongan={snap.potongan}
          hitungan={hitungan}
          sedangRekam={sedangMerekam}
          berdenyut={fase === "merekam"}
          online={snap.online}
          penyimpananBermasalah={penyimpananBermasalah}
        />
      </div>

      <footer className="px-4 pb-4">
        {siap ? (
          <div className="flex flex-col items-center gap-2 pt-1">
            <Button
              type="button"
              variant="record"
              aria-label="Mulai merekam"
              disabled={!dukungan.ok || fase === "meminta-izin"}
              onClick={mulaiRekam}
              className="size-[72px] rounded-full shadow-lg shadow-rose-500/30 [&_svg:not([class*='size-'])]:size-8"
            >
              <MicIcon aria-hidden />
            </Button>
            <p className="text-sm font-semibold">{fase === "meminta-izin" ? "Menunggu izin mikrofon…" : "Mulai merekam"}</p>
            <p className="text-center text-xs text-slate-400">Peramban akan meminta izin mikrofon saat Anda mengetuk tombol ini.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Button
                type="button"
                size="lg"
                disabled={menutup || fase === "terhenti"}
                onClick={fase === "dijeda" ? perekam.lanjut : perekam.jeda}
                className="h-16 flex-col gap-1 bg-slate-800 text-slate-50 hover:bg-slate-700"
              >
                {fase === "dijeda" ? <PlayIcon aria-hidden /> : <PauseIcon aria-hidden />}
                <span className="text-sm">{fase === "dijeda" ? "Lanjut" : "Jeda"}</span>
              </Button>
              <Button
                type="button"
                size="lg"
                disabled={menutup || fase === "terhenti"}
                onClick={tandai}
                className="h-16 flex-col gap-1 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
              >
                <FlagIcon aria-hidden />
                <span className="text-sm">Tandai</span>
              </Button>
              <Button type="button" size="lg" variant="record" disabled={menutup} onClick={ketukSelesai} className="h-16 flex-col gap-1 px-2 leading-tight whitespace-normal">
                {menungguKonfirmasi ? (
                  <span className="text-sm">Ketuk lagi untuk selesai</span>
                ) : (
                  <>
                    <span className="size-4 rounded-[3px] bg-current" aria-hidden />
                    <span className="text-sm">{fase === "terhenti" ? "Selesaikan dan kirim" : "Selesai"}</span>
                  </>
                )}
              </Button>
            </div>
            <span className="sr-only" role="status">
              {menungguKonfirmasi ? "Ketuk Selesai sekali lagi dalam 3 detik untuk menyelesaikan rekaman." : ""}
            </span>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <SunIcon className="size-3.5" aria-hidden />
              {layarMenyala ? "Layar tetap menyala" : "Layar bisa mati sendiri. Jangan kunci layar saat merekam."}
            </p>
          </>
        )}
      </footer>

      <DialogKonfirmasi
        open={dialogBatal}
        onOpenChange={setDialogBatal}
        judul="Batalkan rekaman?"
        deskripsi="Perekaman berhenti dan rekaman di perangkat ini dibuang. Sesi di server tidak ikut terhapus (belum ada fitur hapus sesi): ia tetap berstatus Belum selesai di beranda Anda, dan potongan yang sudah terunggah tetap ada di server."
        labelTetap="Lanjut merekam"
        labelAksi="Buang rekaman"
        onAksi={() => void batalkan()}
      />

      <DialogKonfirmasi
        open={penghalang.status === "blocked"}
        onOpenChange={(o) => {
          if (!o) penghalang.reset?.();
        }}
        judul="Rekaman masih berjalan"
        deskripsi="Keluar dari layar ini menghentikan perekaman. Potongan yang sudah tersimpan tetap aman dan bisa dikirim dari beranda lewat Rekaman belum selesai."
        labelTetap="Tetap merekam"
        labelAksi="Keluar dan hentikan"
        onAksi={() => penghalang.proceed?.()}
      />
    </KerangkaGelap>
  );
}
