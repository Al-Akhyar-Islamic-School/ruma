# Roadmap & Todo List: ruma. (by Al Akhyar)

Dokumen ini adalah ringkasan status implementasi saat ini dan peta jalan pengembangan berikutnya yang terstruktur rapi.

---

## 🟢 Selesai Dikerjakan (Teruji & Siap Rilis)

### 1. Inti & Transkripsi (Reliability & Zero-Loss)
- [x] **Inline Worker:** Worker transkripsi & analisis berjalan otomatis di dalam proses API (`WORKER_INLINE=true`).
- [x] **Pemotongan di Jeda Hening:** Audio panjang dipotong pada celah hening (`silencedetect`) sekitar 10 menit agar kata tidak terpotong.
- [x] **Tahan Batas Kuota AI:** Status 429 / kuota habis Cloudflare menunda sesi ke pukul 00:05 UTC (08:05 WITA) tanpa membuang jatah retry. Hasil per bagian di-cache sehingga esoknya melanjutkan dari bagian yang belum selesai.
- [x] **Kesiapan Pra-Rekam (Pre-flight):** Pengecekan mikrofon (dengan level meter aktif), estimasi penyimpanan sisa, dan status keterjangkauan server sebelum tombol Mulai ditekan.
- [x] **Perekaman Offline-First:** Potongan audio disimpan di IndexedDB perangkat sebelum diunggah; pemulihan otomatis setelah browser ditutup/crash.
- [x] **Durasi Fleksibel:** Preset durasi (30, 60, 90, 120, 180m, lainnya), batas yang disetujui admin diberi penyangga 50%, peringatan di sisa 10m & 5m, dan toleransi 15m sebelum berhenti otomatis.

### 2. Fitur Rapat & Kolaborasi
- [x] **Knowledge Management:** Halaman `/pengetahuan` dengan pencarian teks penuh (*full-text search*) lintas notulen rapat yang diizinkan dan daftar keputusan per rapat.
- [x] **Keanggotaan Grup:** Anggota dapat melihat grup yang mengikutsertakan mereka, menggunakan grup tersebut untuk mengundang ke rapat sendiri, atau keluar dari grup secara mandiri.
- [x] **Pencarian Orang Terpadu:** Komponen pemilih orang menggabungkan direktori SIM-GTK dengan pengguna terdaftar di aplikasi.
- [x] **Kategori Rapat Dinamis:** Dikelola penuh oleh superadmin (tambah kategori, aktif/nonaktif, penanda "tertutup" untuk rapat rahasia/pimpinan).

### 3. UI/UX & Branding
- [x] **Rebranding ruma.:** Wordmark "ruma. by Al Akhyar", tagline "Listen · Understand · Summarize", ikon aplikasi baru.
- [x] **Desain Hijau Harmonis:** Palet hijau hutan (*forest green*), hijau segar, dan aksen *lime* sesuai `DESIGN.md` (memenuhi standar kontras WCAG 2.1 AA di mode terang dan gelap).
- [x] **Bottom Navigation Bar Mobile:** Menggantikan tombol melayang ganda dengan navigasi bawah yang ergonomis (Beranda, Pengetahuan, Rekam Menonjol di Tengah, Grup, Profil).
- [x] **Bebas Glitch:** Perbaikan urutan logout dan transisi halaman login tanpa kedipan error.

### 4. Database & DevOps
- [x] **Database ruma_\* Bersih:** Seluruh tabel menggunakan awalan `ruma_*` dari awal migrasi bersih `0000_lovely_black_tom.sql`.
- [x] **CI/CD GitHub Actions:** Pipeline otomatis ke VPS CloudPanel lewat SSH (cek migrasi, typecheck, build di runner, rsync artefak, reload PM2, health check & auto-rollback).
- [x] **Penyimpanan Audio Cloudflare R2 (Retensi 90 Hari):** Berkas rekaman audio disimpan di Cloudflare R2 (zero disk VPS, zero egress fee, streaming HTTP 206) dengan pembersihan otomatis setelah 90 hari (`docs/panduan-r2-retensi-90-hari.md`).
- [x] **Salinan Audio ke Google Drive:** Berkas MP3 rekaman rapat dapat disimpan permanen ke Google Drive pengguna di folder `"ruma. Notulen"` bersama notulen resmi.
- [x] **Aplikasi Android Native (Capacitor 7):** Cangkang native `sch.alakhyar.ruma` (APK 4,6 MB) dengan dukungan rekaman saat layar mati/terkunci menggunakan Foreground Service mikrofon Android 14 (`RumaRecorderService` + `PARTIAL_WAKE_LOCK`), login Google OAuth aman via browser sistem & PKCE (`docs/capacitor-android.md`).
---

## 🟡 Fase Berikutnya: Ekosistem Google Workspace & SIM-GTK

### Fase 1: Integrasi Google Docs & Google Drive (`docs/rencana-google-docs.md`)
- [x] Tombol **"Ekspor ke Google Docs"** pada notulen rapat yang telah disetujui.
- [x] Dokumen otomatis berformat resmi Sekolah Islam Al Akhyar (kop resmi, tabel agenda, tabel keputusan, matriks tugas).
- [x] Penyimpanan di folder khusus `"ruma. Notulen"` di Google Drive pengguna.
- [x] Otomatis bagikan berkas Google Docs & rekaman audio ke peserta rapat via email.

### Fase 2: Rapat Rekursif / Serial (`docs/rencana-rapat-rekursif-dan-simgtk.md`)
- [x] Entitas **"Seri Rapat"** untuk rapat berkala (rapat mingguan pimpinan, bulanan guru, dsb.).
- [x] Notulen rapat lanjutan otomatis menyambung di berkas Google Docs yang sama (halaman baru / bab baru per tanggal pertemuan).
- [x] Action items dari rapat pekan lalu otomatis dimunculkan sebagai bahan review di rapat pekan ini.

### Fase 3: Integrasi Agenda SIM-GTK (`docs/konsep-integrasi-agenda-simgtk.md`)
- [x] Alur 2 arah: ruma. menarik daftar agenda hari ini (`GET /agenda`), mengisi otomatis judul & peserta.
- [x] Kolom `simgtk_agenda_id` di tabel `ruma_sesi`.
- [x] Callback dua arah: saat notulen disetujui, ruma. mengirim balik `ruma_sesi_url` dan `google_docs_url` ke SIMGTK agar bisa dibuka langsung dari SIM-GTK.
- [x] **Ekstensi Chrome ruma. untuk Google Meet:** Plugin Chrome Manifest V3 (`apps/extension`) yang menyatu di dalam panggilan Google Meet (`meet.google.com`), merekam audio rapat tab (`getDisplayMedia`) + mikrofon lokal, streaming potongan 30 detik ke API ruma., floating control widget di layar Meet, pembuatan notulen otomatis, dan panduan pemasangan otomatis via Google Workspace Admin Console (`docs/panduan-admin-google-workspace-force-install.md` & `docs/panduan-integrasi-extension-desktop-dan-bot.md`).
- [x] **Bot Partisipan Rapat Otomatis (`apps/bot`):** Layanan bot otomatis seperti tl;dv / Fathom / Otter yang bergabung langsung ke URL Google Meet sebagai peserta `"ruma. Notulis (Al Akhyar)"`, merekam suara, mengekstrak Closed Captions & nama pembicara, dan otomatis keluar saat rapat selesai.

---

## 🔵 Fase Lanjutan: Aplikasi Desktop & AI Lokal Mandiri (`docs/rencana-desktop-dan-local-llm.md`)

- [x] **Aplikasi Desktop Mac & Windows (Tauri v2):** Dibangun dengan Tauri v2 (`apps/desktop`), backend native Rust (CPAL audio capture), penyimpanan audio WAV default di folder Dokumen (`C:\Users\...\Documents\ruma-notulen\` atau `~/Documents/ruma-notulen/`) yang dapat diubah bebas oleh pengguna.
- [x] **Pilihan Download Model Whisper:** Pengelola unduhan model Whisper GGUF langsung dari Hugging Face (`whisper-large-v3-turbo` 1.6GB, `medium` 1.5GB, `small` 460MB, `base` 140MB).
- [x] **Pilihan Download Model Text LLM:** Pengelola model Ollama lokal (`qwen2.5:7b` 4.7GB, `qwen2.5:3b` 2.0GB, `llama3.1:8b` 4.9GB) dengan tombol pull otomatis.
- [x] 100% pemrosesan di komputer pengguna tanpa internet, tanpa biaya API, dan data tidak keluar dari perangkat.
