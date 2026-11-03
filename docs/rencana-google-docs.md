# Rencana: Integrasi Ekspor ke Google Docs & Google Drive

**Status:** rencana (belum dikerjakan).  
**Tujuan:** notulen rapat yang sudah disetujui perekam dapat diekspor menjadi dokumen Google Docs di Google Drive sekolah, sehingga format resmi berlogo Al Akhyar dapat dicetak/dibagikan lewat ekosistem Google Workspace yang sudah ada.

---

## 1. Analisis Kebutuhan: Perlukah?

**Perlu, tetapi sebagai tombol ekspor setelah dokumen disetujui, BUKAN penyimpanan utama otomatis.**

| Aspek | ruma. (Database Internal) | Google Docs / Drive |
|---|---|---|
| **Peran** | Sumber kebenaran tunggal (*single source of truth*) | Kanal distribusi, cetak, dan kolaborasi lanjutan |
| **Pencarian** | Cepat, terikat aturan akses rapat/undangan/supervisi | Bergantung izin Drive |
| **Keterkaitan data** | Terikat ke audio, transkrip, PIC, dan action items | Terlepas dari rekaman asli |
| **Privasi** | Rapat tertutup hanya terbuka untuk orang/grup tertentu | Bisa bocor bila folder Drive salah dibagikan |

**Kesimpulan:** tetap simpan di database ruma. Tambahkan fitur **"Simpan ke Google Docs"** (opsional per sesi, satu ketukan setelah dokumen disetujui perekam).

---

## 2. Pilihan Arsitektur OAuth & Akses Google

Ada dua pilihan cara menyimpan ke Drive:

| # | Pendekatan | Cara Kerja | Kelebihan | Kekurangan / Risiko |
|---|---|---|---|---|
| **A (Usulan)** | **Token pengguna sendiri (incremental scope)** | Pengguna mengetuk "Sambungkan Google Drive"; Google meminta izin hanya saat tombol ekspor dipakai. Dokumen dibuat atas nama perekam di "Drive Saya" miliknya. | - Dokumen otomatis milik guru/kepsek.<br>- Sekolah tidak perlu mengelola folder bersama terpusat.<br>- Beban kuota API terbagi per user. | Perlu menyimpan *refresh token* pengguna di database (terenkripsi) atau meminta consent lagi bila token kedaluwarsa. |
| **B** | **Service Account terpusat ke Shared Drive sekolah** | Server ruma. memiliki Service Account Google Cloud yang menulis ke satu Google Shared Drive khusus ("Arsip Notulen Al Akhyar"). | - Pengguna tidak diminta izin tambahan saat login.<br>- Semua notulen terkumpul rapi di satu folder resmi sekolah. | - Butuh Google Workspace berbayar (fitur Shared Drive).<br>- Pengaturan Service Account dan pendelegasian domain lebih rumit.<br>- Rapat tertutup bisa terlihat oleh pengelola Shared Drive. |

**Rekomendasi:** mulai dari **Opsi A** dengan scope sempit `https://www.googleapis.com/auth/drive.file` (hanya bisa membaca dan menulis berkas yang dibuat oleh ruma., **tidak bisa** membaca berkas Drive pengguna yang lain).

---

## 3. Tahapan Pekerjaan (Todo)

### Fase A: Fondasi & Kredensial (Backend)
- [ ] Minta scope tambahan di Google Cloud Console: `drive.file` (aplikasi bertipe Internal Workspace Al Akhyar, jadi tidak perlu verifikasi publik Google).
- [ ] Migrasi database: tabel `kalam_user_tokens` (kolom: `user_id`, `access_token`, `refresh_token`, `expires_at`, `scope`, `updated_at`). Token disimpan terenkripsi (AES-256-GCM) dengan kunci rahasia server `TOKEN_ENCRYPTION_KEY`.
- [ ] Endpoint alur sambungkan Drive:
  - `GET /auth/google/drive` -> URL OAuth Google dengan scope `drive.file` dan `access_type=offline` + `prompt=consent` (untuk mendapatkan refresh token).
  - `GET /auth/google/drive/callback` -> simpan token ke DB -> arahkan kembali ke sesi asal.
  - `DELETE /auth/google/drive` -> cabut sambungan dan hapus token dari DB.

### Fase B: Penyusun Dokumen Google Docs
- [ ] Modul `apps/api/src/integrasi/google-docs.ts`:
  - Fungsi `buatDokumenNotulen(userId, sesiId)`:
    1. Ambil payload notulen yang disetujui dari `kalam_dokumen`.
    2. Segarkan access token via refresh token jika sudah kedaluwarsa.
    3. Panggil Docs API v1: `documents.create` dengan judul `"Notulen - {judul_rapat} ({tanggal})"`.
    4. Format isi dokumen lewat `documents.batchUpdate`:
       - Header resmi: "SEKOLAH ISLAM AL AKHYAR" + garis pemisah.
       - Metadata: Tanggal, Waktu, Tempat, Pemimpin Rapat, Notulis, Peserta.
       - Ringkasan Eksekutif.
       - Tabel Agenda & Keputusan.
       - Tabel Action Items (Tugas, PIC, Tenggat).
    5. Pindahkan berkas ke folder "ruma. Notulen" di Drive pengguna (buat otomatis jika belum ada).
    6. Simpan URL dokumen ke `kalam_dokumen.google_docs_url`.

### Fase C: Endpoint & Integrasi Frontend
- [ ] Endpoint API:
  - `POST /sesi/:uuid/ekspor/google-docs`: hanya oleh perekam pada dokumen `disetujui`. Mengembalikan `{ url: string }`.
  - `GET /sesi/:uuid/ekspor/status`: status apakah pengguna sudah menyambungkan Drive dan apakah sesi ini sudah punya Google Docs.
- [ ] UI Hasil Sesi (`features/sesi/`):
  - Tombol **"Buka di Google Docs"** (jika sudah diekspor) atau **"Ekspor ke Google Docs"** (jika belum).
  - Dialog konfirmasi sederhana yang menjelaskan dokumen akan dibuat di folder "ruma. Notulen" di Drive pengguna.
  - Toast sukses dengan tombol tautan langsung "Buka Dokumen".

### Fase D: Supervisi Kelas (Opsional Lanjutan)
- [ ] Templat Google Docs khusus supervisi akademik:
  - Format tabel rubrik Kurikulum Merdeka (Kegiatan Awal, Inti, Penutup, Praktik Baik, Rekomendasi).
  - Ruang tanda tangan digital/manual kepala sekolah dan guru yang diobservasi.
