# Panduan Desain UI/UX Mobile-First: ruma.

**Aplikasi:** ruma. by Al Akhyar — Your AI Meeting Companion (Listen · Understand · Summarize)
**Pendekatan:** Mobile-First Progressive Web App (PWA) & Responsive Tablet/Desktop  
**Filosofi Desain:** *Tactile Minimalist, Distraction-Free, Thumb-Zone Friendly*  

---

## 1. Prinsip Desain Utama

1. **Jempol Sebagai Pengendali Utama (Thumb-Zone Ergonomics)**:
   - 80% interaksi dilakukan dengan satu tangan di ponsel (misal kepala sekolah berdiri di belakang kelas saat supervisi, atau guru memegang HP di meja rapat).
   - Semua tombol aksi krusial (Mulai Rekam, Jeda, Tandai Momen, Selesai) diletakkan di **sepertiga bawah layar**.
   - Ukuran target sentuh minimal **48 × 48 px**, dengan tombol rekam utama berukuran **72 × 72 px**.
2. **Ketenangan & Keandalan Visual (Calm & Trustworthy)**:
   - Saat merekam, layar tidak boleh berkedip agresif atau membingungkan.
   - Visualisasi gelombang suara (*live waveform*) yang halus memberikan kepastian bahwa suara benar-benar tertangkap.
3. **Penyelamatan Data Tanpa Panik (Zero-Loss Anxiety)**:
   - Indikator status penyimpanan offline (*IndexedDB buffered*) selalu terlihat transparan. Jika HP kehabisan baterai atau sinyal hilang, guru tahu rekaman tidak hilang.

---

## 2. Palet Warna & Tipografi

Mengikuti identitas resmi **Sekolah Islam Al Akhyar** yang bersih, berwibawa, dan modern:

| Token Warna | Nilai Tailwind | Fungsi UI |
|---|---|---|
| **Primary Brand** | `sky-600` (`#0284c7`) | Aksen utama, tab aktif, tombol navigasi, identitas Al Akhyar. |
| **Record Active** | `rose-500` (`#f43f5e`) | Status merekam aktif, indikator live, tombol stop, gelombang audio. |
| **Success / Verified** | `emerald-600` (`#059669`) | Dokumen notulen disetujui, tugas selesai, integrasi WhatsApp. |
| **Warning / Bookmark** | `amber-500` (`#f59e0b`) | Penanda momen penting (*pinned moment*), kuota menipis. |
| **Surface Light** | `slate-50` / `white` | Latar belakang bersih, kartu dokumen kontras tinggi ramah baca. |
| **Surface Dark** | `slate-950` / `slate-900` | Latar OLED hemat baterai saat sesi rekaman panjang di kelas. |

**Tipografi:**
- Font Utama: **Plus Jakarta Sans** / **Inter** (sangat mudah dibaca pada layar kecil).
- Angka & Timer: **JetBrains Mono** / font monospaced (timer tidak goyang saat angka bertambah).

---

## 3. Alur Antarmuka Layar (Screen-by-Screen Flow)

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   1. BERANDA    │  Tap  │ 2. SETUP SESI   │ Mulai │  3. LIVE RECORD │ Selesai │ 4. PROSES AI    │
│  Riwayat & Sisa │ ────► │ Rapat/Supervisi │ ────► │  Waveform, Pin, │ ────► │ Whisper+Gemini  │
│  Kuota Cloudfl. │       │ Pilih Guru/Mapel│       │  WakeLock Aktif │       │ Stepper Visual  │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └────────┬────────┘
                                                                                       │
                                                                                       ▼
                                                                              ┌─────────────────┐
                                                                              │ 5. HASIL NOTULEN│
                                                                              │ Notulen/Rubrik, │
                                                                              │ Transkrip Audio,│
                                                                              │ Ekspor PDF/WA   │
                                                                              └─────────────────┘
```

---

### Layar 1: Beranda & Riwayat Rekaman (Home Screen)

```
┌──────────────────────────────────────────┐
│ [≡] ruma.             [ 180/240m AI ⚡ ] │  <-- Top Bar & Indikator Kuota
├──────────────────────────────────────────┤
│                                          │
│  [ Semua ]  [ 👥 Rapat (8) ]  [ 🎓 Supervisi (3) ]  <-- Filter Chip
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 🎓 Supervisi: Muh Fajrul Islam    │  │  <-- Kartu Supervisi Kelas
│  │ 7 Al Halim · Informatika           │  │
│  │ 🕒 Tadi, 08:30 (80 menit)  [✓ Sah] │  │
│  │ "Guru membuka KBM dengan apersepsi │  │
│  │ algoritma lampu lalu lintas..."    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 👥 Rapat Koordinasi SAS Ganjil     │  │  <-- Kartu Notulen Rapat
│  │ SMP Islam Al Akhyar                │  │
│  │ 🕒 Kemarin (65 menit) · 4 Tugas    │  │
│  │ "Disepakati batas impor CBT tgl 20"│  │
│  └────────────────────────────────────┘  │
│                                          │
├──────────────────────────────────────────┤
│                  [ 🎙️ ]                  │  <-- Floating Big Record Button
│              Mulai Rekaman               │      (72px, jempol mudah gapai)
└──────────────────────────────────────────┘
```

---

### Layar 2: Perekam Berjalan (Live Recording Screen)

Dirancang **bebas distraksi** dengan kontras tinggi. Layar tetap menyala berkat Screen Wake-Lock API.

```
┌──────────────────────────────────────────┐
│ [✕ Batal]      Mode: Supervisi     [⚙️] │
├──────────────────────────────────────────┤
│                                          │
│           Ustadz Fajrul Islam            │
│         Kelas 7 Al Halim — IPAS          │
│                                          │
│               00:42:15                   │  <-- Monospace Big Timer
│            ● MEREKAM AUDIO               │
│                                          │
│      ||| | |||| || | |||||| || | ||      │  <-- Live Canvas Waveform
│    ||||||||||||||||||||||||||||||||||    │      (Visualizer suara aktif)
│                                          │
│     🚩 3 Momen Penting Ditandai         │  <-- Bookmark Counter
│                                          │
├──────────────────────────────────────────┤
│                                          │
│   [ ⏸️ Jeda ]    [ 🚩 Tandai ]   [ ⏹️ Selesai ]
│                                          │
│       🔒 Layar terkunci tetap aktif      │
└──────────────────────────────────────────┘
```

**Fitur Sentuhan Khusus:**
- Tombol **`🚩 Tandai`**: Menghasilkan getaran haptic singkat (*haptic pulse 40ms*). Menancapkan penanda waktu (*pin*) pada gelombang audio sehingga AI memberi prioritas kesimpulan pada menit tersebut.
- Tombol **`⏹️ Selesai`**: Menggunakan modal geser (*slide-to-stop* atau konfirmasi dua ketuk) agar tidak sengaja tertekan saat HP dimasukkan ke kantong.

---

### Layar 3: Detail Dokumen & Transkrip Interaktif

Setelah AI menyelesaikan pemrosesan, pengguna melihat hasil dalam navigasi tab geser:

```
┌──────────────────────────────────────────┐
│ [←] Supervisi: Fajrul Islam      [ 📤 ] │  <-- Share/Export Button
├──────────────────────────────────────────┤
│  [ 📄 Lembar Observasi ] [ 📝 Transkrip ]│  <-- Segmented Navigation
├──────────────────────────────────────────┤
│                                          │
│  SKOR OBSERVASI KBM: 3.8 / 4.0 [Sangat Baik]
│                                          │
│  ▼ 1. KEGIATAN AWAL (Skor: 4/4)          │
│     Guru mengaitkan materi logika dengan │
│     kehidupan sehari-hari siswa.         │
│                                          │
│  ▼ 2. KEGIATAN INTI (Skor: 4/4)          │
│     Pembelajaran berdiferensiasi tampak  │
│     pada pembagian 3 kelompok diskusi.   │
│                                          │
│  ▼ 3. KEGIATAN PENUTUP (Skor: 3/4)       │
│     Asesmen formatif terburu-buru.       │
│                                          │
│  ⭐ PRAKTIK BAIK:                        │
│  • Komunikasi hangat dan mengapresiasi   │
│    setiap jawaban siswa.                 │
│                                          │
│  💡 SARAN REFLEKTIF KEPALA SEKOLAH:      │
│  "Perlu alokasi minimal 10 menit khusus  │
│   untuk penutupan dan kuis singkat."     │
│                                          │
├──────────────────────────────────────────┤
│  [ ✍️ Verifikasi & TTD ]  [ 📤 Bagikan WA ]
└──────────────────────────────────────────┘
```

**Fitur Transkrip Karaoke Interaktif (Tab 2):**
- Menampilkan teks transkrip utuh hasil Whisper.
- Jika pengguna mengetuk suatu kalimat pada transkrip, **pemutar audio langsung melompat ke detik tersebut**. Sangat membantu kepala sekolah yang ingin memutar ulang momen tertentu di kelas tanpa mendengarkan rekaman 80 menit dari awal.

---

### Layar 4: Aksi Cepat Notulensi (Action Items WhatsApp Sender)

Untuk Modul Rapat, tab tugas menyediakan integrasi instan satu ketukan:

```
┌──────────────────────────────────────────┐
│ Action Items Rapat (3 Tugas)             │
├──────────────────────────────────────────┤
│                                          │
│ [ ] 1. Upload Soal CBT ke e-Rapor        │
│     PIC: Pak Fajrul · Batas: 20 Nov      │
│     [ 📲 Kirim WA Pengingat ]             │  <-- Buka format WA via GOWA
│                                          │
│ [ ] 2. Rekap Absensi Siswa Bermasalah    │
│     PIC: Pak Ihwan · Batas: 15 Nov       │
│     [ 📲 Kirim WA Pengingat ]             │
│                                          │
└──────────────────────────────────────────┘
```

---

## 4. Keunggulan UX PWA (Offline & Performa)

1. **Instalasi Tanpa Play Store (PWA Standalone)**:
   - Guru membuka URL `ruma.alakhyar.sch.id`, muncul prompt *"Tambahkan ke Layar Utama"*.
   - Berjalan mandiri tanpa bilah URL peramban (*display: standalone*), persis aplikasi Android asli.
2. **Kapasitas Hemat Storage**:
   - Setelah notulen disetujui, terdapat tombol **"Hapus Berkas Audio Mentah (Hemat Memori)"** yang menyisakan dokumen teks saja (~15 KB), menghemat kuota Cloudflare R2 sekolah.
3. **Dark Mode Otomatis**:
   - Mengikuti preferensi tema sistem guru atau toggle manual. Mode gelap menggunakan latar hitam murni `#020617` untuk menghemat daya layar AMOLED ponsel saat rapat berjam-jam.
