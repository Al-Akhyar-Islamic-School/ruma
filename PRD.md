# Product Requirements Document (PRD): Notula AI

**Aplikasi:** Notula AI — Al Akhyar Meeting Intelligence & Voice Notula
**Fokus:** Modul Notulensi Rapat & Modul Supervisi Akademik / Observasi Kelas  
**Target Platform:** Progressive Web App (PWA) Mobile/Tablet/Desktop  
**Status:** Engineering Ready  

---

## 1. Visi Produk & Nilai Tambah

Mengeliminasi pekerjaan manual menulis notulensi dan mengetik laporan supervisi di lingkungan Yayasan & Sekolah Islam Al Akhyar. Pengguna cukup menekan satu tombol rekam di ponsel/laptop mereka saat rapat dimulai atau saat kepala sekolah melangkah masuk ke ruang kelas guru. AI akan menyelesaikan draf dokumen formal dalam hitungan detik setelah sesi selesai.

### Nilai Utama:
- **Zero Extra Hardware:** Tidak perlu membeli alat rekam fisik terpisah (seperti Plaud Note seharga \$150+). Cukup menggunakan ponsel pintar Android/iPhone milik guru atau kepala sekolah.
- **Biaya Operasional \$0 (Free Tier Optimization):** Transkripsi memanfaatkan jatah 10.000 neuron harian Cloudflare Workers AI Whisper, dan penalaran notulen menggunakan gateway Gemini sekolah.

---

## 2. Pengguna Sasaran (User Personas)

1. **Notulis Rapat (Guru / Staf TU / Sekretaris Yayasan):**
   - Menghadiri rapat mingguan dewan guru, rapat kerja tahunan, rapat anggaran.
   - Sering kewalahan mencatat perdebatan cepat dan menyusun tabel tindak lanjut.
2. **Kepala Sekolah & Pengawas Akademik:**
   - Melakukan supervisi kelas rutin (4–8 guru per pekan).
   - Membutuhkan lembar observasi objektif berbasis bukti (*evidence-based*) tanpa terdistraksi mencatat saat mengamati dinamika kelas.
3. **Guru yang Disupervisi:**
   - Menerima umpan balik yang membangun (*actionable feedback*) dalam waktu 15 menit pasca-observasi, bukan berminggu-minggu kemudian saat konteks kelas sudah terlupa.

---

## 3. Rincian Fitur Utama (Functional Requirements)

### 3.1 Layar Perekam (Voice Recorder Screen)
- **FR-01: Pemilihan Mode Sesi**:
  - Tombol toggle jelas sebelum mulai rekam: `Mode Rapat` atau `Mode Supervisi Kelas`.
- **FR-02: Metadata Awal**:
  - *Jika Mode Rapat:* Judul Rapat, Kategori (Pleno/Kurikulum/Komite/Pimpinan).
  - *Jika Mode Supervisi:* Pilih Guru dari daftar GTK sekolah, Pilih Kelas, Mata Pelajaran, dan Materi Pokok.
- **FR-03: Audio Visualizer & Kontrol**:
  - Tampilan gelombang suara (*live waveform visualizer*) untuk memastikan mikrofon menangkap suara dengan jelas.
  - Tombol Pause, Resume, dan Stop.
  - Indikator durasi waktu berjalan dan indikator perkiraan sisa kuota harian.
- **FR-04: Tombol Bookmark Cepat (*Pin Moment*)**:
  - Selama merekam, pengguna bisa menekan tombol `Tandai Momen Penting` (misal saat terjadi kesepakatan krusial atau saat guru melakukan teknik mengajar istimewa). AI akan memberikan perhatian khusus pada timestamp momen tersebut.

---

### 3.2 Modul Notulensi Rapat (Meeting Minutes Engine)
- **FR-05: Ekstraksi Otomatis Dokumen Notulen**:
  - **Kop Notulen:** Tanggal, Waktu, Tempat, Pemimpin Rapat, Peserta Terdeteksi.
  - **Ringkasan Eksekutif:** 2–3 paragraf narasi inti rapat.
  - **Agenda & Keputusan:** Pembahasan dikelompokkan per agenda rapat, lengkap dengan poin mufakat.
  - **Tabel Matriks Tindak Lanjut (*Action Items*):**
    - Kolom: No, Deskripsi Tugas, Penanggung Jawab (PIC), Tenggat Waktu, Status (Pending).
- **FR-06: Integrasi Penugasan (Action Items Tracker)**:
  - Notulis bisa mencentang tugas dan mengirim ringkasan tugas via WhatsApp ke nomor guru penanggung jawab menggunakan integrasi GOWA / Notifwa Al Akhyar yang sudah ada.

---

### 3.3 Modul Supervisi Kelas (Classroom Observation Engine)
- **FR-07: Penilaian Berbasis Rubrik Kurikulum Merdeka**:
  - AI menganalisis transkrip kelas dan memetakan aktivitas guru ke dalam rubrik standar:
    1. *Kegiatan Awal (Apersepsi & Motivasi)*: Skor 1–4 + Bukti transkrip.
    2. *Kegiatan Inti (Diferensiasi, Penguasaan Materi, Interaksi Murid)*: Skor 1–4 + Bukti transkrip.
    3. *Kegiatan Penutup (Refleksi & Asesmen Formatif)*: Skor 1–4 + Bukti transkrip.
- **FR-08: Analisis Kekuatan & Area Pengembangan**:
  - Menghasilkan daftar **Praktik Baik Guru (*Commendations*)**: Hal-hal positif yang berhasil dilakukan guru.
  - Menghasilkan daftar **Saran Pengembangan (*Recommendations*)**: Rekomendasi pedagogis yang konkret.
- **FR-09: Draf Umpan Balik Reflektif Kepala Sekolah**:
  - Menyusun 2–3 pertanyaan reflektif pembuka untuk sesi *coaching* pasca-observasi antara kepala sekolah dan guru (contoh: *"Tadi di menit ke-35 saat kelompok B tampak pasif, apa yang menurut Ustadz bisa kita sesuaikan?"*).
- **FR-10: Tanda Tangan & Konfirmasi Guru**:
  - Lembar supervisi dapat dibagikan ke akun guru di e-Rapor untuk dibaca, diberi catatan tanggapan, dan dikonfirmasi.

---

### 3.4 Penyuntingan & Ekspor Dokumen
- **FR-11: Inline WYSIWYG Editing**:
  - Sebelum dokumen diunduh atau dipublikasikan, kepala sekolah / notulis dapat mengedit teks hasil AI langsung di layar (memperbaiki ejaan nama, menambah poin yang terlewat).
- **FR-12: Ekspor Dokumen Resmi**:
  - Ekspor ke **PDF Resmi** dengan format kop surat Al Akhyar Makassar dan kolom tanda tangan digital/manual.
  - Ekspor ke **Microsoft Word (.docx)** untuk arsip administrasi akreditasi sekolah.

---

## 4. Rencana Tahapan Rilis (Phasing)

| Fase | Target Waktu | Lingkup Fitur |
|---|---|---|
| **Fase 1 (MVP)** | Pekan 1–2 | - PWA Recorder dengan kompresi Opus 32kbps.<br>- Integrasi Cloudflare Whisper untuk transkripsi audio.<br>- Modul Notulensi Rapat via Gemini (Ringkasan, Keputusan, Action Items).<br>- Ekspor Word (.docx) & PDF dasar. |
| **Fase 2 (Supervisi)** | Pekan 3 | - Modul Supervisi Kelas (Pilih Guru, Kelas, Mapel).<br>- Rubrik Observasi Pembelajaran Kurikulum Merdeka.<br>- Draf umpan balik reflektif kepala sekolah.<br>- Penyimpanan arsip supervisi per profil guru. |
| **Fase 3 (Integrasi)** | Pekan 4 | - Notifikasi WhatsApp Action Items via GOWA.<br>- Tanda tangan digital persetujuan lembar supervisi oleh guru.<br>- Dashboard analitik tren supervisi pembelajaran per unit sekolah (TK, SD, SMP, SMA). |
