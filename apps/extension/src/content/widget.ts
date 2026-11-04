import type { KeadaanPerekam } from "../types";

export type WidgetListener = {
  onMulai: (judul: string, includeMic: boolean) => void;
  onJeda: () => void;
  onLanjut: () => void;
  onBerhenti: () => void;
};

export class RumaMeetWidget {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private keadaan: KeadaanPerekam;
  private listeners: WidgetListener;
  private terminimalisasi: boolean = false;
  private inputJudulTersimpan: string = "";
  private sertakanMicTersimpan: boolean = true;

  constructor(
    cssText: string,
    keadaanAwal: KeadaanPerekam,
    listeners: WidgetListener
  ) {
    this.keadaan = keadaanAwal;
    this.listeners = listeners;
    this.inputJudulTersimpan = keadaanAwal.judul;

    this.host = document.createElement("div");
    this.host.id = "ruma-meet-widget-root";
    this.shadow = this.host.attachShadow({ mode: "open" });

    const styleEl = document.createElement("style");
    styleEl.textContent = cssText;
    this.shadow.appendChild(styleEl);

    const container = document.createElement("div");
    container.id = "ruma-container";
    this.shadow.appendChild(container);

    document.body.appendChild(this.host);
    this.render();
  }

  public perbaruiKeadaan(baru: KeadaanPerekam) {
    this.keadaan = baru;
    this.render();
  }
  public perbaruiLevelAudio(level: number) {
    const bars = this.shadow.querySelectorAll<HTMLDivElement>(".ruma-bar");
    if (bars.length === 0) return;

    bars.forEach((bar, idx) => {
      const variasi = (Math.sin(idx * 1.5 + Date.now() / 150) + 1) / 2;
      const t = Math.max(4, Math.round(level * 20 * (0.6 + 0.4 * variasi)));
      bar.style.height = `${t}px`;
    });
  }

  private formatTimer(totalDetik: number): string {
    const jam = Math.floor(totalDetik / 3600);
    const sisa = totalDetik % 3600;
    const mnt = Math.floor(sisa / 60);
    const dtk = sisa % 60;

    if (jam > 0) {
      return `${jam}:${String(mnt).padStart(2, "0")}:${String(dtk).padStart(2, "0")}`;
    }
    return `${String(mnt).padStart(2, "0")}:${String(dtk).padStart(2, "0")}`;
  }

  private render() {
    const container = this.shadow.querySelector("#ruma-container");
    if (!container) return;

    if (this.terminimalisasi) {
      this.renderMinimized(container);
      return;
    }

    const { status, detik, totalChunk, sesiUrl, galat } = this.keadaan;
    const sedangRekam = status === "merekam" || status === "dijeda";

    let bodyHtml = "";

    if (galat) {
      const isLoginError = galat.toLowerCase().includes("masuk") || galat.toLowerCase().includes("login");
      bodyHtml = `
        <div class="ruma-alert-error">${galat}</div>
        <div class="ruma-btn-row">
          ${
            isLoginError
              ? `<a href="https://ruma.alakhyar.sch.id" target="_blank" class="ruma-btn-primary" style="text-decoration:none; text-align:center;">Buka ruma. ↗</a>`
              : ""
          }
          <button id="btn-kembali" class="ruma-btn-secondary">Kembali</button>
        </div>
      `;
    } else if (status === "siap" || status === "meminta_izin") {
      bodyHtml = `
        <div class="ruma-field">
          <label class="ruma-label" for="inp-judul">Judul Rapat</label>
          <input
            id="inp-judul"
            class="ruma-input"
            type="text"
            placeholder="Judul rapat atau agenda..."
            value="${this.inputJudulTersimpan.replace(/"/g, "&quot;")}"
            ${status === "meminta_izin" ? "disabled" : ""}
          />
        </div>
        <label class="ruma-checkbox-row">
          <input
            id="chk-mic"
            type="checkbox"
            ${this.sertakanMicTersimpan ? "checked" : ""}
            ${status === "meminta_izin" ? "disabled" : ""}
          />
          <span>Sertakan mikrofon saya (audio ganda)</span>
        </label>
        <button
          id="btn-mulai"
          class="ruma-btn-primary"
          ${status === "meminta_izin" ? "disabled" : ""}
        >
          ${status === "meminta_izin" ? "Meminta izin..." : "🔴 Rekam Rapat ke ruma."}
        </button>
      `;
    } else if (sedangRekam) {
      bodyHtml = `
        <div class="ruma-recording-box">
          <div class="ruma-timer-wrap">
            <div class="ruma-dot-rec ${status === "dijeda" ? "ruma-dot-paused" : ""}"></div>
            <div class="ruma-timer">${this.formatTimer(detik)}</div>
          </div>
          <div class="ruma-meter-bars">
            <div class="ruma-bar"></div>
            <div class="ruma-bar"></div>
            <div class="ruma-bar"></div>
            <div class="ruma-bar"></div>
            <div class="ruma-bar"></div>
            <div class="ruma-bar"></div>
            <div class="ruma-bar"></div>
          </div>
          <div class="ruma-info-text">
            ${status === "dijeda" ? "Rekaman Dijeda" : `Merekam rapat · ${totalChunk} potongan tersimpan`}
          </div>
        </div>
        <div class="ruma-btn-row">
          <button id="btn-jeda" class="ruma-btn-secondary">
            ${status === "dijeda" ? "▶ Lanjut" : "⏸ Jeda"}
          </button>
          <button id="btn-selesai" class="ruma-btn-primary ruma-btn-danger">
            ⏹ Selesai & Buat Notulen
          </button>
        </div>
      `;
    } else if (status === "mengunggah") {
      bodyHtml = `
        <div class="ruma-recording-box">
          <div style="font-size: 13px; font-weight: 600; color: #153e35;">
            Menyimpan Rekaman...
          </div>
          <div style="font-size: 11px; color: #64748b;">
            Mengunggah ${totalChunk} potongan audio ke server ruma.
          </div>
        </div>
      `;
    } else if (status === "selesai") {
      bodyHtml = `
        <div class="ruma-recording-box" style="background: #f0fdf4; border-color: #86efac;">
          <div style="font-size: 14px; font-weight: 700; color: #166534;">
            Rapat Selesai ✨
          </div>
          <div style="font-size: 11px; color: #15803d; text-align: center;">
            AI Whisper & Gemini sedang memproses notulen rapat Anda.
          </div>
        </div>
        ${
          sesiUrl
            ? `<a id="link-notulen" href="${sesiUrl}" target="_blank" class="ruma-btn-primary" style="text-decoration:none;">
                📄 Buka Notulen di ruma.
              </a>`
            : ""
        }
        <button id="btn-rekam-lagi" class="ruma-btn-secondary">Rekam Sesi Baru</button>
      `;
    }

    container.innerHTML = `
      <div class="ruma-widget">
        <div class="ruma-header">
          <div class="ruma-brand">
            <span class="ruma-logo">ruma<span>.</span></span>
            <span class="ruma-tag">Google Meet</span>
          </div>
          <div class="ruma-actions-top">
            <button id="btn-minimize" class="ruma-btn-icon" title="Kecilkan widget">—</button>
          </div>
        </div>
        <div class="ruma-body">
          ${bodyHtml}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderMinimized(container: Element) {
    const { status, detik } = this.keadaan;
    const sedangRekam = status === "merekam" || status === "dijeda";

    container.innerHTML = `
      <div id="btn-maximize" class="ruma-minimized">
        <span class="ruma-logo" style="font-size:12px;">ruma<span>.</span></span>
        ${
          sedangRekam
            ? `<div class="ruma-dot-rec ${status === "dijeda" ? "ruma-dot-paused" : ""}" style="width:8px;height:8px;"></div>
               <span>${this.formatTimer(detik)}</span>`
            : `<span>Google Meet</span>`
        }
      </div>
    `;

    const maxBtn = this.shadow.querySelector("#btn-maximize");
    if (maxBtn) {
      maxBtn.addEventListener("click", () => {
        this.terminimalisasi = false;
        this.render();
      });
    }
  }

  private attachEventListeners() {
    const minBtn = this.shadow.querySelector("#btn-minimize");
    if (minBtn) {
      minBtn.addEventListener("click", () => {
        this.terminimalisasi = true;
        this.render();
      });
    }

    const inpJudul = this.shadow.querySelector<HTMLInputElement>("#inp-judul");
    if (inpJudul) {
      inpJudul.addEventListener("input", () => {
        this.inputJudulTersimpan = inpJudul.value;
      });
    }

    const chkMic = this.shadow.querySelector<HTMLInputElement>("#chk-mic");
    if (chkMic) {
      chkMic.addEventListener("change", () => {
        this.sertakanMicTersimpan = chkMic.checked;
      });
    }

    const btnMulai = this.shadow.querySelector("#btn-mulai");
    if (btnMulai) {
      btnMulai.addEventListener("click", () => {
        const judul = this.inputJudulTersimpan.trim() || this.keadaan.judul;
        this.listeners.onMulai(judul, this.sertakanMicTersimpan);
      });
    }

    const btnJeda = this.shadow.querySelector("#btn-jeda");
    if (btnJeda) {
      btnJeda.addEventListener("click", () => {
        if (this.keadaan.status === "merekam") {
          this.listeners.onJeda();
        } else if (this.keadaan.status === "dijeda") {
          this.listeners.onLanjut();
        }
      });
    }

    const btnSelesai = this.shadow.querySelector<HTMLButtonElement>("#btn-selesai");
    if (btnSelesai) {
      btnSelesai.addEventListener("click", () => {
        btnSelesai.disabled = true;
        btnSelesai.textContent = "Menyimpan...";
        const btnJedaEl = this.shadow.querySelector<HTMLButtonElement>("#btn-jeda");
        if (btnJedaEl) btnJedaEl.disabled = true;
        this.listeners.onBerhenti();
      });
    }

    const btnKembali = this.shadow.querySelector("#btn-kembali");
    if (btnKembali) {
      btnKembali.addEventListener("click", () => {
        this.keadaan.galat = null;
        this.keadaan.status = "siap";
        this.render();
      });
    }

    const btnRekamLagi = this.shadow.querySelector("#btn-rekam-lagi");
    if (btnRekamLagi) {
      btnRekamLagi.addEventListener("click", () => {
        this.keadaan.status = "siap";
        this.keadaan.detik = 0;
        this.keadaan.totalChunk = 0;
        this.keadaan.sesiUuid = null;
        this.keadaan.sesiUrl = null;
        this.render();
      });
    }
  }
}
