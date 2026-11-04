# Panduan Lengkap: Integrasi Ekstensi Chrome, Aplikasi Desktop, dan Meeting Bot

Dokumen ini adalah panduan arsitektur dan operasional menyeluruh untuk 3 metode perekaman rapat dan penyusunan notulen cerdas **ruma. by Al Akhyar**:
1. **Ekstensi Chrome Google Meet** (`apps/extension`)
2. **Aplikasi Desktop Native** (`apps/desktop` berbasis Tauri v2 + Rust)
3. **Meeting Bot Otomatis** (`apps/bot` berbasis Headless Chromium seperti tl;dv / Fathom)

---

## 🧭 Ringkasan Perbandingan Solusi

| Kriteria | 1. Ekstensi Chrome (`apps/extension`) | 2. Aplikasi Desktop (`apps/desktop`) | 3. Meeting Bot Otomatis (`apps/bot`) |
|---|---|---|---|
| **Bentuk** | Plugin Browser Chrome (Manifest V3) | Aplikasi Native Windows/macOS (<15 MB) | Bot Partisipan Otomatis (Puppeteer) |
| **Keterlibatan Pengguna** | Buka tab Google Meet ➔ Klik tombol rekam | Buka aplikasi desktop ➔ Pilih folder & rekam | Cukup masukkan URL Google Meet |
| **Tampilan di Rapat** | Widget mengambang di layar pengguna | Jendela terpisah di komputer | Masuk sebagai peserta *"ruma. Notulis"* |
| **Kebutuhan Lisensi Google Meet** | **Tidak butuh** (Gratis/Fundamentals) | **Tidak butuh** (Merekam speaker PC) | **Tidak butuh** (Hadir sebagai akun tamu) |
| **Penyimpanan Berkas** | Cloud ruma. (potongan 30 detik) | **Hardisk Lokal (C/Documents) & Cloud** | Cloud ruma. & Server Sekolah |
| **Pilihan AI** | Server ruma. (Whisper + Gemini) | **Hybrid: Cloud AI (Gemini/Cloudflare) ATAU AI Lokal (Ollama/Qwen/Whisper)** | Server ruma. (Whisper + Gemini) |
| **Cocok Untuk** | Guru/staf saat rapat harian Meet | Notulis resmi, rapat offline/Zoom/Teams | Pimpinan yang ingin bot hadir otomatis |

---

## 1. Ekstensi Chrome ruma. untuk Google Meet (`apps/extension`)

### A. Fitur & Keunggulan
- **Mengatasi Batasan Lisensi:** Google Workspace for Education Fundamentals tidak memiliki tombol rekam bawaan. Ekstensi ruma. menangkap suara audio tab Google Meet (`getDisplayMedia` dengan audio tab aktif) sehingga seluruh suara peserta rapat tetap terekam jernih.
- **Audio Ganda (Peserta + Mikrofon Pengguna):** Menggabungkan audio tab Meet dengan mikrofon lokal via Web Audio API, memastikan suara pembicara di laptop dan suara peserta lain masuk bersamaan ke notulen.
- **Fitur Anti-Bisu:** Menjaga suara rapat tetap mengalir ke speaker/headphone pengguna (`suppressLocalAudioPlayback: false`).
- **Floating Widget Elegan:** Widget hijau Al Akhyar melayang rapi di dalam Google Meet berbasis Shadow DOM (tanpa merusak tata letak Meet), dilengkapi timer live, visualisator gelombang audio, tombol jeda, dan tombol selesai.
- **Zero-Loss Streaming:** Memotong audio tiap 30 detik dan mengirimkannya ke API ruma. secara real-time.

### B. Cara Build & Mengemas Ekstensi
Jalankan perintah pengemasan otomatis dari root projek:
```bash
pnpm pack:extension
```
Perintah ini menghasilkan 2 berkas siap pakai di `apps/extension/`:
1. `ruma-meet.zip` (22 KB): Berkas ZIP untuk diunggah ke Google Chrome Web Store atau Google Workspace Admin Console.
2. `ruma-meet.crx` (22 KB): Berkas paket ekstensi mandiri yang ditandatangani kunci privat (`key.pem`).

### C. Cara Pemasangan Otomatis via Google Admin Console (Force Install ke Seluruh Guru)

Admin IT / Google Workspace Yayasan Al Akhyar dapat memasang ekstensi ini secara otomatis ke semua akun guru dan staf sekolah tanpa guru perlu mengklik tombol install sendiri.

#### Langkah 1: Unggah Ekstensi ke Chrome Web Store (Khusus Domain Sekolah)
1. Buka [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Masuk menggunakan akun admin Google Workspace sekolah (`admin@alakhyar.sch.id`).
3. Klik **"Add new item"** dan unggah berkas:
   ```
   apps/extension/ruma-meet.zip
   ```
4. Pada tab **"Privacy & Visibility"**, pilih:
   - **Visibility:** Pilih **"Private"** ➔ Centang **"Everyone in alakhyar.sch.id"**.
   *(Dengan setelan ini, ekstensi TIDAK BISA dilihat atau dicari oleh publik luar, hanya pengguna berdomain @alakhyar.sch.id)*.
5. Klik **Publish item**. Salin **ID Ekstensi** (string 32 huruf, misal: `abcdefghijklmnopqrstuvwxyz123456`).

#### Langkah 2: Terapkan Kebijakan Pemasangan Paksa di Google Admin Console
1. Buka [Google Workspace Admin Console](https://admin.google.com).
2. Masuk ke menu: **Devices (Perangkat)** ➔ **Chrome** ➔ **Apps & extensions (Aplikasi & ekstensi)** ➔ **Users & browsers (Pengguna & browser)**.
3. Di panel sebelah kiri, pilih Unit Organisasi (*Organizational Unit*), misal: **"Guru & Tenaga Kependidikan"** atau unit akar **"Al Akhyar"**.
4. Klik ikon tombol kuning **`+`** di pojok kanan bawah ➔ pilih **"Add from Chrome Web Store"**.
5. Cari **ruma. Notulis Google Meet** atau masukkan ID Ekstensi dari Langkah 1.
6. Di kolom **Installation policy (Kebijakan pemasangan)**, ubah dari *"Allow install"* menjadi:
   👉 **`Force install + pin to browser toolbar`** *(Pasang paksa + sematkan ke bilah peramban)*.
7. Klik **Save (Simpan)** di pojok kanan atas.

#### Hasil Akhir bagi Pengguna:
- Begitu guru atau staf login ke Google Chrome dengan akun `@alakhyar.sch.id`, ekstensi **ruma. Notulis Google Meet** otomatis terpasang dalam hitungan detik.
- Ikon ruma. otomatis tersemat (*pinned*) di pojok kanan atas Chrome.
- Saat guru membuka panggilan Google Meet, widget hijau cerdas ruma. langsung siap dipakai merekam rapat.
- Guru tidak bisa menghapus ekstensi secara tidak sengaja karena dikunci oleh kebijakan yayasan.
---

## 2. Aplikasi Desktop Native (`apps/desktop` - Tauri v2 + Rust)

### A. Arsitektur & Keunggulan
- **Ringan & Hemat Daya:** Dibangun menggunakan Tauri v2 dengan backend Rust native, konsumsi RAM rendah (<60 MB), ukuran installer sangat kecil (<15 MB, jauh lebih hemat dibanding Electron yang 150 MB+).
- **Format Audio Rekaman Standar Emas:** Merekam suara ruangan atau mikrofon rapat dalam format WAV 16-bit PCM uncompressed (sample rate native) yang memberikan akurasi pengenalan kata tertinggi pada model Whisper.
- **Worker Audio Terisolasi:** Proses perekaman berjalan di *dedicated thread* terpisah dari antarmuka pengguna sehingga audio tidak akan pernah terputus meski komputer sedang membuka aplikasi berat.

### B. Sistem Penyimpanan Hardisk Kustom (C/Documents)
Sesuai kebutuhan pengguna yang ingin berkas audio tersimpan aman di komputer:
- **Lokasi Default Sistem:**
  - **Windows:** `C:\Users\<NamaUser>\Documents\ruma-notulen\`
  - **macOS:** `/Users/<NamaUser>/Documents/ruma-notulen/`
- **Kustomisasi Bebas:**
  - Di layar perekam, pengguna dapat langsung melihat dan mengubah path folder penyimpanan sesuai kebutuhan (misal ke `D:\Rapat_Sekolah\` atau folder Google Drive desktop).
  - Terdapat tombol *"Reset ke Default"* untuk mengembalikan lokasi ke folder Dokumen standar.

### C. Opsi AI Fleksibel: Cloud AI vs AI Lokal Mandiri
Pengguna memiliki kebebasan penuh memilih mesin pemrosesan AI:

#### 1. Pilihan Cloud AI (Bebas Unduh / Instan / Hemat Hardisk - BYOK)
Bagi pengguna yang **tidak ingin mengunduh berkas model gigabyte ke hardisk**:
- **Google Gemini API (Penalaran & Notulen Cepat):**
  - Dapatkan API Key gratis di [Google AI Studio](https://aistudio.google.com/app/apikey).
  - Masukkan API Key ke kolom input Gemini di tab **"AI Notulensi"** aplikasi desktop (tersimpan aman di komputer).
  - Menggunakan model `gemini-2.5-flash` (waktu analisis 5-10 detik, pemahaman Bahasa Indonesia sangat akurat).
- **Cloudflare Workers AI (Transkripsi Whisper Cloud):**
  - Buka dashboard Cloudflare ➔ **AI** ➔ **Workers AI**.
  - Masukkan **Account ID** dan **API Token** di aplikasi desktop.
  - Berkas audio WAV langsung ditranskripsi oleh Cloudflare model `@cf/openai/whisper-large-v3-turbo` di cloud tanpa perlu download Whisper 1.6 GB ke komputer!
- **Server ruma. Cloud Al Akhyar:** Berkas rekaman diunggah ke server ruma. VPS sekolah, diproses oleh worker antrean transkripsi otomatis, dan tersinkronisasi ke Google Docs resmi.
#### 2. Pilihan AI Lokal Mandiri (100% Offline / Privasi Penuh)
Bagi pengguna yang membutuhkan **kerahasiaan data rapat pimpinan, ketiadaan koneksi internet, atau tanpa batas kuota**:
- **Model Whisper (Audio ➔ Teks):** Dilengkapi tombol unduh bawaan yang langsung mengambil bobot model GGUF dari Hugging Face ke folder lokal komputer:
  - `Whisper Large v3 Turbo` (~1.6 GB) — *Rekomendasi Utama (Akurat & Cepat)*
  - `Whisper Medium` (~1.5 GB)
  - `Whisper Small` (~460 MB) — *Laptop Ringan*
  - `Whisper Base` (~140 MB)
- **Model Text LLM (Notulensi):** Terintegrasi langsung dengan Ollama lokal (`http://localhost:11434`) dengan tombol unduh otomatis:
  - `Qwen 2.5 7B Instruct` (~4.7 GB) — *Bahasa Indonesia formal terbaik*
  - `Qwen 2.5 3B Instruct` (~2.0 GB) — *Laptop Tipis / Hemat Daya*
  - `Llama 3.1 8B Instruct` (~4.9 GB)

### D. Perintah Menjalankan Aplikasi Desktop
```bash
# Menjalankan mode development:
pnpm --filter @kalam/desktop tauri dev

# Membangun file instalasi native (.dmg untuk Mac / .msi untuk Windows):
pnpm --filter @kalam/desktop tauri build
```

---

## 3. Meeting Bot Otomatis (`apps/bot` - seperti tl;dv / Fathom / Otter)

### A. Konsep & Cara Kerja
Layanan bot partisipan otomatis berbasis peramban Chromium headless (Puppeteer):
1. **Pemberian Tugas:** Pengguna atau server memberikan URL Google Meet, misal: `https://meet.google.com/abc-defg-hij`.
2. **Peluncuran & Bergabung:**
   - Bot membuka Google Meet dengan parameter audio virtual dan nama partisipan: `"ruma. Notulis (Al Akhyar)"`.
   - Kamera dan mikrofon bot dimatikan secara otomatis agar tidak mengganggu jalannya rapat.
   - Bot menekan tombol *"Ask to join"* / *"Minta bergabung"*.
3. **Persetujuan & Diarization:**
   - Host rapat di Google Meet menyetujui bot masuk (*Admit*).
   - Bot otomatis menyalakan fitur *Closed Captions* (CC) untuk membaca nama pembicara (*diarization*) dan teks kalimat secara real-time.
4. **Selesai Otomatis:**
   - Bot memantau kehadiran peserta; saat rapat selesai atau semua peserta telah keluar, bot otomatis meninggalkan panggilan.
   - Hasil rekaman dan transkrip langsung dialirkan ke kecerdasan buatan ruma. untuk disusun menjadi notulen resmi.

### B. Cara Menjalankan Bot
Jalankan perintah berikut di terminal:
```bash
pnpm bot:join https://meet.google.com/xxx-xxxx-xxx
```

---

## 4. Panduan Rekomendasi Pemilihan Solusi

```
                      Kebutuhan Notulensi Rapat
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
   Rapat Daring (Google Meet)                 Rapat Luring / Campuran / Offline
         │                                               │
   ┌─────┴────────────────┐                              │
   ▼                      ▼                              │
Ingin Tanpa Instal     Ingin Bot Hadir Sendiri           │
(Guru di Laptop)       (Host Cukup Masukkan Link)        │
   │                      │                              │
   ▼                      ▼                              ▼
Ekstensi Chrome       Meeting Bot Otomatis       Aplikasi Desktop Native
(`apps/extension`)    (`apps/bot`)               (`apps/desktop`)
                                                         │
                                        ┌────────────────┴────────────────┐
                                        ▼                                 ▼
                                  Mau Cepat / Hemat               Mau 100% Offline
                                  Penyimpanan (0 MB Unduhan)      (Tanpa Kuota / Rahasia)
                                        │                                 │
                                        ▼                                 ▼
                                    Cloud AI                          AI Lokal
                                (Gemini / Cloudflare)            (Whisper + Qwen 2.5)
```

1. **Untuk Guru & Pertemuan Harian Google Meet:** Gunakan **Ekstensi Chrome ruma.** karena langsung menyatu di layar Google Meet tanpa perlu membuka software lain.
2. **Untuk Notulis Sekolah & Rapat Gabungan/Offline:** Gunakan **Aplikasi Desktop ruma.** karena rekaman WAV tersimpan rapi di hardisk komputer (`Documents/ruma-notulen`) dan bebas memilih AI Cloud (Gemini/Cloudflare) tanpa perlu mengunduh model.
3. **Untuk Rapat Pimpinan Otomatis Tanpa Perlu Merekam Sendiri:** Gunakan **Meeting Bot (`apps/bot`)** yang masuk mandiri ke Google Meet seperti tl;dv.
