# Rencana: Integrasi ruma. dengan Google Meet

**Status:** Selesai dikerjakan (Tahap 1: Ekstensi Chrome Manifest V3 `apps/extension` siap digunakan; build `pnpm build:extension` menghasilkan bundel siap pasang di Google Chrome).  
**Tujuan:** Pengguna dapat menyusun notulen rapat daring Google Meet secara otomatis ke ruma., menyatu langsung di dalam panggilan Google Meet (`meet.google.com`) dengan rekaman suara peserta rapat + suara mikrofon pengguna sendiri.

---

## 1. Analisis Pendekatan Teknis

Google Meet tidak menyediakan streaming audio langsung (WebRTC) secara bebas ke server pihak ketiga tanpa kehadiran peserta. Ada 3 opsi teknis:

| Opsi | Pendekatan | Cara Kerja | Biaya / Beban Server | Kelebihan & Kekurangan |
|---|---|---|---|---|
| **A (Paling Murah & Mandiri)** | **Ekstensi Chrome / Perekam Tab Peramban** | Pengguna menyalakan rekaman ruma. dari tab Google Meet menggunakan `getDisplayMedia({ audio: true })`. | **Gratis (0$)**, berjalan di browser pengguna | **Kelebihan:** Sangat ringan, tidak butuh infrastruktur server tambahan, privasi sekolah terjaga.<br>**Kekurangan:** Harus dijalankan di laptop/desktop (Chrome/Edge), tidak bisa dari ponsel. |
| **B (Otomatis & Terintegrasi Workspace)** | **Tarik Transkrip Resmi Google Meet (Drive)** | Google Meet Workspace merekam transkrip bawaan ke Google Drive sekolah. ruma. menyedot dokumen transkrip tersebut via Google Drive API dan langsung menganalisisnya dengan Gemini. | **Gratis (0$)** via Workspace Al Akhyar | **Kelebihan:** Suara & nama pembicara (*diarization*) otomatis rapi dari Google Meet; tanpa perlu bot berat.<br>**Kekurangan:** Butuh Google Workspace edisi tertentu (fitur Transkrip Meet aktif). |
| **C (Bot Partisipan Otomatis)** | **Headless Bot (Puppeteer / Chromium di VPS)** | Pengguna memasukkan link `meet.google.com/xxx-xxxx-xxx`. Server VPS ruma. menjalankan instans Chromium yang masuk ke rapat sebagai bot "ruma. Notulis", merekam audio, lalu mengirimkan chunk ke pipeline Whisper ruma. | **Beban CPU/RAM tinggi di VPS** (±1 vCPU dan 1GB RAM per rapat berjalan) | **Kelebihan:** Pengguna bisa dari ponsel/laptop mana saja, bot hadir di rapat.<br>**Kekurangan:** Rawan diblokir Google jika dianggap bot mencurigakan, setup audio virtual (PulseAudio/ALSA) di server rumit. |

---

## 2. Rekomendasi Roadmap Bertahap (Iteratif)

Kita akan mengeksekusi secara bertahap dari yang paling aman & stabil:

### Tahap 1: Perekam Tab Google Meet di Web (Audio Capture)
- Tambahkan pilihan sumber audio di ruma: **"Mikrofon Saja"** atau **"Tab Peramban / Google Meet"**.
- Menggunakan browser API `navigator.mediaDevices.getDisplayMedia({ audio: true, video: false })`.
- Audio suara rapat Meet langsung disambungkan ke audio pipeline Whisper + Gemini yang sudah ada di ruma.

### Tahap 2: Sinkronisasi Transkrip Google Meet dari Google Drive
- Jika sekolah mengaktifkan fitur bawaan *"Transcripts"* di Google Meet, Google otomatis membuat dokumen Google Docs hasil transkrip di Drive host rapat.
- ruma. menambahkan tombol **"Impor Transkrip Google Meet"**:
  1. Pilih berkas transkrip Meet dari Google Drive.
  2. ruma. langsung memproses teks transkrip tersebut dengan Gemini (melewati tahap Whisper).
  3. Notulen resmi, tugas, dan keputusan langsung jadi dalam 10 detik!

### Tahap 3: Bot Partisipan Otomatis (Jika Kebutuhan Membesar)
- Layanan worker terpisah berbasis Docker/Puppeteer yang menerima URL Google Meet dan masuk sebagai peserta pasif untuk merekam.

---

## 3. Implementasi Ekstensi Chrome ruma. (`apps/extension`)

### A. Arsitektur Komponen (Manifest V3)

1. **Content Script (`src/content/`)**:
   - Berjalan otomatis di setiap halaman `https://meet.google.com/*`.
   - Mendeteksi kode rapat (`abc-defg-hij`) dan judul agenda/kalender dari dokumen Google Meet.
   - Memasang floating control widget **ruma. Notulis** berbasis Shadow DOM (terisolasi tanpa konflik gaya CSS dari Google Meet).
   - Fitur widget:
     - Tombol rekam `[ 🔴 Rekam Rapat ke ruma. ]`
     - Pengatur judul rapat & opsi mikrofon pengguna (audio ganda)
     - Timer rapat live & visualisator gelombang audio (VU meter)
     - Tombol `[ ⏸ Jeda / ▶ Lanjut ]` dan `[ ⏹ Selesai & Buat Notulen ]`
     - Tombol minimize `—` untuk mengecilkan widget menjadi badge mengambang.

2. **Offscreen Document (`src/offscreen/`)**:
   - Dibuat otomatis saat perekaman dimulai untuk menjalankan Web Audio API & MediaRecorder.
   - Menangkap stream audio tab Meet menggunakan `chrome.tabCapture` via `streamId`.
   - Menangkap stream mikrofon lokal pengguna (`navigator.mediaDevices.getUserMedia`).
   - Mencampur (*audio mixing*) kedua stream ke dalam satu audio channel berstandar Whisper (Opus 32 kbps).
   - **Anti-bisu:** Meneruskan tab audio ke speaker (`audioCtx.destination`) agar pengguna tetap mendengar lawan bicara dengan jelas.
   - Mengirimkan potongan audio (chunks) tiap 30 detik ke API ruma. (`PUT /sesi/:uuid/chunks/:seq`) untuk keandalan zero-loss.

3. **Background Service Worker (`src/background/`)**:
   - Menangani komunikasi pesan antar tab, offscreen, dan popup.
   - Mengambil token autentikasi sesi ruma. otomatis dari cookie browser atau konfigurasi.
   - Menampilkan badge status di ikon ekstensi (`REC`, `PAUS`, `UP`).
   - Mengamankan rekaman bila tab Google Meet ditutup pengguna secara tidak sengaja.

4. **Popup Ekstensi (`src/popup/`)**:
   - Memeriksa status login dan identitas akun ruma.
   - Mengatur URL server ruma. (default `http://localhost:5173` atau domain produksi VPS sekolah).
   - Menampilkan status rekaman yang sedang berjalan secara langsung.

---

## 4. Panduan Memasang Ekstensi di Google Chrome

1. **Build Ekstensi:**
   ```bash
   pnpm build:extension
   ```
   Artefak siap pasang akan tersedia di folder `apps/extension/dist`.

2. **Muat di Google Chrome:**
   - Buka browser Chrome dan tuju: `chrome://extensions`
   - Aktifkan toggle **"Developer mode"** di pojok kanan atas.
   - Klik tombol **"Load unpacked"** di pojok kiri atas.
   - Pilih folder: `<lokasi_projek>/apps/extension/dist`.

3. **Mulai Rapat Google Meet:**
   - Masuk ke salah satu rapat di `https://meet.google.com/`.
   - Widget hijau elegan **ruma.** akan muncul di sudut kanan atas layar Meet.
   - Klik **"🔴 Rekam Rapat ke ruma."** untuk mulai.
   - Setelah selesai, klik **"⏹ Selesai & Buat Notulen"**; halaman notulen ruma. akan langsung terbuka otomatis di tab baru dan diproses AI!
