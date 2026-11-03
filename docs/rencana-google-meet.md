# Rencana: Integrasi ruma. dengan Google Meet

**Status:** rencana arsitektur (iterasi bertahap).  
**Tujuan:** pengguna dapat menyusun notulen rapat daring Google Meet secara otomatis ke ruma., baik melalui rekaman audio langsung maupun transkrip resmi Meet.

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

## 3. Checklist Todo Tahap 1 & 2

### Tahap 1 (Audio Tab Meet)
- [ ] Buat hook `features/rekam/use-tab-audio.ts` (dukungan `getDisplayMedia`).
- [ ] Tambahkan toggle pilihan input di form setup rekaman (`/rekam/baru`): *Mikrofon Ponsel/Ruangan* vs *Audio Panggilan (Google Meet / Tab)*.
- [ ] Penggabungan stream mikrofon pengguna + audio rapat jika pengguna juga berbicara di laptop.

### Tahap 2 (Impor Transkrip Meet)
- [ ] Parser berkas transkrip bawaan Google Meet (format VTT atau Docs).
- [ ] Endpoint `POST /sesi/impor-transkrip` (menerima teks transkrip langsung, bypass tahap Whisper, langsung masuk ke tahap analisis Gemini).
