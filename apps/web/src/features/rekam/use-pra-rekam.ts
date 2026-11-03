import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";
import { lepasStream, pesanMikrofon, tutupKonteks } from "./use-perekam";

export type StatusKesiapan = "memeriksa" | "ok" | "peringatan" | "masalah";

export type ItemKesiapan = {
  status: StatusKesiapan;
  /** Kalimat lengkap untuk daftar saat ada peringatan atau masalah. */
  pesan: string;
  /** Frasa pendek untuk baris ringkas ("Mikrofon aktif · Penyimpanan cukup · Online"). */
  ringkas: string;
};

export type KesiapanMikrofon = ItemKesiapan & {
  /** Tingkat suara 0..1 (RMS dihaluskan); 0 bila meter tidak berjalan. */
  tingkat: number;
  /** Meter benar-benar berjalan (AudioContext aktif). Bila false, "Mikrofon aktif" ditampilkan tanpa meter. */
  meter: boolean;
  /** Stream pra-rekam sedang dipegang, artinya izin sudah diberikan. */
  izin: boolean;
  /** Mengetuk "Periksa mikrofon" bisa membantu (izin belum ada, mikrofon sibuk, atau tidak ada suara). */
  bisaDiulang: boolean;
};

const MB = 1024 * 1024;
const GB = 1024 * MB;
/** ±32 kbps = 4000 byte/detik. */
const BYTE_PER_DETIK = 4_000;
const DURASI_DEFAULT_DETIK = 4 * 3600;
const AMBANG_PERINGATAN_MIN = 100 * MB;
const AMBANG_MASALAH = 20 * MB;
const TANPA_SUARA_MS = 5_000;
/** RMS (0..1) di atas ini dianggap ada suara. */
const AMBANG_SUARA = 0.02;
const INTERVAL_METER_MS = 100;
const BATAS_WAKTU_SERVER_MS = 4_000;

const MIKROFON_MEMERIKSA: KesiapanMikrofon = {
  status: "memeriksa",
  pesan: "Meminta izin mikrofon…",
  ringkas: "Memeriksa mikrofon",
  tingkat: 0,
  meter: false,
  izin: false,
  bisaDiulang: false,
};

const PENYIMPANAN_MEMERIKSA: ItemKesiapan = { status: "memeriksa", pesan: "Memeriksa ruang penyimpanan…", ringkas: "Memeriksa penyimpanan" };
const SERVER_MEMERIKSA: ItemKesiapan = { status: "memeriksa", pesan: "Memeriksa koneksi ke server…", ringkas: "Memeriksa koneksi" };

const formatUkuran = (byte: number) => (byte >= GB ? `${(byte / GB).toFixed(1)} GB` : `${Math.max(0, Math.round(byte / MB))} MB`);

async function statusIzinMikrofon(): Promise<PermissionState | null> {
  try {
    return (await navigator.permissions.query({ name: "microphone" as PermissionName })).state;
  } catch {
    // API izin tidak ada untuk "microphone" (mis. Firefox) atau tidak didukung.
    return null;
  }
}

async function klasifikasiGalatMikrofon(e: unknown): Promise<KesiapanMikrofon> {
  const nama = e instanceof DOMException ? e.name : "";
  const dasar = { tingkat: 0, meter: false, izin: false };
  if (nama === "NotFoundError") {
    return { ...dasar, status: "masalah", pesan: "Mikrofon tidak ditemukan di perangkat ini.", ringkas: "Mikrofon tidak ditemukan", bisaDiulang: false };
  }
  if (nama === "SecurityError") {
    return {
      ...dasar,
      status: "masalah",
      pesan: "Peramban memblokir mikrofon di halaman ini. Buka ruma lewat alamat https:// lalu coba lagi.",
      ringkas: "Mikrofon diblokir",
      bisaDiulang: false,
    };
  }
  if (nama === "NotAllowedError") {
    // Tanpa gestur (Safari) atau dialog ditutup, penolakannya sama dengan penolakan sungguhan. Hanya "denied" yang pasti diblokir.
    if ((await statusIzinMikrofon()) === "denied") {
      return {
        ...dasar,
        status: "masalah",
        pesan: "Izin mikrofon ditolak. Buka pengaturan situs di peramban (ikon gembok di bilah alamat), izinkan Mikrofon, lalu ketuk Periksa lagi.",
        ringkas: "Izin mikrofon ditolak",
        bisaDiulang: false,
      };
    }
    return {
      ...dasar,
      status: "peringatan",
      pesan: "Izin mikrofon belum diberikan. Ketuk Periksa mikrofon, lalu pilih Izinkan.",
      ringkas: "Mikrofon belum diizinkan",
      bisaDiulang: true,
    };
  }
  return { ...dasar, status: "peringatan", pesan: pesanMikrofon(e), ringkas: "Mikrofon bermasalah", bisaDiulang: true };
}

/**
 * Pemeriksaan kesiapan sebelum merekam, hanya untuk hal yang bisa membuat audio hilang tak tergantikan:
 * mikrofon (izin diminta otomatis dan diberi meter level), penyimpanan lokal, dan keterjangkauan server (informasi saja).
 * Stream pra-rekam dilepas saat `aktif` false, saat unmount, dan saat `lepas()` dipanggil (sebelum `perekam.mulai()`).
 */
export function usePraRekam({ aktif, maksDurasiDetik }: { aktif: boolean; maksDurasiDetik: number | null }) {
  const [mikrofon, setMikrofon] = useState<KesiapanMikrofon>(MIKROFON_MEMERIKSA);
  const [penyimpanan, setPenyimpanan] = useState<ItemKesiapan>(PENYIMPANAN_MEMERIKSA);
  const [server, setServer] = useState<ItemKesiapan>(SERVER_MEMERIKSA);
  const [putaran, setPutaran] = useState(0);

  const sumber = useRef<{ stream: MediaStream; ctx: AudioContext | null; timer: number } | null>(null);
  /** Hasil dari permintaan yang sudah digantikan (ronde lama) dibuang. */
  const ronde = useRef(0);

  /** Sinkron: aman dipanggil di dalam ketukan sebelum `perekam.mulai()` agar mikrofon tidak dipegang dua kali. */
  const lepas = useCallback(() => {
    ronde.current++;
    const s = sumber.current;
    sumber.current = null;
    if (!s) return;
    window.clearInterval(s.timer);
    lepasStream(s.stream);
    tutupKonteks(s.ctx);
  }, []);

  const periksaMikrofon = useCallback(() => {
    lepas();
    const saya = ronde.current;
    setMikrofon(MIKROFON_MEMERIKSA);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMikrofon({ ...MIKROFON_MEMERIKSA, status: "masalah", pesan: "Peramban ini tidak bisa mengakses mikrofon.", ringkas: "Mikrofon tidak tersedia" });
      return;
    }

    // AudioContext dibuat sekarang (bila dipanggil dari ketukan, iOS mengizinkannya berjalan); resume dicoba sekali.
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      void ctx.resume().catch(() => undefined);
    } catch {
      ctx = null;
    }

    void (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
      } catch (e) {
        tutupKonteks(ctx);
        const hasil = await klasifikasiGalatMikrofon(e);
        if (saya === ronde.current) setMikrofon(hasil);
        return;
      }
      if (saya !== ronde.current) {
        lepasStream(stream);
        tutupKonteks(ctx);
        return;
      }

      let analyser: AnalyserNode | null = null;
      if (ctx) {
        try {
          analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          ctx.createMediaStreamSource(stream).connect(analyser);
        } catch {
          analyser = null;
        }
      }
      const node = analyser;
      const konteks = ctx;
      const sampel = node ? new Uint8Array(node.fftSize) : null;
      const mulaiMs = performance.now();
      let halus = 0;
      let adaSuara = false;

      const tick = () => {
        const berjalan = node !== null && sampel !== null && konteks !== null && konteks.state === "running";
        let tingkat = 0;
        if (berjalan) {
          node.getByteTimeDomainData(sampel);
          let jumlah = 0;
          for (const v of sampel) {
            const x = (v - 128) / 128;
            jumlah += x * x;
          }
          const rms = Math.sqrt(jumlah / sampel.length);
          if (rms > AMBANG_SUARA) adaSuara = true;
          halus += (Math.min(1, Math.sqrt(rms) * 1.7) - halus) * 0.35;
          tingkat = Math.round(halus * 20) / 20;
        }
        // Tanpa meter (AudioContext tertahan) tidak ada dasar untuk menyebut mikrofon bermasalah.
        const hening = berjalan && !adaSuara && performance.now() - mulaiMs > TANPA_SUARA_MS;
        const berikut: KesiapanMikrofon = hening
          ? {
              status: "peringatan",
              pesan: "Tidak ada suara terdeteksi. Periksa mikrofon atau bicara sebentar.",
              ringkas: "Mikrofon: tidak ada suara",
              tingkat,
              meter: true,
              izin: true,
              bisaDiulang: true,
            }
          : { status: "ok", pesan: "Mikrofon aktif dan siap merekam.", ringkas: "Mikrofon aktif", tingkat, meter: berjalan, izin: true, bisaDiulang: false };
        setMikrofon((lama) => (lama.status === berikut.status && lama.tingkat === berikut.tingkat && lama.meter === berikut.meter && lama.izin ? lama : berikut));
      };

      sumber.current = { stream, ctx, timer: window.setInterval(tick, INTERVAL_METER_MS) };
      tick();
    })();
  }, [lepas]);

  useEffect(() => {
    if (!aktif) return;
    periksaMikrofon();
    return lepas;
  }, [aktif, periksaMikrofon, lepas]);

  // Penyimpanan lokal: ruang untuk potongan yang tertahan bila server tak terjangkau.
  useEffect(() => {
    if (!aktif) return;
    let batal = false;
    setPenyimpanan(PENYIMPANAN_MEMERIKSA);
    const tidakBisa: ItemKesiapan = { status: "ok", pesan: "Penyimpanan tidak bisa diperiksa di peramban ini.", ringkas: "Penyimpanan tidak bisa diperiksa" };
    void (async () => {
      let hasil: ItemKesiapan = tidakBisa;
      try {
        const taksiran = await navigator.storage?.estimate?.();
        const quota = taksiran?.quota;
        const usage = taksiran?.usage;
        if (quota !== undefined && usage !== undefined) {
          const sisa = quota - usage;
          const kebutuhan = (maksDurasiDetik ?? DURASI_DEFAULT_DETIK) * BYTE_PER_DETIK * 2;
          if (sisa < AMBANG_MASALAH) {
            hasil = {
              status: "masalah",
              pesan: `Ruang penyimpanan hampir habis (sisa ±${formatUkuran(sisa)}). Potongan rekaman bisa gagal tersimpan; kosongkan ruang di perangkat sebelum merekam.`,
              ringkas: "Penyimpanan hampir habis",
            };
          } else if (sisa < Math.max(AMBANG_PERINGATAN_MIN, kebutuhan)) {
            hasil = {
              status: "peringatan",
              pesan: `Ruang penyimpanan tersisa ±${formatUkuran(sisa)}, sedangkan rekaman penuh bisa butuh ±${formatUkuran(kebutuhan)} bila tidak sempat terkirim. Kosongkan ruang bila rekaman akan panjang.`,
              ringkas: "Penyimpanan terbatas",
            };
          } else {
            hasil = { status: "ok", pesan: `Ruang penyimpanan cukup (sisa ±${formatUkuran(sisa)}).`, ringkas: "Penyimpanan cukup" };
          }
        }
      } catch {
        hasil = tidakBisa;
      }
      if (!batal) setPenyimpanan(hasil);
    })();
    return () => {
      batal = true;
    };
  }, [aktif, maksDurasiDetik, putaran]);

  // Keterjangkauan server: informasi saja, tidak pernah memblokir (rekaman offline-first).
  useEffect(() => {
    if (!aktif) return;
    let batal = false;
    const offline: ItemKesiapan = { status: "peringatan", pesan: "Offline: rekaman disimpan di perangkat dan dikirim saat online.", ringkas: "Offline" };

    const periksa = async () => {
      if (!navigator.onLine) {
        setServer(offline);
        return;
      }
      const kendali = new AbortController();
      const timer = window.setTimeout(() => kendali.abort(), BATAS_WAKTU_SERVER_MS);
      try {
        const res = await fetch(`${API_URL}/health`, { signal: kendali.signal });
        if (batal) return;
        if (res.ok) setServer({ status: "ok", pesan: "Server terjangkau.", ringkas: "Online" });
        else if (res.status === 503) {
          setServer({ status: "peringatan", pesan: "Server sedang disiapkan (database). Rekaman tetap disimpan di perangkat.", ringkas: "Server sedang disiapkan" });
        } else {
          setServer({ status: "peringatan", pesan: "Server belum bisa melayani saat ini. Rekaman tetap disimpan di perangkat dan dikirim nanti.", ringkas: "Server bermasalah" });
        }
      } catch {
        if (!batal) setServer(offline);
      } finally {
        window.clearTimeout(timer);
      }
    };

    void periksa();
    const saatBerubah = () => void periksa();
    window.addEventListener("online", saatBerubah);
    window.addEventListener("offline", saatBerubah);
    return () => {
      batal = true;
      window.removeEventListener("online", saatBerubah);
      window.removeEventListener("offline", saatBerubah);
    };
  }, [aktif, putaran]);

  /** Memeriksa ulang ketiganya; panggil dari ketukan agar permintaan izin mikrofon dihitung sebagai gestur. */
  const ulangi = useCallback(() => {
    periksaMikrofon();
    setPutaran((p) => p + 1);
  }, [periksaMikrofon]);

  return { mikrofon, penyimpanan, server, ulangi, periksaMikrofon, lepas };
}
