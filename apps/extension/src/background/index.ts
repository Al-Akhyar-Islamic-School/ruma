import { RumaApiClient } from "../lib/api";
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
        const authData = await ambilTokenAutentikasi(cfg.rumaUrl);
        if (!authData) {
          kirimBalasan({
            ok: false,
            error: "Belum masuk ke ruma. Buka https://ruma.alakhyar.sch.id dan login dengan Google, lalu coba lagi.",
          });
          return;
        }
        kirimBalasan({
          ok: true,
          rumaUrl: authData.activeUrl,
          authToken: authData.token,
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

  if (pesan.tipe === "BG_BUAT_SESI") {
    void (async () => {
      try {
        const cfg = await muatKonfigurasi();
        const authData = await ambilTokenAutentikasi(cfg.rumaUrl);
        if (!authData) {
          kirimBalasan({
            ok: false,
            error: "Belum masuk ke ruma. Buka https://ruma.alakhyar.sch.id dan login dengan Google, lalu coba lagi.",
          });
          return;
        }
        const client = new RumaApiClient(authData.activeUrl, authData.token);
        const res = await client.buatSesi({
          judul: pesan.judul,
          mime: pesan.mime,
          kodeMeet: pesan.kodeMeet,
          kategori: pesan.kategori,
        });
        const sesiUrl = `${authData.activeUrl.replace(/\/+$/, "")}/sesi/${res.uuid}`;
        kirimBalasan({ ok: true, uuid: res.uuid, sesiUrl });
      } catch (err) {
        console.error("Gagal membuat sesi di background:", err);
        kirimBalasan({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return true;
  }

  if (pesan.tipe === "BG_UNGGAH_CHUNK") {
    void (async () => {
      try {
        const cfg = await muatKonfigurasi();
        const authData = await ambilTokenAutentikasi(cfg.rumaUrl);
        if (!authData) {
          kirimBalasan({ ok: false, error: "Sesi ruma. tidak ditemukan." });
          return;
        }
        const client = new RumaApiClient(authData.activeUrl, authData.token);
        const binaryString = atob(pesan.dataBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "audio/webm;codecs=opus" });
        await client.unggahChunk(pesan.uuid, pesan.seq, blob);
        kirimBalasan({ ok: true });
      } catch (err) {
        console.error(`Gagal unggah chunk ${pesan.seq} di background:`, err);
        kirimBalasan({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return true;
  }

  if (pesan.tipe === "BG_SELESAIKAN_SESI") {
    void (async () => {
      try {
        const cfg = await muatKonfigurasi();
        const authData = await ambilTokenAutentikasi(cfg.rumaUrl);
        if (!authData) {
          kirimBalasan({ ok: false, error: "Sesi ruma. tidak ditemukan." });
          return;
        }
        const client = new RumaApiClient(authData.activeUrl, authData.token);
        const res = await client.selesaikanSesi({
          uuid: pesan.uuid,
          jumlahChunk: pesan.jumlahChunk,
          durasiDetik: pesan.durasiDetik,
          penandaDetik: pesan.penandaDetik,
        });
        kirimBalasan({ ok: true, res });
      } catch (err) {
        console.error("Gagal menyelesaikan sesi di background:", err);
        kirimBalasan({ ok: false, error: err instanceof Error ? err.message : String(err) });
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
