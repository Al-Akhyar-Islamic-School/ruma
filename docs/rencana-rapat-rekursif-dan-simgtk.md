# Rencana: Rapat Rekursif (Serial) & Integrasi Agenda SIM-GTK

**Tujuan:**
1. **Rapat Rekursif / Serial:** Rapat berkala (misal *Rapat Pimpinan Mingguan*, *Rapat Evaluasi Guru Bulanan*) otomatis menyambung ke **satu berkas Google Docs yang sama** (ditambahkan di halaman baru/bawahnya dengan pemisah tanggal & agenda baru), bukan membuat dokumen baru setiap pekan.
2. **Integrasi Agenda SIM-GTK:** Menarik jadwal dan agenda rapat dari SIM-GTK ke ruma., sehingga perekam tidak perlu mengetik ulang judul dan peserta.

---

## 1. Konsep Rapat Rekursif (Serial / Berkelanjutan)

Di sekolah, rapat tertentu adalah rapat bersambung. Contoh: *"Rapat Koordinasi Mingguan Pimpinan"*.
- Jika setiap pekan dibuat berkas dokumen baru, dokumen tercecer dan progres tugas pekan lalu sulit ditelusuri.
- **Solusi ruma.:**
  - Entitas **"Seri Rapat"** (`ruma_seri_rapat`).
  - Setiap sesi rapat baru dapat ditautkan ke seri yang sudah ada.
  - Saat diekspor ke Google Docs:
    - Sesi pertama: membuat berkas Google Docs baru `"Notulen Berkala - Pimpinan Al Akhyar"`.
    - Sesi kedua, ketiga, dst: memanggil Google Docs API `batchUpdate` untuk **menyisipkan Page Break + Judul Sesi Baru + Notulen Baru di akhir dokumen yang sama**.
    - Di ruma., action items dari sesi sebelumnya otomatis dimunculkan sebagai agenda evaluasi di rapat berikutnya.

---

## 2. Integrasi Agenda SIM-GTK

Sekolah sudah memiliki SIM-GTK dengan data agenda rapat/kegiatan.
- **Alur kerja:**
  1. Pengguna membuka ruma. -> di halaman Mulai/Jadwal muncul kartu **"Agenda SIM-GTK Hari Ini"**.
  2. Klik agenda (misal *"Rapat Evaluasi SAS SMP"*).
  3. ruma. otomatis mengisi:
     - Judul sesi.
     - Tanggal & waktu mulai.
     - Peserta yang diundang (dicocokkan langsung ke email GTK).
     - Kategori rapat.
  4. Selesai rapat & disetujui: ruma. mengirim status kembali ke SIM-GTK (notulensi selesai + ringkasan singkat).

---

## 3. Checklist Todo Teknis

### Fase 1: Entitas Rapat Rekursif di Backend
- [ ] Tabel `ruma_seri_rapat` (kolom: `id`, `nama_seri`, `owner_id`, `google_docs_file_id`, `created_at`).
- [ ] Tambahkan kolom `seri_id` di `ruma_sesi` (nullable).
- [ ] Di modul Google Docs export: jika sesi memiliki `seri_id` dan berkas sudah ada di Drive, lakukan `append` di akhir dokumen (insert Page Break + Bab Rapat Baru), bukan `documents.create`.

### Fase 2: Integrasi Agenda SIM-GTK
- [ ] Tambahkan endpoint di `simgtk.ts`: `GET /getAgendaHariIni` (atau endpoint agenda rapat yang disediakan SIM-GTK).
- [ ] Di form persiapan rekaman (`/rekam/baru`): sediakan opsi *"Pilih dari Agenda SIM-GTK"*.
- [ ] Sinkronisasi otomatis daftar hadir peserta rapat dari absensi SIM-GTK ke metadata sesi ruma.
