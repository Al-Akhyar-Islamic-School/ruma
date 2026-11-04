import { RumaMeetWidget } from "./widget";
import { MeetTabRecorder } from "./recorder";
import cssStyles from "./styles.css?inline";
import type { KeadaanPerekam, PesanEkstensi } from "../types";

function dapatkanKodeMeet(): string | null {
  const match = window.location.pathname.match(/^\/([a-z0-9-]+)/i);
  if (!match) return null;
  const kode = match[1] ?? "";
  if (kode === "landing" || kode === "about" || kode === "new" || !kode) {
    return null;
  }
  return kode;
}

function dapatkanJudulMeet(kodeMeet: string): string {
  const docTitle = document.title
    .replace(/\s*-\s*Google Meet$/i, "")
    .replace(/^Meet\s*-\s*/i, "")
    .trim();

  if (docTitle && docTitle !== kodeMeet && !docTitle.toLowerCase().includes("meet")) {
    return docTitle;
  }

  const elJudul = document.querySelector("[data-meeting-title]");
  if (elJudul && elJudul.textContent && elJudul.textContent.trim()) {
    return elJudul.textContent.trim();
  }

  return `Rapat Google Meet (${kodeMeet})`;
}

let widgetInstance: RumaMeetWidget | null = null;
let activeRecorder: MeetTabRecorder | null = null;
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

function inisialisasiWidget() {
  const kodeMeet = dapatkanKodeMeet();
  if (!kodeMeet) return;

  if (document.getElementById("ruma-meet-widget-root")) {
    return;
  }

  const judulMeet = dapatkanJudulMeet(kodeMeet);

  keadaanSekarang = {
    status: "siap",
    detik: 0,
    audioLevel: 0,
    totalChunk: 0,
    sesiUuid: null,
    sesiUrl: null,
    judul: judulMeet,
    kodeMeet,
    galat: null,
  };

  widgetInstance = new RumaMeetWidget(cssStyles, keadaanSekarang, {
    onMulai: async (judul, includeMic) => {
      // Ambil autentikasi dan URL server ruma. dari background
      chrome.runtime.sendMessage(
        { tipe: "GET_SESSION_AUTH" },
        async (
          res:
            | {
                ok: boolean;
                rumaUrl: string;
                authToken: string;
                kategoriDefault?: string;
                error?: string;
              }
            | undefined
        ) => {
          if (chrome.runtime.lastError || !res || !res.ok) {
            const pesan =
              res?.error ||
              chrome.runtime.lastError?.message ||
              "Belum terhubung ke ruma. Buka popup ekstensi untuk masuk atau periksa koneksi.";
            widgetInstance?.perbaruiKeadaan({
              ...keadaanSekarang,
              status: "galat",
              galat: pesan,
            });
            return;
          }

          try {
            activeRecorder = new MeetTabRecorder({
              judul,
              kodeMeet,
              includeMic,
              kategori: res.kategoriDefault,
              rumaUrl: res.rumaUrl,
              authToken: res.authToken,
              onUpdateState: (parsial) => {
                keadaanSekarang = { ...keadaanSekarang, ...parsial };
                widgetInstance?.perbaruiKeadaan(keadaanSekarang);
                void chrome.runtime
                  .sendMessage({
                    tipe: "RECORDING_STATE_UPDATED",
                    keadaan: keadaanSekarang,
                  })
                  .catch(() => undefined);
              },
              onAudioLevel: (level) => {
                widgetInstance?.perbaruiLevelAudio(level);
              },
            });

            await activeRecorder.mulai();
          } catch (err) {
            console.error("Gagal memulai perekaman:", err);
            // Galat sudah di-handle di dalam recorder
          }
        }
      );
    },
    onJeda: () => {
      activeRecorder?.jeda();
    },
    onLanjut: () => {
      activeRecorder?.lanjut();
    },
    onBerhenti: () => {
      if (activeRecorder) {
        void activeRecorder.berhenti().finally(() => {
          activeRecorder = null;
        });
      }
    },
  });

  // Sinkronkan keadaan rekaman dari background jika ada
  chrome.runtime.sendMessage({ tipe: "GET_RECORDING_STATE" }, (keadaan: KeadaanPerekam | undefined) => {
    if (keadaan && keadaan.status !== "siap") {
      keadaanSekarang = keadaan;
      widgetInstance?.perbaruiKeadaan(keadaan);
    }
  });
}

// Pasang listener pesan dari background service worker atau popup
chrome.runtime.onMessage.addListener((pesan: PesanEkstensi) => {
  if (pesan.tipe === "RECORDING_STATE_UPDATED") {
    keadaanSekarang = pesan.keadaan;
    widgetInstance?.perbaruiKeadaan(pesan.keadaan);
    if (pesan.keadaan.audioLevel !== undefined) {
      widgetInstance?.perbaruiLevelAudio(pesan.keadaan.audioLevel);
    }
    return;
  }

  if (pesan.tipe === "PAUSE_RECORDING" && activeRecorder) {
    activeRecorder.jeda();
    return;
  }

  if (pesan.tipe === "RESUME_RECORDING" && activeRecorder) {
    activeRecorder.lanjut();
    return;
  }

  if (pesan.tipe === "STOP_RECORDING" && activeRecorder) {
    void activeRecorder.berhenti().finally(() => {
      activeRecorder = null;
    });
    return;
  }
});

// Pantau perubahan URL (karena Google Meet adalah SPA)
let urlTerakhir = location.href;
const observerUrl = new MutationObserver(() => {
  if (location.href !== urlTerakhir) {
    urlTerakhir = location.href;
    inisialisasiWidget();
  }
});

observerUrl.observe(document, { subtree: true, childList: true });

// Jalankan inisialisasi awal saat script dimuat
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inisialisasiWidget);
} else {
  inisialisasiWidget();
}
