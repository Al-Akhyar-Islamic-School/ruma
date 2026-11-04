import puppeteer, { type Browser, type Page } from "puppeteer";

export type MeetBotConfig = {
  meetingUrl: string;
  botName?: string;
  rumaApiUrl?: string;
  authToken?: string;
  headless?: boolean;
  onStatusChange?: (status: string) => void;
  onTranscriptSegment?: (speaker: string, text: string) => void;
};

export class MeetBot {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isRunning: boolean = false;
  private config: Required<Omit<MeetBotConfig, "authToken">> & { authToken?: string };

  constructor(cfg: MeetBotConfig) {
    this.config = {
      meetingUrl: cfg.meetingUrl,
      botName: cfg.botName || "ruma. Notulis (Al Akhyar)",
      rumaApiUrl: (cfg.rumaApiUrl || "http://localhost:5173").replace(/\/+$/, ""),
      authToken: cfg.authToken,
      headless: cfg.headless !== undefined ? cfg.headless : true,
      onStatusChange: cfg.onStatusChange || (() => undefined),
      onTranscriptSegment: cfg.onTranscriptSegment || (() => undefined),
    };
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.config.onStatusChange("Menyiapkan bot peramban Chromium...");

    this.browser = await puppeteer.launch({
      headless: this.config.headless ? "shell" : false,
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--window-size=1280,800",
      ],
      defaultViewport: { width: 1280, height: 800 },
    });

    this.page = await this.browser.newPage();

    // Berikan izin mikrofon & kamera secara otomatis
    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions("https://meet.google.com", ["microphone", "camera"]);

    await this.joinMeeting();
  }

  private async joinMeeting(): Promise<void> {
    if (!this.page) return;
    const page = this.page;

    this.config.onStatusChange(`Membuka URL rapat: ${this.config.meetingUrl}`);
    await page.goto(this.config.meetingUrl, { waitUntil: "networkidle2", timeout: 60_000 });

    // Tunggu halaman pra-gabung siap
    await new Promise((r) => setTimeout(r, 3000));

    // 1. Matikan kamera dan mikrofon bot sebelum bergabung
    this.config.onStatusChange("Mematikan kamera dan mikrofon bot...");
    await page.evaluate(() => {
      // Tombol matikan mic & kamera biasanya memiliki aria-label
      const tombolMic = document.querySelector<HTMLElement>('[aria-label*="microphone" i], [aria-label*="mikrofon" i]');
      if (tombolMic && tombolMic.getAttribute("data-is-muted") !== "true") {
        tombolMic.click();
      }

      const tombolKamera = document.querySelector<HTMLElement>('[aria-label*="camera" i], [aria-label*="kamera" i]');
      if (tombolKamera && tombolKamera.getAttribute("data-is-muted") !== "true") {
        tombolKamera.click();
      }
    });

    // 2. Isi nama bot jika diminta (untuk pengguna yang belum login Google)
    try {
      const inputNama = await page.$('input[type="text"]');
      if (inputNama) {
        this.config.onStatusChange(`Mengisi nama partisipan: ${this.config.botName}`);
        await inputNama.click({ clickCount: 3 });
        await inputNama.type(this.config.botName, { delay: 50 });
      }
    } catch {
      // Abaikan jika akun sudah login Google
    }

    await new Promise((r) => setTimeout(r, 1000));

    // 3. Klik tombol "Minta bergabung" / "Gabung sekarang" / "Ask to join"
    this.config.onStatusChange("Mengklik tombol Minta Bergabung (Ask to Join)...");
    const tombolTergabung = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
      const btn = buttons.find((b) => {
        const text = (b.textContent || "").toLowerCase();
        return (
          text.includes("ask to join") ||
          text.includes("minta bergabung") ||
          text.includes("join now") ||
          text.includes("gabung sekarang")
        );
      });
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!tombolTergabung) {
      // Coba klik tombol dengan jsname standar Google Meet
      const btnJsname = await page.$('button[jsname="Qx7uuf"]');
      if (btnJsname) await btnJsname.click();
    }

    this.config.onStatusChange("Menunggu persetujuan tuan rumah (Host) untuk masuk ke rapat...");
    await this.monitorMeetingRoom();
  }

  private async monitorMeetingRoom(): Promise<void> {
    if (!this.page) return;
    const page = this.page;

    // Tunggu sampai bot berhasil masuk ke dalam ruangan rapat (misal ada tombol tinggalkan panggilan)
    let teradmit = false;
    for (let i = 0; i < 60; i++) {
      if (!this.isRunning) return;

      teradmit = await page.evaluate(() => {
        // Cek adanya tombol 'Leave call' atau tombol menu kontrol rapat
        const leaveBtn = document.querySelector('[aria-label*="Leave call" i], [aria-label*="Tinggalkan" i]');
        return Boolean(leaveBtn);
      });

      if (teradmit) break;
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!teradmit) {
      this.config.onStatusChange("Waktu tunggu habis atau Host menolak permintaan gabung bot.");
      await this.stop();
      return;
    }

    this.config.onStatusChange("🎉 Bot berhasil masuk ke dalam rapat! Mengaktifkan pemantauan transkrip & audio...");

    // Aktifkan Closed Captions bawaan Google Meet
    try {
      await page.keyboard.press("c");
    } catch {
      // Abaikan jika sudah aktif
    }

    // Pasang listener pengamat pembicara dan transkrip langsung
    await page.exposeFunction("onBotCaption", (pembicara: string, teks: string) => {
      this.config.onTranscriptSegment(pembicara, teks);
    });

    await page.evaluate(() => {
      // Observer teks caption Google Meet
      let teksTerakhir = "";
      const observer = new MutationObserver(() => {
        const containers = document.querySelectorAll("[data-sender-name]");
        containers.forEach((c) => {
          const nama = c.getAttribute("data-sender-name") || "Peserta";
          const teks = (c.textContent || "").trim();
          if (teks && teks !== teksTerakhir) {
            teksTerakhir = teks;
            // @ts-expect-error fungsi terekspos dari Puppeteer
            window.onBotCaption(nama, teks);
          }
        });
      });

      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });

    // Loop pemantauan status rapat (cek jika panggilan selesai atau semua peserta keluar)
    while (this.isRunning) {
      const selesai = await page.evaluate(() => {
        // Cek jika ada notifikasi "You left the meeting" atau "Meeting ended"
        const endedText = document.body.innerText.toLowerCase();
        return endedText.includes("you left the meeting") || endedText.includes("rapat telah berakhir");
      });

      if (selesai) {
        this.config.onStatusChange("Panggilan rapat telah berakhir.");
        break;
      }

      await new Promise((r) => setTimeout(r, 4000));
    }

    await this.stop();
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.config.onStatusChange("Menutup koneksi bot rapat...");

    if (this.page) {
      try {
        // Klik tombol tinggalkan panggilan jika masih aktif
        await this.page.evaluate(() => {
          const leaveBtn = document.querySelector<HTMLElement>(
            '[aria-label*="Leave call" i], [aria-label*="Tinggalkan" i]'
          );
          if (leaveBtn) leaveBtn.click();
        });
      } catch {
        // Abaikan
      }
      this.page = null;
    }

    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }

    this.config.onStatusChange("Bot telah selesai dan keluar dari rapat.");
  }
}
