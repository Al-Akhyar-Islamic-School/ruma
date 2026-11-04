import { ambilTokenAutentikasi, muatKonfigurasi } from "../lib/config";
import type { KeadaanPerekam, PesanEkstensi } from "../types";

const OFFSCREEN_PATH = "src/offscreen/index.html";

let tabRekamanAktif: number | null = null;
let keadaanCache: KeadaanPerekam = {
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

async function pastikanOffscreenAktif(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)],
  });

  if (contexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: [
      chrome.offscreen.Reason.USER_MEDIA,
      chrome.offscreen.Reason.AUDIO_PLAYBACK,
    ],
    justification: "Merekam suara rapat Google Meet dan memutar ulang ke headphone/speaker",
  });
}

function perbaruiBadge(status: string) {
  if (status === "merekam") {
    void chrome.action.setBadgeText({ text: "REC" });
    void chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
  } else if (status === "dijeda") {
    void chrome.action.setBadgeText({ text: "PAUS" });
    void chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
  } else if (status === "mengunggah") {
    void chrome.action.setBadgeText({ text: "UP" });
    void chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
  } else {
    void chrome.action.setBadgeText({ text: "" });
  }
}

// Teruskan pesan ke offscreen document
async function kirimKeOffscreen(pesan: PesanEkstensi): Promise<unknown> {
  await pastikanOffscreenAktif();
  return chrome.runtime.sendMessage(pesan);
}

// Pantau jika tab Google Meet ditutup selagi merekam
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === tabRekamanAktif) {
    tabRekamanAktif = null;
    void kirimKeOffscreen({ tipe: "OFFSCREEN_STOP" }).catch(() => undefined);
  }
});

chrome.runtime.onMessage.addListener((pesan: PesanEkstensi, sender, kirimBalasan) => {
  if (pesan.tipe === "GET_SESSION_AUTH") {
    void (async () => {
      try {
        const cfg = await muatKonfigurasi();
        const authToken = await ambilTokenAutentikasi(cfg.rumaUrl);
        if (!authToken) {
          kirimBalasan({
            ok: false,
            error: "Belum masuk ke ruma. Buka web ruma. atau simpan token sesi di popup ekstensi.",
          });
          return;
        }
        kirimBalasan({
          ok: true,
          rumaUrl: cfg.rumaUrl,
          authToken,
          kategoriDefault: cfg.kategoriDefault,
          sertakanMic: cfg.sertakanMic,
        });
      } catch (err) {
        kirimBalasan({
          ok: false,
          error: err instanceof Error ? err.message : "Gagal mengambil sesi ruma.",
        });
      }
    })();
    return true;
  }

  if (pesan.tipe === "START_RECORDING") {
    const targetTabId = pesan.targetTabId ?? sender.tab?.id;
    if (targetTabId) {
      tabRekamanAktif = targetTabId;
      void chrome.tabs.sendMessage(targetTabId, {
        tipe: "START_RECORDING_TAB",
        judul: pesan.judul,
        kodeMeet: pesan.kodeMeet,
        includeMic: pesan.includeMic,
        kategori: pesan.kategori,
      }).catch(() => undefined);
      kirimBalasan({ ok: true });
    } else {
      kirimBalasan({ ok: false, error: "Tab Google Meet tidak ditemukan." });
    }
    return true;
  }

  if (pesan.tipe === "PAUSE_RECORDING") {
    void kirimKeOffscreen({ tipe: "OFFSCREEN_PAUSE" })
      .then(() => kirimBalasan({ ok: true }))
      .catch((err: unknown) => kirimBalasan({ ok: false, error: String(err) }));
    return true;
  }

  if (pesan.tipe === "RESUME_RECORDING") {
    void kirimKeOffscreen({ tipe: "OFFSCREEN_RESUME" })
      .then(() => kirimBalasan({ ok: true }))
      .catch((err: unknown) => kirimBalasan({ ok: false, error: String(err) }));
    return true;
  }

  if (pesan.tipe === "STOP_RECORDING") {
    tabRekamanAktif = null;
    void kirimKeOffscreen({ tipe: "OFFSCREEN_STOP" })
      .then(() => kirimBalasan({ ok: true }))
      .catch((err: unknown) => kirimBalasan({ ok: false, error: String(err) }));
    return true;
  }

  if (pesan.tipe === "GET_RECORDING_STATE") {
    void kirimKeOffscreen({ tipe: "OFFSCREEN_GET_STATE" })
      .then((state) => {
        if (state) {
          keadaanCache = state as KeadaanPerekam;
        }
        kirimBalasan(keadaanCache);
      })
      .catch(() => {
        kirimBalasan(keadaanCache);
      });
    return true;
  }

  if (pesan.tipe === "RECORDING_STATE_UPDATED") {
    keadaanCache = pesan.keadaan;
    perbaruiBadge(pesan.keadaan.status);

    // Siarkan pembaruan ke seluruh tab (termasuk tab Google Meet dan popup)
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, pesan).catch(() => undefined);
        }
      });
    });
    return false;
  }

  return false;
});
