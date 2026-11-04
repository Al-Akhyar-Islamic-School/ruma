import { RumaApiClient } from "../lib/api";
import type { KeadaanPerekam, PesanEkstensi, PesanOffscreenMulai } from "../types";

let recorder: MediaRecorder | null = null;
let tabStream: MediaStream | null = null;
let micStream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let destination: MediaStreamAudioDestinationNode | null = null;
let analyser: AnalyserNode | null = null;
let timerMeter: number | null = null;

let apiClient: RumaApiClient | null = null;
let sesiUuid: string | null = null;

let seq = 0;
let detikMulai: number = 0;
let detikTertahan: number = 0;
let sedangJeda: boolean = false;
let rantaiUnggah: Promise<void> = Promise.resolve();

let keadaanSekarang: KeadaanPerekam = {
  status: "siap",
  detik: 0,
  audioLevel: 0,
  totalChunk: 0,
  sesiUuid: null,
  sesiUrl: null,
  judul: "",
  kodeMeet: "",
  galat: null,
};

function perbaruiKeadaan(parsial: Partial<KeadaanPerekam>) {
  keadaanSekarang = { ...keadaanSekarang, ...parsial };
  try {
    void chrome.runtime.sendMessage({
      tipe: "RECORDING_STATE_UPDATED",
      keadaan: keadaanSekarang,
    });
  } catch {
    // Abaikan jika penerima pesan tidak aktif
  }
}

function hitungDetikBerjalan(): number {
  if (keadaanSekarang.status !== "merekam" && keadaanSekarang.status !== "dijeda") {
    return keadaanSekarang.detik;
  }
  if (sedangJeda) {
    return detikTertahan;
  }
  return detikTertahan + Math.floor((Date.now() - detikMulai) / 1000);
}

function mulaiMeterAudio() {
  if (timerMeter !== null) {
    clearInterval(timerMeter);
    timerMeter = null;
  }

  timerMeter = window.setInterval(() => {
    if (!analyser || keadaanSekarang.status !== "merekam") return;

    const dataPcm = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(dataPcm);

    let sum = 0;
    for (let i = 0; i < dataPcm.length; i++) {
      const v = dataPcm[i] ?? 0;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / dataPcm.length);
    // Skala 0..1 diperhalus
    const level = Math.min(1, rms * 4);

    const detik = hitungDetikBerjalan();
    perbaruiKeadaan({ audioLevel: level, detik });
  }, 100);
}

function hentikanMeterAudio() {
  if (timerMeter !== null) {
    clearInterval(timerMeter);
    timerMeter = null;
  }
}

async function mulaiRekam(msg: PesanOffscreenMulai) {
  try {
    perbaruiKeadaan({
      status: "meminta_izin",
      judul: msg.judul,
      kodeMeet: msg.kodeMeet,
      galat: null,
      detik: 0,
      totalChunk: 0,
    });


    apiClient = new RumaApiClient(msg.rumaUrl, msg.authToken);

    // 1. Dapatkan stream audio tab Meet menggunakan streamId dari chrome.tabCapture
    const tabMedia = await navigator.mediaDevices.getUserMedia({
      audio: {
        // @ts-expect-error chromeMediaSourceId adalah ekstensi Chrome khusus
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: msg.streamId,
        },
      },
      video: false,
    });
    tabStream = tabMedia;

    // Pasang listener jika tab Google Meet ditutup pengguna
    tabStream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        if (keadaanSekarang.status === "merekam" || keadaanSekarang.status === "dijeda") {
          void hentikanRekam();
        }
      };
    });

    // 2. Dapatkan stream mikrofon pengguna jika diminta
    if (msg.includeMic) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err) {
        console.warn("Mikrofon lokal tidak bisa diakses, tetap merekam audio tab:", err);
        micStream = null;
      }
    }

    // 3. AudioContext untuk pencampuran tab + mic
    audioCtx = new AudioContext();
    await audioCtx.resume();
    destination = audioCtx.createMediaStreamDestination();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;

    // Hubungkan tab audio ke analyser dan ke speaker lokal
    const tabSource = audioCtx.createMediaStreamSource(tabStream);
    tabSource.connect(analyser);
    tabSource.connect(audioCtx.destination);

    // Hubungkan mikrofon ke analyser jika ada
    if (micStream) {
      const micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(analyser);
    }

    // Analyser meneruskan suara campuran ke destination rekaman
    analyser.connect(destination);
    // 4. Buat sesi di backend ruma.
    const resSesi = await apiClient.buatSesi({
      judul: msg.judul,
      mime: "audio/webm;codecs=opus",
      kodeMeet: msg.kodeMeet,
      kategori: msg.kategori,
    });

    sesiUuid = resSesi.uuid;
    const sesiUrl = `${msg.rumaUrl.replace(/\/+$/, "")}/sesi/${sesiUuid}`;
    seq = 0;
    detikMulai = Date.now();
    detikTertahan = 0;
    sedangJeda = false;
    rantaiUnggah = Promise.resolve();

    // 5. Inisialisasi MediaRecorder
    recorder = new MediaRecorder(destination.stream, {
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 32_000,
    });

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0 && sesiUuid && apiClient) {
        const noSeq = seq++;
        const blob = e.data;
        perbaruiKeadaan({ totalChunk: seq });

        rantaiUnggah = rantaiUnggah
          .then(async () => {
            if (!apiClient || !sesiUuid) return;
            await apiClient.unggahChunk(sesiUuid, noSeq, blob);
          })
          .catch((err) => {
            console.error(`Gagal unggah chunk ${noSeq}:`, err);
          });
      }
    };

    recorder.onerror = () => {
      perbaruiKeadaan({
        status: "galat",
        galat: "Terjadi gangguan pada perekam audio browser.",
      });
    };

    // Jalankan pemotongan tiap 30 detik (protokol ruma zero-loss)
    recorder.start(30_000);

    perbaruiKeadaan({
      status: "merekam",
      sesiUuid,
      sesiUrl,
      galat: null,
    });

    mulaiMeterAudio();
  } catch (err) {
    console.error("Gagal memulai rekaman di offscreen:", err);
    bersihkanAudio();
    perbaruiKeadaan({
      status: "galat",
      galat: err instanceof Error ? err.message : "Gagal memulai perekaman audio Meet.",
    });
  }
}

function jedaRekam() {
  if (recorder && recorder.state === "recording") {
    recorder.pause();
    sedangJeda = true;
    detikTertahan = hitungDetikBerjalan();
    if (audioCtx && audioCtx.state === "running") {
      void audioCtx.suspend();
    }
    perbaruiKeadaan({ status: "dijeda", detik: detikTertahan, audioLevel: 0 });
  }
}

function lanjutRekam() {
  if (recorder && recorder.state === "paused") {
    detikMulai = Date.now();
    sedangJeda = false;
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    recorder.resume();
    perbaruiKeadaan({ status: "merekam" });
  }
}

async function hentikanRekam() {
  if (!recorder || keadaanSekarang.status === "mengunggah" || keadaanSekarang.status === "selesai") {
    return;
  }

  hentikanMeterAudio();
  const durasiDetik = hitungDetikBerjalan();

  perbaruiKeadaan({
    status: "mengunggah",
    detik: durasiDetik,
    audioLevel: 0,
  });

  try {
    // Minta rekaman berhenti dan keluarkan sisa potongan terakhir
    if (recorder.state !== "inactive") {
      recorder.stop();
    }

    // Tunggu semua potongan audio selesai diunggah ke ruma.
    await rantaiUnggah;

    // Selesaikan sesi rapat di backend ruma.
    if (apiClient && sesiUuid) {
      await apiClient.selesaikanSesi({
        uuid: sesiUuid,
        jumlahChunk: seq,
        durasiDetik,
      });
    }

    const hasilUrl = keadaanSekarang.sesiUrl;

    perbaruiKeadaan({
      status: "selesai",
      detik: durasiDetik,
      totalChunk: seq,
    });

    // Buka halaman notulen rapat ruma. di tab baru
    if (hasilUrl) {
      void chrome.tabs.create({ url: hasilUrl });
    }
  } catch (err) {
    console.error("Gagal menyelesaikan rekaman:", err);
    perbaruiKeadaan({
      status: "galat",
      galat: err instanceof Error ? err.message : "Gagal menyelesaikan sesi di server.",
    });
  } finally {
    bersihkanAudio();
  }
}

function bersihkanAudio() {
  hentikanMeterAudio();

  if (tabStream) {
    tabStream.getTracks().forEach((t) => t.stop());
    tabStream = null;
  }

  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }

  if (audioCtx && audioCtx.state !== "closed") {
    void audioCtx.close().catch(() => undefined);
    audioCtx = null;
  }

  recorder = null;
  destination = null;
  analyser = null;
}

// Handler pesan runtime dari background service worker
chrome.runtime.onMessage.addListener((pesan: PesanEkstensi, _sender, kirimBalasan) => {
  if (pesan.tipe === "OFFSCREEN_START") {
    void mulaiRekam(pesan);
    kirimBalasan({ ok: true });
    return true;
  }

  if (pesan.tipe === "OFFSCREEN_PAUSE") {
    jedaRekam();
    kirimBalasan({ ok: true });
    return true;
  }

  if (pesan.tipe === "OFFSCREEN_RESUME") {
    lanjutRekam();
    kirimBalasan({ ok: true });
    return true;
  }

  if (pesan.tipe === "OFFSCREEN_STOP") {
    void hentikanRekam();
    kirimBalasan({ ok: true });
    return true;
  }

  if (pesan.tipe === "OFFSCREEN_GET_STATE") {
    kirimBalasan(keadaanSekarang);
    return true;
  }

  return false;
});
