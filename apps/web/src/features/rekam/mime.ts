/** Urutan MIME yang dicoba: WebM/Opus (Chrome, Firefox, Edge), MP4 (iOS Safari), Ogg/Opus. Semua lolos regex `audio_mime` server. */
const KANDIDAT_MIME = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"] as const;

/** MIME terbaik yang didukung `MediaRecorder` di perangkat ini, atau `null` bila tidak ada. */
export function pilihMimeRekam(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return KANDIDAT_MIME.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export type DukunganRekam = { ok: true; mime: string } | { ok: false; pesan: string };

/** Memeriksa semua prasyarat merekam dan menjelaskan penyebabnya bila tidak terpenuhi. */
export function cekDukunganRekam(): DukunganRekam {
  if (!window.isSecureContext) {
    return {
      ok: false,
      pesan: "Izin mikrofon hanya diberikan lewat koneksi aman. Buka Kalam AI dari alamat yang diawali https://.",
    };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, pesan: "Peramban ini tidak bisa mengakses mikrofon. Buka Kalam AI lewat Chrome, Safari, atau Firefox versi terbaru." };
  }
  const mime = pilihMimeRekam();
  if (!mime) {
    return { ok: false, pesan: "Peramban ini tidak mendukung perekaman audio. Buka Kalam AI lewat Chrome, Safari, atau Firefox versi terbaru." };
  }
  return { ok: true, mime };
}
