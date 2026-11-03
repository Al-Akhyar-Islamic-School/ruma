import { useCallback, useEffect, useRef, useState } from "react";

/**
 * `siap` → `meminta-izin` → `merekam` ⇄ `dijeda` → `berhenti`.
 * `terhenti`: perangkat menghentikan rekaman sendiri (telepon masuk, mikrofon dicabut); potongan yang ada tetap aman.
 */
export type FasePerekam = "siap" | "meminta-izin" | "merekam" | "dijeda" | "terhenti" | "berhenti";

export type PotonganBaru = { seq: number; blob: Blob; /** Detik rekam saat potongan selesai. */ detik: number };

type Opsi = {
  mime: string;
  maksDurasiDetik: number | null;
  /** Dipanggil berurutan satu-per-satu; harus menyimpan potongan ke penyimpanan tetap. */
  onPotongan: (p: PotonganBaru) => Promise<void>;
  /** Dipanggil sekali saat waktu rekam mencapai `maksDurasiDetik`. */
  onBatasDurasi: () => void;
};

type SesiMedia = { recorder: MediaRecorder; stream: MediaStream; ctx: AudioContext | null };

/** Panjang potongan: `ondataavailable` menghasilkan satu potongan tiap ±30 detik. */
const POTONGAN_MS = 30_000;
const BITRATE = 32_000;

function pesanMikrofon(e: unknown): string {
  const nama = e instanceof DOMException ? e.name : "";
  if (nama === "NotAllowedError" || nama === "SecurityError") {
    return "Izin mikrofon ditolak. Izinkan mikrofon untuk Kalam AI di pengaturan peramban, lalu ketuk Mulai merekam lagi.";
  }
  if (nama === "NotFoundError" || nama === "OverconstrainedError") return "Mikrofon tidak ditemukan di perangkat ini.";
  if (nama === "NotReadableError" || nama === "AbortError") return "Mikrofon sedang dipakai aplikasi lain. Tutup aplikasi itu, lalu coba lagi.";
  return "Tidak bisa mengakses mikrofon. Coba lagi.";
}

const tutupKonteks = (ctx: AudioContext | null) => {
  if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
};

const lepasStream = (stream: MediaStream) => {
  for (const t of stream.getTracks()) {
    t.onended = null;
    t.stop();
  }
};

/** State machine perekam: MediaRecorder, waktu rekam (tanpa jeda), analyser untuk waveform, dan potongan 30 dtk bernomor tanpa celah. */
export function usePerekam(opsi: Opsi) {
  const opsiRef = useRef(opsi);
  useEffect(() => {
    opsiRef.current = opsi;
  });

  const [fase, setFaseState] = useState<FasePerekam>("siap");
  const [detik, setDetik] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const faseRef = useRef<FasePerekam>("siap");
  const sesi = useRef<SesiMedia | null>(null);
  const seq = useRef(0);
  const akumMs = useRef(0);
  const mulaiSegmen = useRef<number | null>(null);
  const rantai = useRef<Promise<void>>(Promise.resolve());
  const diminta = useRef(false);
  const buang = useRef(false);
  const batasTercapai = useRef(false);
  const terpasang = useRef(true);

  const setFase = useCallback((f: FasePerekam) => {
    faseRef.current = f;
    setFaseState(f);
  }, []);

  const hitungMs = useCallback(
    () => akumMs.current + (mulaiSegmen.current === null ? 0 : performance.now() - mulaiSegmen.current),
    [],
  );
  const detikSekarang = useCallback(() => Math.floor(hitungMs() / 1000), [hitungMs]);

  const bekukan = useCallback(() => {
    if (mulaiSegmen.current === null) return;
    akumMs.current += performance.now() - mulaiSegmen.current;
    mulaiSegmen.current = null;
  }, []);

  const lepas = useCallback(() => {
    const s = sesi.current;
    sesi.current = null;
    if (!s) return;
    lepasStream(s.stream);
    tutupKonteks(s.ctx);
    setAnalyser(null);
  }, []);

  const mulai = useCallback(async () => {
    if (faseRef.current !== "siap") return;
    setFase("meminta-izin");
    setGalat(null);

    // AudioContext dibuat sekarang, masih di dalam ketukan pengguna: iOS menolak memulainya setelah await.
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      void ctx.resume().catch(() => undefined);
    } catch {
      ctx = null;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      tutupKonteks(ctx);
      if (terpasang.current) {
        setGalat(pesanMikrofon(e));
        setFase("siap");
      }
      return;
    }
    if (!terpasang.current) {
      lepasStream(stream);
      tutupKonteks(ctx);
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: opsiRef.current.mime, audioBitsPerSecond: BITRATE });
    } catch {
      lepasStream(stream);
      tutupKonteks(ctx);
      setGalat("Perangkat ini tidak bisa merekam dengan format audio yang dipakai sesi ini.");
      setFase("siap");
      return;
    }

    let analyserBaru: AnalyserNode | null = null;
    if (ctx) {
      try {
        analyserBaru = ctx.createAnalyser();
        analyserBaru.fftSize = 1024;
        analyserBaru.smoothingTimeConstant = 0.6;
        // Hanya dianalisis, tidak disambung ke speaker (menghindari umpan balik).
        ctx.createMediaStreamSource(stream).connect(analyserBaru);
      } catch {
        analyserBaru = null;
      }
    }

    diminta.current = false;
    buang.current = false;
    batasTercapai.current = false;
    seq.current = 0;
    akumMs.current = 0;
    setDetik(0);

    recorder.ondataavailable = (e) => {
      // Potongan kosong ditolak server dan tidak boleh memakai nomor seq (akan menimbulkan celah).
      if (e.data.size === 0 || buang.current) return;
      const potongan: PotonganBaru = { seq: seq.current++, blob: e.data, detik: Math.floor(hitungMs() / 1000) };
      rantai.current = rantai.current.then(() => opsiRef.current.onPotongan(potongan)).catch(() => undefined);
    };
    recorder.onerror = () => setGalat("Perekam audio mengalami gangguan.");
    recorder.onstop = () => {
      if (diminta.current) return;
      bekukan();
      lepas();
      if (terpasang.current) {
        setDetik(Math.floor(akumMs.current / 1000));
        setFase("terhenti");
      }
    };
    for (const t of stream.getAudioTracks()) {
      t.onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
      };
    }

    sesi.current = { recorder, stream, ctx };
    try {
      recorder.start(POTONGAN_MS);
    } catch {
      sesi.current = null;
      lepasStream(stream);
      tutupKonteks(ctx);
      setGalat("Perekaman gagal dimulai. Coba lagi.");
      setFase("siap");
      return;
    }
    mulaiSegmen.current = performance.now();
    setAnalyser(analyserBaru);
    setFase("merekam");
  }, [bekukan, hitungMs, lepas, setFase]);

  const jeda = useCallback(() => {
    const s = sesi.current;
    if (!s || faseRef.current !== "merekam" || s.recorder.state !== "recording") return;
    s.recorder.pause();
    bekukan();
    setDetik(Math.floor(akumMs.current / 1000));
    setFase("dijeda");
  }, [bekukan, setFase]);

  const lanjut = useCallback(() => {
    const s = sesi.current;
    if (!s || faseRef.current !== "dijeda" || s.recorder.state !== "paused") return;
    s.recorder.resume();
    mulaiSegmen.current = performance.now();
    setFase("merekam");
  }, [setFase]);

  /**
   * Menghentikan recorder, menunggu potongan terakhir tersimpan, lalu melepas mikrofon.
   * Dengan `buangHasil`, potongan terakhir diabaikan (pembatalan).
   */
  const berhenti = useCallback(
    async (buangHasil = false): Promise<{ detik: number; jumlahChunk: number }> => {
      diminta.current = true;
      buang.current = buangHasil;
      const s = sesi.current;
      bekukan();
      const total = Math.floor(akumMs.current / 1000);
      setDetik(total);
      const recorder = s?.recorder;
      if (recorder && recorder.state !== "inactive") {
        await new Promise<void>((selesai) => {
          recorder.addEventListener("stop", () => selesai(), { once: true });
          recorder.stop();
        });
      }
      await rantai.current;
      lepas();
      setFase("berhenti");
      return { detik: total, jumlahChunk: seq.current };
    },
    [bekukan, lepas, setFase],
  );

  /** Kembali ke keadaan siap setelah rekaman kosong (tidak ada potongan yang tersimpan). */
  const ulangi = useCallback(() => {
    seq.current = 0;
    akumMs.current = 0;
    mulaiSegmen.current = null;
    setDetik(0);
    setGalat(null);
    setFase("siap");
  }, [setFase]);

  /** Benar selama ada rekaman yang hasilnya akan hilang bila halaman ditinggalkan. */
  const aktif = useCallback(() => {
    const f = faseRef.current;
    return f === "merekam" || f === "dijeda" || f === "terhenti";
  }, []);

  useEffect(() => {
    if (fase !== "merekam") return;
    const timer = setInterval(() => {
      const d = Math.floor(hitungMs() / 1000);
      setDetik(d);
      const maks = opsiRef.current.maksDurasiDetik;
      if (maks !== null && d >= maks && !batasTercapai.current) {
        batasTercapai.current = true;
        opsiRef.current.onBatasDurasi();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [fase, hitungMs]);

  // Dibongkar saat merekam (mis. pengguna keluar): hentikan recorder agar potongan terakhir tetap tersimpan, lalu lepas mikrofon.
  useEffect(() => {
    terpasang.current = true;
    return () => {
      terpasang.current = false;
      const s = sesi.current;
      if (!s) return;
      sesi.current = null;
      diminta.current = true;
      bekukan();
      const bersihkan = () => {
        lepasStream(s.stream);
        tutupKonteks(s.ctx);
      };
      if (s.recorder.state === "inactive") {
        bersihkan();
      } else {
        s.recorder.addEventListener("stop", bersihkan, { once: true });
        s.recorder.stop();
      }
    };
  }, [bekukan]);

  return { fase, detik, analyser, galat, mulai, jeda, lanjut, berhenti, ulangi, aktif, detikSekarang };
}
