import { RumaApiClient } from "../lib/api";
import { ambilTokenAutentikasi, muatKonfigurasi, simpanKonfigurasi } from "../lib/config";
import type { KeadaanPerekam, PesanEkstensi } from "../types";

const statusAuthEl = document.getElementById("status-auth") as HTMLDivElement;
const authActionsEl = document.getElementById("auth-actions") as HTMLDivElement;
const btnLogin = document.getElementById("btn-login") as HTMLButtonElement;
const inpUrl = document.getElementById("inp-url") as HTMLInputElement;
const inpToken = document.getElementById("inp-token") as HTMLInputElement;
const chkMic = document.getElementById("chk-mic") as HTMLInputElement;
const btnSimpan = document.getElementById("btn-simpan") as HTMLButtonElement;
const linkDashboard = document.getElementById("link-dashboard") as HTMLAnchorElement;

const cardRekaman = document.getElementById("card-rekaman") as HTMLDivElement;
const rekamJudul = document.getElementById("rekam-judul") as HTMLDivElement;
const rekamTimer = document.getElementById("rekam-timer") as HTMLDivElement;
const btnPopupSelesai = document.getElementById("btn-popup-selesai") as HTMLButtonElement;

function formatWaktu(totalDetik: number): string {
  const jam = Math.floor(totalDetik / 3600);
  const sisa = totalDetik % 3600;
  const mnt = Math.floor(sisa / 60);
  const dtk = sisa % 60;
  if (jam > 0) {
    return `${jam}:${String(mnt).padStart(2, "0")}:${String(dtk).padStart(2, "0")}`;
  }
  return `${String(mnt).padStart(2, "0")}:${String(dtk).padStart(2, "0")}`;
}

function perbaruiUIRekaman(keadaan: KeadaanPerekam) {
  if (keadaan.status === "merekam" || keadaan.status === "dijeda" || keadaan.status === "mengunggah") {
    cardRekaman.style.display = "flex";
    rekamJudul.textContent = keadaan.judul || "Rapat Google Meet";
    rekamTimer.textContent = formatWaktu(keadaan.detik);
    if (keadaan.status === "mengunggah") {
      rekamTimer.textContent = "Mengunggah...";
      btnPopupSelesai.disabled = true;
    } else {
      btnPopupSelesai.disabled = false;
    }
  } else {
    cardRekaman.style.display = "none";
  }
}

async function periksaAutentikasi(rumaUrl: string) {
  statusAuthEl.className = "popup-status-badge status-disconnected";
  statusAuthEl.textContent = "Memeriksa status login...";
  authActionsEl.style.display = "none";

  try {
    const token = await ambilTokenAutentikasi(rumaUrl);
    if (!token) {
      statusAuthEl.textContent = "Belum Terhubung ke ruma.";
      authActionsEl.style.display = "flex";
      return;
    }

    const api = new RumaApiClient(rumaUrl, token);
    const me = await api.getMe();

    statusAuthEl.className = "popup-status-badge status-connected";
    statusAuthEl.innerHTML = `
      <span>Terhubung: <strong>${me.name}</strong></span>
      <span style="font-size:10px; color:#166534; opacity:0.8;">(${me.role})</span>
    `;
    authActionsEl.style.display = "none";
  } catch (err) {
    statusAuthEl.className = "popup-status-badge status-disconnected";
    statusAuthEl.textContent = err instanceof Error ? err.message : "Gagal terhubung.";
    authActionsEl.style.display = "flex";
  }
}

async function inisialisasi() {
  const cfg = await muatKonfigurasi();
  inpUrl.value = cfg.rumaUrl;
  inpToken.value = cfg.authToken || "";
  chkMic.checked = cfg.sertakanMic;

  linkDashboard.href = cfg.rumaUrl;

  await periksaAutentikasi(cfg.rumaUrl);

  btnSimpan.addEventListener("click", async () => {
    btnSimpan.disabled = true;
    btnSimpan.textContent = "Menyimpan...";

    const rumaUrl = inpUrl.value.trim().replace(/\/+$/, "") || "http://localhost:5173";
    const authToken = inpToken.value.trim() || undefined;
    const sertakanMic = chkMic.checked;

    await simpanKonfigurasi({ rumaUrl, authToken, sertakanMic });

    linkDashboard.href = rumaUrl;
    await periksaAutentikasi(rumaUrl);

    btnSimpan.disabled = false;
    btnSimpan.textContent = "Tersimpan ✅";
    setTimeout(() => {
      btnSimpan.textContent = "Simpan Pengaturan";
    }, 1500);
  });

  btnLogin.addEventListener("click", () => {
    const url = inpUrl.value.trim() || "http://localhost:5173";
    void chrome.tabs.create({ url });
  });

  btnPopupSelesai.addEventListener("click", () => {
    btnPopupSelesai.disabled = true;
    btnPopupSelesai.textContent = "Menyelesaikan...";
    chrome.runtime.sendMessage({ tipe: "STOP_RECORDING" });
  });

  // Ambil keadaan rekaman aktif jika ada
  chrome.runtime.sendMessage({ tipe: "GET_RECORDING_STATE" }, (res: KeadaanPerekam | undefined) => {
    if (res) perbaruiUIRekaman(res);
  });
}

chrome.runtime.onMessage.addListener((pesan: PesanEkstensi) => {
  if (pesan.tipe === "RECORDING_STATE_UPDATED") {
    perbaruiUIRekaman(pesan.keadaan);
  }
});

void inisialisasi();
