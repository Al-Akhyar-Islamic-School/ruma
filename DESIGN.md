# Panduan Desain UI/UX Mobile-First: ruma.

**Aplikasi:** ruma. by Al Akhyar — Your AI Meeting Companion (Listen · Understand · Summarize)
**Pendekatan:** Mobile-first, responsive web, Android dan iOS melalui Capacitor
**Filosofi desain:** *Tactile Minimalist, Calm, Trustworthy, Distraction-Free*

---

## 1. Prinsip Desain Utama

1. **Thumb-zone ergonomics**
   - Letakkan aksi utama yang sering digunakan di area bawah layar.
   - Target sentuh minimum 48 × 48 px. Tombol rekam utama dapat berukuran 72 × 72 px.
2. **Calm and trustworthy**
   - Hindari animasi agresif, warna mencolok berlebihan, dan tampilan yang membuat pengguna cemas.
   - Waveform harus memberi umpan balik bahwa mikrofon menangkap audio.
3. **Zero-loss anxiety**
   - Bedakan status tersimpan lokal, menunggu upload, sedang upload, dan sudah diterima server.
   - Jangan menyatakan rekaman aman sebelum penyimpanan benar-benar terkonfirmasi.
4. **Consistent cross-platform**
   - Web, Android, dan iOS menggunakan design token dan pola interaksi yang sama.
   - Perilaku permission, filesystem, background recording, dan notifikasi mengikuti kemampuan native tiap platform.

---

## 2. Palet Warna & Tipografi

### 2.1 Arah visual

Identitas visual ruma. menggunakan karakter **deep forest green**, **fresh green**, dan **soft lime**. Palet ini memberi kesan tenang, terpercaya, profesional, dan modern untuk produk AI di lingkungan pendidikan.

Hijau adalah warna identitas utama. Merah, kuning, dan hijau status hanya digunakan untuk menyampaikan kondisi sistem, bukan sebagai warna branding utama.

### 2.2 Brand palette

| Token | HEX | Fungsi |
|---|---|---|
| Primary | `#153E35` | Brand utama, tombol primer, navigasi aktif, dan elemen identitas. |
| Primary Hover | `#205746` | Hover/pressed state tombol dan elemen primer. |
| Secondary | `#267653` | Aksen sekunder, ikon aktif, tautan penting, dan elemen pendukung. |
| Accent / Lime | `#B8D96C` | Highlight, penanda momen, indikator visual, dan aksen kecil. Gunakan secara hemat. |

### 2.3 Semantic palette

| Token | HEX | Fungsi |
|---|---|---|
| Success | `#16845B` | Berhasil, tersimpan, disetujui, dan selesai. |
| Warning | `#C58A2A` | Perlu perhatian, kuota menipis, proses tertunda, dan peringatan. |
| Danger | `#D34C4C` | Gagal, error, tindakan destruktif, dan indikator recording bila diperlukan. |
| Info | `#267653` | Informasi dan status netral yang membutuhkan perhatian ringan. |

**Aturan penggunaan:**

- Tombol **Mulai Rekam** menggunakan Primary.
- Status recording dapat memakai Danger untuk dot, timer indicator, waveform highlight, dan tombol Stop. Jangan mewarnai seluruh halaman menjadi merah.
- **Bookmark / Tandai Momen** menggunakan Accent/Lime, bukan Warning.
- Status berhasil menggunakan Success dan status gagal menggunakan Danger.
- Status menunggu/antre menggunakan warna netral atau Warning sesuai konteks.
- Warna tidak boleh menjadi satu-satunya pembeda status. Sertakan label atau ikon.

### 2.4 Light theme

| Token | HEX | Fungsi |
|---|---|---|
| Background | `#F7F9F7` | Latar utama aplikasi. |
| Surface | `#FFFFFF` | Kartu, modal, panel, dan area konten. |
| Surface Subtle | `#F0F4F1` | Area sekunder, hover lembut, dan panel pendukung. |
| Border | `#E5EBE7` | Border, divider, dan pemisah komponen. |
| Text Primary | `#17231E` | Judul dan teks utama. |
| Text Secondary | `#68766E` | Deskripsi, metadata, dan teks pendukung. |
| Text Inverse | `#FFFFFF` | Teks di atas tombol atau surface gelap. |

### 2.5 Dark theme

Gunakan warna hijau-hitam yang lembut, bukan hitam murni.

| Token | HEX | Fungsi |
|---|---|---|
| Background | `#101713` | Latar utama dark theme. |
| Surface | `#17211B` | Kartu dan panel. |
| Surface Elevated | `#202C24` | Modal, dropdown, dan elemen elevated. |
| Border | `#2B3A30` | Border dan divider. |
| Text Primary | `#F1F5F2` | Teks utama. |
| Text Secondary | `#A3B1A7` | Metadata dan teks pendukung. |
| Primary | `#7EAA91` | Tombol dan elemen utama pada dark theme. |
| Accent | `#B8D96C` | Highlight dan aksen. |

### 2.6 Design token implementation

Gunakan semantic token, bukan hard-coded color pada komponen.

```css
:root {
  --color-primary: #153e35;
  --color-primary-hover: #205746;
  --color-secondary: #267653;
  --color-accent: #b8d96c;

  --color-background: #f7f9f7;
  --color-surface: #ffffff;
  --color-surface-subtle: #f0f4f1;
  --color-border: #e5ebe7;

  --color-text-primary: #17231e;
  --color-text-secondary: #68766e;

  --color-success: #16845b;
  --color-warning: #c58a2a;
  --color-danger: #d34c4c;
}

.dark {
  --color-primary: #7eaa91;
  --color-primary-hover: #9bc2a9;
  --color-secondary: #70a989;
  --color-accent: #b8d96c;

  --color-background: #101713;
  --color-surface: #17211b;
  --color-surface-subtle: #202c24; /* = Surface Elevated pada tabel 2.5 */
  --color-border: #2b3a30;

  --color-text-primary: #f1f5f2;
  --color-text-secondary: #a3b1a7;
}
```

**Ketentuan:**

- Jika project sudah memiliki design token atau CSS variable, petakan token di atas ke sistem yang sudah ada. Hindari dua sumber kebenaran.
- Komponen tidak boleh menggunakan warna brand langsung seperti `bg-sky-600` atau `text-emerald-600`; gunakan token semantic.
- Pastikan kontras teks dan kontrol memenuhi WCAG 2.1 AA sejauh memungkinkan (lihat 2.8).
- Lime digunakan sebagai aksen, bukan warna teks kecil di atas latar putih.

### 2.7 Tipografi

- Font utama: **Plus Jakarta Sans** atau **Inter**.
- Angka dan timer: **JetBrains Mono** atau font monospaced agar angka tidak bergeser.
- Hierarki heading, body, caption, dan metadata harus konsisten.
- Hindari ukuran metadata yang terlalu kecil pada perangkat mobile.

### 2.8 Kontras (WCAG 2.1 AA) — hasil pengukuran

Rasio dihitung dari nilai HEX di atas. Ambang AA: **4,5:1** untuk teks biasa, **3:1** untuk teks besar (≥ 18,66 px tebal atau ≥ 24 px) dan komponen/ikon.

| Pasangan | Rasio | Hasil |
|---|---|---|
| Light: Text Primary / Background | 15,32 | lulus |
| Light: Text Secondary / Background | 4,51 | lulus (tipis) |
| Light: Text Secondary / Surface | 4,77 | lulus |
| Light: Text Secondary / Surface Subtle | **4,29** | **gagal untuk teks kecil** |
| Light: Text Inverse / Primary | 11,85 | lulus |
| Light: Text Inverse / Primary Hover | 8,36 | lulus |
| Light: Secondary / Surface | 5,53 | lulus |
| Light: Success / Surface (dan teks putih di atas Success) | 4,68 | lulus |
| Light: Danger / Surface (dan teks putih di atas Danger) | **4,28** | **gagal untuk teks kecil**; lulus untuk ikon dan teks besar |
| Light: Warning / Surface | **2,98** | **gagal** sebagai teks maupun ikon kecil |
| Light: Text Primary di atas Warning | 5,44 | lulus |
| Light: Lime / Surface | 1,59 | gagal (sesuai aturan: bukan teks) |
| Light: Primary di atas Lime | 7,44 | lulus |
| Dark: Text Primary / Background | 16,54 | lulus |
| Dark: Text Secondary / Surface Elevated | 6,50 | lulus |
| Dark: Primary / Surface | 6,34 | lulus |
| Dark: Teks Background di atas Primary | 6,97 | lulus |
| Dark: Accent / Surface | 10,38 | lulus |
| Dark: Warning / Surface | 5,55 | lulus |
| Dark: Success / Surface | **3,53** | **gagal untuk teks kecil** |
| Dark: Danger / Surface | **3,87** (4,25 di atas Background) | **gagal untuk teks kecil** |
| Border / Background (light 1,14; dark 1,52) | | dekoratif; jangan menjadi satu-satunya penanda batas kontrol input |

**Aturan yang berlaku dari pengukuran ini (tanpa mengubah palet):**

1. Warning **bukan warna teks atau ikon kecil** di atas putih. Pakai sebagai latar/penanda dengan teks Text Primary di atasnya.
2. Teks kecil di atas Surface Subtle memakai Text Primary, bukan Text Secondary.
3. Danger dan Success pada dark theme hanya untuk ikon, dot, dan latar. Teks statusnya tetap Text Primary dengan ikon berwarna.
4. Teks putih pada tombol Danger/Stop harus berukuran besar atau tebal (≥ 18,66 px tebal), atau memakai usulan di 2.9.

### 2.9 Usulan penyesuaian token (belum disetujui)

Nilai palet brand di atas **tidak diubah**. Bila ingin teks status kecil lulus AA tanpa mengorbankan identitas, tambahkan token turunan berikut (rasio terukur):

| Token usulan | HEX | Dipakai untuk | Rasio |
|---|---|---|---|
| `--color-danger-strong` (light) | `#C23F3F` | teks dan tombol Danger/Stop dengan teks putih | 5,15 di atas putih |
| `--color-warning-strong` (light) | `#8F5F0C` | teks peringatan di atas Surface/Surface Subtle | 5,51 / 4,96 |
| `--color-text-secondary` (light, alternatif) | `#5F6D65` | menggantikan `#68766E` bila perlu lulus di atas Surface Subtle | 4,90 |
| `--color-danger` (dark) | `#E5706F` | teks/ikon Danger di dark theme | 5,42 di atas Surface |
| `--color-success` (dark) | `#3FB488` | teks/ikon Success di dark theme | 6,38 di atas Surface |

### 2.10 Status implementasi

Dokumen ini adalah acuan baru. **Aplikasi (`apps/web`) belum memakai palet ini**: `apps/web/src/index.css` masih memetakan token shadcn ke palet lama (`sky-600` untuk primary, `rose-500` untuk record, `emerald-600` untuk success, `amber-500` untuk warning, `slate-950` untuk dark), dan `theme_color` PWA serta ikon aplikasi masih biru. Migrasi cukup dilakukan di satu tempat (token di `index.css`, `theme_color`, ikon), mengikuti aturan "satu sumber kebenaran" pada 2.6.

---

## 3. Alur Antarmuka

1. **Beranda:** riwayat rekaman, filter rapat/supervisi, status proses, dan CTA Mulai Rekaman.
2. **Setup sesi:** pilih Mode Rapat atau Mode Supervisi, lalu lengkapi metadata sesuai jenis sesi.
3. **Live recording:** tampilkan konteks sesi, timer, waveform, kontrol jeda/lanjut/selesai, dan status penyimpanan/upload.
4. **Proses AI:** tampilkan tahapan pemrosesan berdasarkan status backend yang sebenarnya. Jangan menampilkan persentase progres palsu.
5. **Hasil:** tampilkan notulen atau hasil supervisi, transkrip, audio, dan tindakan lanjutan sesuai fitur yang tersedia.

---

## 4. Screen Guidelines

### 4.1 Beranda & riwayat rekaman

- Tampilkan daftar rekaman dengan jenis sesi, judul, tanggal, durasi, status, dan ringkasan singkat jika tersedia.
- Sediakan filter Semua, Rapat, dan Supervisi.
- CTA Mulai Rekaman harus mudah dijangkau pada layar mobile.
- Gunakan badge status dengan warna semantic dan label yang eksplisit.
- Jangan menampilkan kuota AI jika backend tidak menyediakan angka kuota yang valid.

### 4.2 Live recording

- Gunakan tampilan bebas distraksi dengan kontras tinggi.
- Timer menggunakan font monospaced.
- Tombol Jeda, Tandai, dan Selesai berada di area bawah.
- Tombol Tandai Momen hanya ditampilkan sebagai fitur aktif jika API bookmark sudah tersedia.
- Tombol Selesai menggunakan konfirmasi untuk mencegah penghentian yang tidak disengaja.
- Status penyimpanan membedakan data lokal, upload berjalan, upload tertunda, dan upload selesai.

Screen Wake Lock dapat mencegah layar tidur pada platform yang mendukung, tetapi bukan jaminan background recording. Perekaman ketika aplikasi berada di background atau layar terkunci harus menggunakan implementasi native yang sesuai dan diuji pada Android/iOS.

### 4.3 Detail dokumen & transkrip

- Pisahkan konten berdasarkan jenis sesi.
- Untuk rapat, prioritaskan ringkasan, agenda, keputusan, dan action items.
- Untuk supervisi, prioritaskan rubrik, bukti, praktik baik, dan rekomendasi.
- Ketukan pada segmen transkrip dapat mengarahkan audio ke timestamp terkait.
- Identitas pembicara hanya ditampilkan jika diarization sudah tersedia dan dikembalikan backend.
- Skor, bukti, dan rekomendasi harus berasal dari hasil analisis yang tersimpan. Data pada mockup hanya ilustrasi.

### 4.4 Action Items

- Tampilkan deskripsi tugas, PIC, tenggat, dan status jika datanya tersedia.
- Tandai tugas yang belum memiliki PIC atau tenggat.
- Aksi ubah status, PIC, dan tenggat hanya diaktifkan setelah endpoint mutasi tersedia.
- Tombol pengingat WhatsApp hanya ditampilkan setelah integrasi GOWA/Notifwa tersedia.
- Action item hasil AI harus diverifikasi pengguna sebelum dianggap sebagai tugas final.

---

## 5. PWA, Capacitor, Offline & Performa

1. **Akses lintas platform**
   - Aplikasi digunakan melalui browser dan dipaketkan menjadi Android/iOS dengan Capacitor.
   - Design token dan pola interaksi konsisten pada semua platform.
   - Permission, filesystem, background recording, dan push notification mengikuti batasan native masing-masing OS.
2. **Penyimpanan dan pemulihan**
   - Tampilkan status penyimpanan lokal, upload berjalan, upload tertunda, dan upload selesai.
   - Rekaman yang belum berhasil diunggah harus dapat dilanjutkan sesuai mekanisme resumable upload backend.
   - Penghapusan audio mentah harus meminta konfirmasi. Jangan menghapus satu-satunya salinan sebelum arsip yang diperlukan dipastikan aman.
3. **Dark mode**
   - Dukung preferensi tema sistem dan pilihan manual.
   - Gunakan token dark theme pada bagian 2.5, bukan `#020617`.
   - Waveform, timer, status, dan kontrol harus tetap terbaca.
4. **Aksesibilitas**
   - Target sentuh minimum 48 × 48 px.
   - Hormati pengaturan reduced motion.
   - Sertakan label teks untuk status yang tidak cukup dijelaskan oleh warna atau ikon.

---

## 6. Aturan Konsistensi Komponen

| Komponen | Aturan visual |
|---|---|
| Primary Button | Background Primary, teks kontras tinggi. |
| Secondary Button | Surface dengan border; teks/ikon Primary. |
| Destructive Button | Danger hanya untuk tindakan destruktif atau Stop yang memerlukan penekanan. |
| Active Navigation | Primary atau Secondary dengan indikator aktif yang jelas. |
| Status Badge | Semantic color disertai label teks. |
| Bookmark | Accent/Lime dengan ikon dan label yang jelas. |
| Card | Surface, border halus, radius konsisten, elevasi secukupnya. |
| Input | Surface, border, focus ring Primary, dan pesan error Danger. |
| Recording Indicator | Dot Danger, timer monospaced, dan label "Merekam". |

**Prinsip akhir:** gunakan hijau sebagai identitas produk, lime sebagai aksen, dan warna status hanya untuk menyampaikan makna. Konsistensi, keterbacaan, dan kejelasan status lebih penting daripada dekorasi visual.

---

## Lampiran A. Wireframe referensi (ilustrasi tata letak)

Wireframe di bawah hanya menggambarkan **tata letak**. Warna mengikuti bagian 2. Konten bersifat ilustrasi: indikator kuota AI, tombol WhatsApp, dan tanda tangan hanya tampil bila fiturnya tersedia (lihat 4.1 dan 4.4), serta skor dan bukti harus berasal dari analisis yang tersimpan (4.3).

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   1. BERANDA    │  Tap  │ 2. SETUP SESI   │ Mulai │  3. LIVE RECORD │ Selesai │ 4. PROSES AI    │
│  Riwayat        │ ────► │ Rapat/Supervisi │ ────► │  Waveform, Tandai│ ────► │ Whisper+Gemini  │
│                 │       │ Pilih Guru/Mapel│       │  WakeLock Aktif │       │ Status backend  │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └────────┬────────┘
                                                                                       │
                                                                                       ▼
                                                                              ┌─────────────────┐
                                                                              │ 5. HASIL        │
                                                                              │ Notulen/Rubrik, │
                                                                              │ Transkrip, Audio│
                                                                              └─────────────────┘
```

### A.1 Beranda & riwayat rekaman

```
┌──────────────────────────────────────────┐
│ [≡] ruma.                                │  <-- Top Bar
├──────────────────────────────────────────┤
│                                          │
│  [ Semua ]  [ Rapat ]  [ Supervisi ]     │  <-- Filter Chip
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Supervisi: Muh Fajrul Islam        │  │  <-- Kartu Supervisi Kelas
│  │ 7 Al Halim · Informatika           │  │
│  │ Tadi, 08:30 (80 menit)  [✓ Selesai]│  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Rapat Koordinasi SAS Ganjil        │  │  <-- Kartu Notulen Rapat
│  │ SMP Islam Al Akhyar                │  │
│  │ Kemarin (65 menit) · 4 Tugas       │  │
│  └────────────────────────────────────┘  │
│                                          │
├──────────────────────────────────────────┤
│                  [ 🎙️ ]                  │  <-- Tombol rekam utama (72px)
│              Mulai Rekaman               │
└──────────────────────────────────────────┘
```

### A.2 Perekam berjalan

```
┌──────────────────────────────────────────┐
│ [✕ Batal]      Mode: Supervisi           │
├──────────────────────────────────────────┤
│           Ustadz Fajrul Islam            │
│         Kelas 7 Al Halim — IPAS          │
│                                          │
│               00:42:15                   │  <-- Timer monospaced
│            ● Merekam                     │  <-- Dot Danger + label
│                                          │
│      ||| | |||| || | |||||| || | ||      │  <-- Waveform
│                                          │
│     3 momen ditandai                     │  <-- Penanda: Accent/Lime
│     Tersimpan lokal · Terunggah 41/42    │  <-- Status penyimpanan/upload
├──────────────────────────────────────────┤
│   [ Jeda ]      [ Tandai ]    [ Selesai ]│
└──────────────────────────────────────────┘
```

- **Tandai:** haptic singkat (±40 ms) bila perangkat mendukung; menyimpan penanda waktu yang diteruskan ke analisis.
- **Selesai:** konfirmasi dua langkah agar tidak tertekan saat ponsel di saku.

### A.3 Detail dokumen & transkrip

```
┌──────────────────────────────────────────┐
│ [←] Supervisi: Fajrul Islam              │
├──────────────────────────────────────────┤
│  [ Lembar Observasi ]  [ Transkrip ]     │  <-- Segmented navigation
├──────────────────────────────────────────┤
│  ▼ 1. KEGIATAN AWAL                      │
│  ▼ 2. KEGIATAN INTI                      │
│  ▼ 3. KEGIATAN PENUTUP                   │
│  PRAKTIK BAIK · REKOMENDASI              │
├──────────────────────────────────────────┤
│  [ Setujui dokumen ]                     │
└──────────────────────────────────────────┘
```

**Transkrip interaktif:** mengetuk suatu kalimat memindahkan pemutar audio ke detik tersebut, sehingga momen tertentu bisa diputar ulang tanpa mendengarkan seluruh rekaman.

### A.4 Action items (rapat)

```
┌──────────────────────────────────────────┐
│ Action Items Rapat                       │
├──────────────────────────────────────────┤
│ [ ] 1. Upload soal CBT                   │
│     PIC: (belum ada)  · Tenggat: 20 Nov  │  <-- tandai yang belum punya PIC/tenggat
│ [ ] 2. Rekap absensi siswa               │
│     PIC: Pak Ihwan · Tenggat: 15 Nov     │
└──────────────────────────────────────────┘
```

### A.5 PWA

- Instalasi tanpa Play Store: buka `ruma.alakhyar.sch.id`, lalu "Tambahkan ke Layar Utama"; berjalan `display: standalone`.
- Setelah notulen disetujui, penghapusan audio mentah (hemat penyimpanan) hanya setelah konfirmasi dan arsip dipastikan aman (lihat 5.2).
