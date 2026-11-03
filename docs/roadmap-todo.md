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

---

## 🟡 Fase Berikutnya: Ekosistem Google Workspace & SIM-GTK

### Fase 1: Integrasi Google Docs & Google Drive (`docs/rencana-google-docs.md`)
- [ ] Tombol **"Ekspor ke Google Docs"** pada notulen rapat yang telah disetujui.
- [ ] Dokumen otomatis berformat resmi Sekolah Islam Al Akhyar (kop resmi, tabel agenda, tabel keputusan, matriks tugas).
- [ ] Penyimpanan di folder khusus `"ruma. Notulen"` di Google Drive pengguna.

### Fase 2: Rapat Rekursif / Serial (`docs/rencana-rapat-rekursif-dan-simgtk.md`)
- [ ] Entitas **"Seri Rapat"** untuk rapat berkala (rapat mingguan pimpinan, bulanan guru, dsb.).
- [ ] Notulen rapat lanjutan otomatis menyambung di berkas Google Docs yang sama (halaman baru / bab baru per tanggal pertemuan).
- [ ] Action items dari rapat pekan lalu otomatis dimunculkan sebagai bahan review di rapat pekan ini.

### Fase 3: Integrasi Agenda SIM-GTK (`docs/rencana-rapat-rekursif-dan-simgtk.md`)
- [ ] Menarik agenda rapat terjadwal dari SIM-GTK langsung ke form pembuatan sesi ruma.
- [ ] Otomatis mengisi judul, tanggal, dan daftar undangan dari SIM-GTK.
- [ ] Kirim kembali status notulen selesai ke SIM-GTK.

### Fase 4: Integrasi Google Meet (`docs/rencana-google-meet.md`)
- [ ] Perekam audio tab Google Meet di peramban desktop (`getDisplayMedia`).
- [ ] Opsi impor berkas transkrip otomatis Google Meet dari Google Drive langsung ke ruma.

---

## 🔵 Fase Lanjutan: Aplikasi Desktop & AI Lokal Mandiri (`docs/rencana-desktop-dan-local-llm.md`)

- [ ] **Aplikasi Desktop Mac & Windows:** Dibangun dengan Tauri v2 (ringan, <15 MB).
- [ ] **Local Whisper:** Menggunakan `whisper.cpp` model `whisper-large-v3-turbo` (GGUF) dengan akselerasi GPU (Apple Metal di Mac, CUDA/DirectML di Windows).
- [ ] **Local Text LLM:** Menggunakan **Qwen 2.5 7B Instruct** (atau 3B untuk laptop hemat daya) via Ollama / llama.cpp lokal.
- [ ] 100% pemrosesan di komputer pengguna tanpa internet, tanpa biaya API, dan data tidak keluar dari perangkat.
