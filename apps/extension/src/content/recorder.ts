import type { KeadaanPerekam } from "../types";

export type OpsiPerekamMeet = {
  judul: string;
  kodeMeet: string;
  includeMic: boolean;
  kategori?: string;
  rumaUrl: string;
  authToken: string;
  onUpdateState: (state: Partial<KeadaanPerekam>) => void;
  onAudioLevel: (level: number) => void;
};

async function blobToBase64(blob: Blob): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const reader = new FileReader();
  reader.onloadend = () => {
    const res = reader.result as string;
    const base64 = res.split(",")[1] || "";
    resolve(base64);
  };
  reader.onerror = () => reject(new Error("Gagal membaca audio blob."));
  reader.readAsDataURL(blob);
  return promise;
}

export class MeetTabRecorder {
  private displayStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private analyser: AnalyserNode | null = null;
  private recorder: MediaRecorder | null = null;

  private sesiUuid: string | null = null;
  private sesiUrl: string | null = null;
  private seq: number = 0;
  private detikMulai: number = 0;
  private detikTertahan: number = 0;
  private sedangJeda: boolean = false;
  private timerMeter: number | null = null;
  private rantaiUnggah: Promise<void> = Promise.resolve();

  constructor(private readonly opsi: OpsiPerekamMeet) {}

  public async mulai(): Promise<void> {
    this.opsi.onUpdateState({
      status: "meminta_izin",
      galat: null,
    });

    try {
      // 1. Minta akses audio tab Google Meet
      const constraints: DisplayMediaStreamOptions = {
        video: {
          displaySurface: "browser",
        },
        audio: {
          suppressLocalAudioPlayback: false,
        } as MediaTrackConstraints,
      };

      // @ts-expect-error Hint Chrome untuk merekomendasikan tab aktif saat ini
      constraints.preferCurrentTab = true;
      // @ts-expect-error Hint Chrome
      constraints.selfBrowserSurface = "include";
      // @ts-expect-error Hint Chrome
      constraints.systemAudio = "include";

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      this.displayStream = stream;

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error(
          "Audio tab tidak terpilih. Pastikan mencentang pilihan 'Bagikan audio tab' pada jendela pemilihan tab Chrome."
        );
      }
      const meetAudioTrack = audioTracks[0]!;

      // Matikan video track seketika karena ruma. hanya merekam audio
      stream.getVideoTracks().forEach((track) => track.stop());

      // Pasang listener jika pengguna menekan tombol 'Hentikan Berbagi' bawaan Chrome
      meetAudioTrack.onended = () => {
        void this.berhenti();
      };

      // 2. Minta akses mikrofon lokal pengguna jika diaktifkan
      if (this.opsi.includeMic) {
        try {
          this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch (err) {
          console.warn("Mikrofon lokal tidak dapat diakses, tetap merekam suara rapat:", err);
          this.micStream = null;
        }
      }

      // 3. Campur audio menggunakan Web Audio API
      this.audioCtx = new AudioContext();
      await this.audioCtx.resume();
      this.destination = this.audioCtx.createMediaStreamDestination();

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;

      const meetSource = this.audioCtx.createMediaStreamSource(new MediaStream([meetAudioTrack]));
      meetSource.connect(this.analyser);

      if (this.micStream) {
        const micSource = this.audioCtx.createMediaStreamSource(this.micStream);
        micSource.connect(this.analyser);
      }

      // AnalyserNode meneruskan audio ke destination rekaman MediaRecorder
      this.analyser.connect(this.destination);

      // 4. Buat sesi rapat via background service worker (menghindari blokir CSP/CORS Google Meet)
      const resSesi = await new Promise<{ ok: boolean; uuid?: string; sesiUrl?: string; error?: string }>((resolve) => {
        chrome.runtime.sendMessage(
          {
            tipe: "BG_BUAT_SESI",
            judul: this.opsi.judul,
            mime: "audio/webm;codecs=opus",
            kodeMeet: this.opsi.kodeMeet,
            kategori: this.opsi.kategori,
          },
          (res) => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(res || { ok: false, error: "Tidak ada respon dari background." });
            }
          }
        );
      });

      if (!resSesi.ok || !resSesi.uuid) {
        throw new Error(resSesi.error || "Gagal membuat sesi rapat di server ruma.");
      }

      this.sesiUuid = resSesi.uuid;
      this.sesiUrl = resSesi.sesiUrl || `${this.opsi.rumaUrl.replace(/\/+$/, "")}/sesi/${this.sesiUuid}`;
      this.seq = 0;
      this.detikMulai = Date.now();
      this.detikTertahan = 0;
      this.sedangJeda = false;
      this.rantaiUnggah = Promise.resolve();

      // 5. Buat MediaRecorder untuk pemotongan per 30 detik
      this.recorder = new MediaRecorder(this.destination.stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 32_000,
      });

      this.recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0 && this.sesiUuid) {
          const currentSeq = this.seq++;
          const blob = e.data;
          this.opsi.onUpdateState({ totalChunk: this.seq });

          this.rantaiUnggah = this.rantaiUnggah
            .then(async () => {
              if (!this.sesiUuid) return;
              const base64 = await blobToBase64(blob);
              await new Promise<void>((resolve, reject) => {
                chrome.runtime.sendMessage(
                  {
                    tipe: "BG_UNGGAH_CHUNK",
                    uuid: this.sesiUuid,
                    seq: currentSeq,
                    dataBase64: base64,
                  },
                  (res: { ok: boolean; error?: string } | undefined) => {
                    if (chrome.runtime.lastError || (res && !res.ok)) {
                      reject(new Error(res?.error || chrome.runtime.lastError?.message));
                    } else {
                      resolve();
                    }
                  }
                );
              });
            })
            .catch((err) => {
              console.error(`Gagal unggah chunk ${currentSeq}:`, err);
            });
        }
      };

      this.recorder.onerror = () => {
        this.opsi.onUpdateState({
          status: "galat",
          galat: "Terjadi gangguan pada perekam audio browser.",
        });
      };

      // Jalankan pemotongan tiap 30 detik
      this.recorder.start(30_000);

      this.opsi.onUpdateState({
        status: "merekam",
        sesiUuid: this.sesiUuid,
        sesiUrl: this.sesiUrl,
        detik: 0,
        totalChunk: 0,
        galat: null,
      });

      this.mulaiMeter();
    } catch (err) {
      this.bersihkan();
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "AbortError")) {
        this.opsi.onUpdateState({
          status: "siap",
          galat: null,
        });
        return;
      }
      console.error("Gagal memulai perekaman:", err);
      const pesan = err instanceof Error ? err.message : "Gagal memulai perekaman Google Meet.";
      this.opsi.onUpdateState({
        status: "galat",
        galat: pesan,
      });
      throw err;
    }
  }

  public jeda(): void {
    if (this.recorder && this.recorder.state === "recording") {
      this.recorder.pause();
      this.sedangJeda = true;
      this.detikTertahan = this.hitungDetik();
      if (this.audioCtx && this.audioCtx.state === "running") {
        void this.audioCtx.suspend();
      }
      this.opsi.onUpdateState({
        status: "dijeda",
        detik: this.detikTertahan,
        audioLevel: 0,
      });
    }
  }

  public lanjut(): void {
    if (this.recorder && this.recorder.state === "paused") {
      this.detikMulai = Date.now();
      this.sedangJeda = false;
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        void this.audioCtx.resume();
      }
      this.recorder.resume();
      this.opsi.onUpdateState({
        status: "merekam",
      });
    }
  }

  public async berhenti(): Promise<void> {
    if (!this.recorder || this.recorder.state === "inactive") return;

    this.hentikanMeter();
    const durasiDetik = this.hitungDetik();

    this.opsi.onUpdateState({
      status: "mengunggah",
      detik: durasiDetik,
      audioLevel: 0,
    });

    try {
      this.recorder.stop();
      await this.rantaiUnggah;

      if (this.sesiUuid) {
        await new Promise<void>((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              tipe: "BG_SELESAIKAN_SESI",
              uuid: this.sesiUuid,
              jumlahChunk: this.seq,
              durasiDetik,
            },
            (res: { ok: boolean; error?: string } | undefined) => {
              if (chrome.runtime.lastError || (res && !res.ok)) {
                reject(new Error(res?.error || chrome.runtime.lastError?.message));
              } else {
                resolve();
              }
            }
          );
        });
      }

      const hasilUrl = this.sesiUrl;

      this.opsi.onUpdateState({
        status: "selesai",
        detik: durasiDetik,
        totalChunk: this.seq,
      });

      if (hasilUrl) {
        window.open(hasilUrl, "_blank");
      }
    } catch (err) {
      console.error("Gagal menyelesaikan sesi rapat:", err);
      const pesan = err instanceof Error ? err.message : "Gagal menyelesaikan sesi di server ruma.";
      this.opsi.onUpdateState({
        status: "galat",
        galat: pesan,
      });
    } finally {
      this.bersihkan();
    }
  }

  private hitungDetik(): number {
    if (this.sedangJeda) return this.detikTertahan;
    return this.detikTertahan + Math.floor((Date.now() - this.detikMulai) / 1000);
  }

  private mulaiMeter(): void {
    this.hentikanMeter();

    this.timerMeter = window.setInterval(() => {
      if (!this.analyser) return;

      const dataPcm = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(dataPcm);

      let sum = 0;
      for (let i = 0; i < dataPcm.length; i++) {
        const v = dataPcm[i] ?? 0;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataPcm.length);
      const level = Math.min(1, rms * 4);

      this.opsi.onAudioLevel(level);
      this.opsi.onUpdateState({
        detik: this.hitungDetik(),
        audioLevel: level,
      });
    }, 100);
  }

  private hentikanMeter(): void {
    if (this.timerMeter !== null) {
      clearInterval(this.timerMeter);
      this.timerMeter = null;
    }
  }

  private bersihkan(): void {
    this.hentikanMeter();

    if (this.displayStream) {
      this.displayStream.getTracks().forEach((t) => t.stop());
      this.displayStream = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      void this.audioCtx.close().catch(() => undefined);
      this.audioCtx = null;
    }

    this.recorder = null;
    this.destination = null;
    this.analyser = null;
  }
}
