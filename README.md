# ruma. — Your AI Meeting Companion (by Al Akhyar)

> **Aplikasi PWA Perekam Rapat & Observasi Kelas Cerdas Berbasis AI Hybrid (Cloudflare Whisper + Google Gemini)**  
> Didesain khusus untuk ekosistem Yayasan & Sekolah Islam Al Akhyar.

---

## 1. Latar Belakang & Masalah

Di lingkungan sekolah, ada dua beban administratif audio-ke-teks yang paling memakan waktu:
1. **Notulensi Rapat** (Rapat Dewan Guru, Rapat Yayasan, Rapat Kerja Kurikulum, Rapat Komite/Wali Murid):
   - Notulis sering tertinggal mencatat saat diskusi berjalan cepat.
   - Poin keputusan penting dan daftar tugas (*action items*) sering tercecer atau tidak jelas penanggung jawabnya (*PIC*).
2. **Supervisi Akademik / Observasi Kelas oleh Kepala Sekolah**:
   - Kepala sekolah / pengawas harus membagi fokus antara mengamati interaksi guru-murid dan mencatat poin rubrik observasi.
   - Penyusunan laporan supervisi dan catatan reflektif guru sering tertunda berhari-hari setelah supervisi selesai.

**ruma.** (*Listen · Understand · Summarize*) hadir sebagai *teacher & principal assistant* mirip konsep Plaud Note, tetapi berbentuk **PWA web/mobile mandiri**, menggunakan kombinasi AI **Cloudflare Whisper (gratis)** untuk transkripsi audio dan **Google Gemini (konteks 2M token)** untuk penalaran dokumen resmi sekolah.

---

## 2. Dua Modul Utama

```
                      ┌────────────────────────────────────────┐
                      │            RUMA (PWA APP)              │
                      └──────────────────┬─────────────────────┘
                                         │
                     ┌───────────────────┴───────────────────┐
                     ▼                                       ▼
       [ MODUL 1: NOTULENSI RAPAT ]            [ MODUL 2: SUPERVISI KELAS ]
       - Rapat Kerja / Kurikulum               - Observasi Pembelajaran Guru
       - Rapat Pleno Dewan Guru                - Supervisi Klinis / Reflektif
       - Rapat Yayasan & Pimpinan              - Monitoring Siklus KBM
       - Rapat Komite & Orang Tua              - Evaluasi Guru Magang / Mitra
```

### Modul 1: Notulensi Rapat
- Perekaman suara rapat langsung di HP / laptop tanpa perangkat keras khusus.
- Ekstraksi otomatis:
  - **Ringkasan Eksekutif** (1–2 paragraf inti rapat).
  - **Poin Pembahasan per Agenda**.
  - **Keputusan Final yang Disepakati**.
  - **Tabel Matriks Tindak Lanjut (*Action Items*)**: Siapa mengerjakan apa, tenggat waktu (*deadline*), dan status.
- Ekspor ke PDF / Word (.docx) notulen resmi berlogo Al Akhyar, siap ditandatangani.

### Modul 2: Supervisi Kelas (Classroom Observation)
- Kepala sekolah mengaktifkan mode supervisi saat masuk ke kelas guru.
- Merekam audio proses KBM selama 45–90 menit.
- Analisis otomatis berbasis **Rubrik Kurikulum Merdeka**:
  - **Fase Pembuka**: Apersepsi, penyampaian tujuan, motivasi.
  - **Fase Inti**: Diferensiasi pembelajaran, keaktifan siswa, penguasaan materi, penerapan media/LKPD.
  - **Fase Penutup**: Refleksi bersama siswa, kesimpulan, asesmen formatif.
  - **Kekuatan Guru (*Commendations*)**: Praktik-praktik baik yang teramati di kelas.
  - **Area Pengembangan (*Recommendations*)**: Saran konkret perbaikan pedagogis.
  - **Draf Umpan Balik Reflektif**: Kalimat pembuka diskusi pasca-observasi antara kepala sekolah dan guru.
- Terhubung ke profil guru di e-Rapor / SIM-GTK.

---

## 3. Pembagian Tugas AI (Hybrid Architecture)

| Tugas | Engine AI | Alasan Pemilihan | Biaya |
|---|---|---|---|
| **Transkripsi Audio ➔ Teks** | **Cloudflare Workers AI**<br>`@cf/openai/whisper-large-v3-turbo` | Whisper adalah standar terbaik transkripsi audio multibahasa (Indonesia, istilah Arab, istilah sekolah). Cepat dan ringan. | **GRATIS** (10.000 neuron/hari Cloudflare ≈ **4 jam rekaman/hari**). |
| **Penalaran Dokumen Panjang (Notulen & Supervisi)** | **Google Gemini**<br>`gemini-3.7-flash` / `gemini-2.5-flash` (via Gateway Sekolah) | Rekaman 1–2 jam menghasilkan transkrip 15.000+ kata. Gemini punya **context window hingga 2 JUTA token**, sehingga transkrip utuh bisa dimasukkan tanpa perlu dipotong-potong. | **GRATIS / Hemat** via gateway sekolah yang sudah ada. |
| **Failover / Cadangan Darurat** | **Cloudflare Workers AI**<br>`@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Jika gateway Gemini sekolah mengalami gangguan, Llama 3.3 70B di Cloudflare siap menggantikan peran penyusunan notulen. | Backup otomatis. |

---

## 4. Struktur Folder Rencana

```
kalam-ai/
├── README.md               # Ringkasan proyek & arsitektur hybrid
├── PRD.md                  # Product Requirements Document (fitur detail)
├── ARCHITECTURE.md         # Blueprint teknis, skema DB, pipeline data
├── apps/
│   ├── api/                # Backend: Hono (Node 22) + Drizzle + MySQL, login Google Workspace
│   └── web/                # PWA: React 19 + TanStack Router/Query + shadcn/ui (Vite)
└── docs/
    ├── pipeline-audio.md   # Detail kompresi Opus, chunking, Whisper API
    ├── rubrik-supervisi.md # Standar indikator observasi kelas Kurikulum Merdeka
    └── prompt-notulensi.md # System prompt ekstraksi notulen & action items
```

---

## 5. Backend (`apps/api`)

Stack: **Hono** di Node 22, **pnpm**, **Drizzle ORM** + `mysql2` (MySQL/MariaDB), login **Google OIDC** (authorization code + PKCE).

```bash
cd apps/api
cp .env.example .env        # isi GOOGLE_CLIENT_ID/SECRET dan GOOGLE_HD
pnpm install
pnpm db:migrate
pnpm dev
```

- Redirect URI di Google Cloud Console: `<API_URL>/auth/google/callback`.
- Hanya akun dengan klaim `hd` yang ada di `GOOGLE_HD` yang diterima (divalidasi di server dari ID token, bukan hanya hint UI). `GOOGLE_HD` bisa berisi beberapa domain dipisah koma, mis. `alakhyar.sch.id,gtk.alakhyar.sch.id` (sebagian akun GTK memakai subdomain `gtk.`). Pastikan nilai `hd` akun GTK memang cocok dengan salah satunya.
- Sesi login: cookie `httpOnly` berisi token acak; DB hanya menyimpan hash SHA-256-nya (`kalam_sessions`, TTL 7 hari). User baru otomatis `guru`.

### Peran & izin

| Peran | Buat sesi rapat/supervisi | Moderasi permintaan & kelola user | Baca sesi orang lain |
|---|---|---|---|
| `superadmin` | langsung | ya | **semua sesi** (baca saja) |
| `admin` | langsung | ya (tidak bisa mengubah admin/superadmin) | hanya jika diundang |
| `kepsek`, `wakasek` | langsung | tidak | hanya jika diundang |
| `notulis`, `guru` | hanya dengan izin khusus (`bisa_merekam`) atau persetujuan per sesi | tidak | hanya jika diundang |

- `superadmin` hanya didapat lewat env `SUPERADMIN_EMAILS` (pisah koma), diterapkan saat login. Dihapus dari env = diturunkan ke `guru` pada login berikutnya. Tidak bisa diberikan lewat API.
- Izin khusus untuk "orang tertentu": admin set `bisa_merekam` lewat `PATCH /admin/users/:id`.
- Alur moderasi untuk user lain: `POST /permintaan` (tipe, judul, alasan, durasi diminta) → admin `POST /admin/permintaan/:id/putuskan` (setuju dengan `durasi_diizinkan_menit` dan `berlaku_sampai`, default 7 hari; atau tolak dengan catatan) → pemohon `POST /permintaan/:id/mulai` membuat sesi dengan batas durasi tersebut. Satu persetujuan = satu sesi. Maks 5 permintaan menunggu per user.
- Batas durasi ditegakkan di `finish` (durasi yang dilaporkan klien) dan di unggahan chunk (jumlah chunk maksimum = ceil(durasi/30 dtk) + 2), jadi tidak bisa dilewati dengan memalsukan durasi.
- Admin biasa sengaja **tidak** bisa membaca isi sesi orang lain kecuali diundang (rekaman kelas memuat suara murid, UU PDP). Superadmin: `GET /sesi/:uuid` dan `GET /admin/sesi?user_id=`. Superadmin tidak bisa mengunggah/menutup/mengundang di sesi orang lain.
- Semua `timestamp` disimpan UTC (zona sesi koneksi dipaksa `+00:00`), apa pun zona server MySQL.
- Endpoint: `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/logout`, `GET /auth/me`, `GET /health` (200 bila skema database mutakhir; **503** dengan `migrasiTertinggal` bila ada migrasi yang belum dijalankan atau DB tak terjangkau; cocok untuk health check deploy).
- Sesi rekaman (semua butuh login; mutasi hanya oleh perekam, baca oleh perekam, yang diundang, atau superadmin):
  - `POST /sesi` buat sesi langsung (hanya peran/izin di atas, selain itu 403 `perlu_persetujuan`). `supervisi_kelas` wajib `guruEmail` (dipilih dari daftar GTK; belum tentu pernah login), `kelas`, `mapel`.
  - `PUT /sesi/:uuid/chunks/:seq` unggah potongan audio (body biner, maks 2 MB, idempoten: unggah ulang `seq` yang sama menimpa).
  - `GET /sesi/:uuid` status + daftar `seq` yang sudah diterima (klien memakainya untuk melanjutkan unggahan dari IndexedDB).
  - `POST /sesi/:uuid/finish` `{jumlah_chunk, durasi_detik}`; 409 dengan daftar `missing`/`extra` bila chunk tidak lengkap; sukses mengubah status ke `mentranskrip`.
  - `GET /sesi` daftar sesi milik sendiri.
- Audio mentah disimpan per potongan di `AUDIO_DIR/<uuid>/<seq>.part` (antarmuka `AudioStorage` di `src/storage.ts`, bisa diganti R2). Potongan harus disambung berurutan oleh worker transkripsi. Folder ini wajib ikut backup.

### Undangan: siapa boleh mendengarkan & membaca sesi

Yang bisa membaca/mendengar sebuah sesi: **perekamnya**, **orang yang diundang**, dan **superadmin**. Undangan bersifat baca-saja dan hanya dikelola perekam (`POST/GET /sesi/:uuid/undangan`, `DELETE /sesi/:uuid/undangan/:id`). Empat jenis undangan:

| `tipe` | Isi | Siapa yang mendapat akses |
|---|---|---|
| `orang` | `emails: [...]` | email itu (boleh belum pernah login; dicocokkan huruf kecil) |
| `grup` | `grup_id` | anggota grup **saat ini**: mengubah grup langsung berlaku di semua sesi yang memakainya; menghapus grup mencabut aksesnya |
| `unit` | `unit`: `TK`/`SD`/`SMP`/`SMA` | GTK aktif di unit itu menurut SIM-GTK (mengikuti sinkronisasi terakhir) |
| `organisasi` | tanpa isi | semua yang berhasil login (seluruh Al Akhyar) |

- Grup undangan milik pribadi dan dipakai berkali-kali: `GET/POST /grup`, `GET/PUT/DELETE /grup/:id` (anggota berupa email, maks 500; detail grup menampilkan nama resmi dari SIM-GTK).
- Anggota grup (bukan pemilik): `GET /grup/keanggotaan` (grup orang lain yang menyertakan saya: nama, pemilik, jumlah anggota; **tanpa** daftar anggota lain), `DELETE /grup/keanggotaan/:id` (keluar dari grup; akses yang diberikan lewat grup itu ikut hilang). Grup yang diikuti boleh dipakai untuk mengundang ke rekaman sendiri (`POST /sesi/:uuid/undangan` `tipe: "grup"`).
- `GET /sesi/dibagikan` = sesi orang lain yang mengundang saya.
- Rapat berkategori **tertutup** (`terbatas`, bawaan: Rapat pimpinan) hanya boleh diundang per `orang` atau `grup` (ARCHITECTURE.md §5): `unit` dan `organisasi` ditolak 403.
- **Kategori rapat** dikelola superadmin (`kalam_kategori_rapat`): `GET /kategori` (semua pengguna, termasuk yang nonaktif agar rekaman lama tetap berlabel), `POST /admin/kategori`, `PATCH /admin/kategori/:id` (nama, `terbatas`, `aktif`; kode slug dibuat server dan tidak berubah). UI: Admin → Kategori rapat. Sesi menyimpan `kode` di `metadata.kategori`; kode yang tak ada atau nonaktif ditolak 422 `kategori_tidak_valid`. Migrasi `0004` mengisi empat kategori bawaan (pleno, kurikulum, komite, pimpinan).
- Undangan menjadi dasar akses untuk endpoint baca yang akan datang (transkrip, dokumen, pemutar audio): semuanya harus memakai `findReadable` di `src/akses.ts`.

### Sinkronisasi SIM-GTK

Sumber nama resmi dan unit GTK. Hanya membaca SIM-GTK: `GET {SIMGTK_API_URL}/getGuruList` dengan Bearer token (kontrak yang sama dengan e-Rapor dan SPMB). Unit dibaca dari `kode_unit`, `biodata.kode_unit`, atau `biodata.unit_kerja.kode`; `RA` dianggap `TK`, kode di luar TK/SD/SMP/SMA dilaporkan di hasil sinkron tetapi tidak dipakai. Orang dicocokkan lewat **email** (huruf kecil).

```bash
pnpm sync:simgtk --dry-run   # hanya menampilkan ringkasan, tidak menulis DB. Jalankan ini dulu.
pnpm sync:simgtk             # sinkron sungguhan; jadwalkan lewat cron/systemd timer di VPS
```

- Atau lewat API: `POST /admin/gtk/sinkron` (admin/superadmin), status di `GET /admin/gtk`.
- Semua-atau-tidak-sama-sekali: data diambil lengkap dulu, ditulis dalam satu transaksi. Daftar kosong dari SIM-GTK **ditolak** supaya gangguan SIM-GTK tidak mengosongkan keanggotaan unit dan diam-diam mencabut akses.
- GTK yang hilang dari SIM-GTK ditandai `aktif = false` dan keanggotaan unitnya dihapus (akses lewat undangan unit ikut hilang pada sinkron berikutnya).
- `GET /auth/me` mengembalikan `namaResmi` dan `units`.

### Worker transkripsi & analisis

Worker **ikut berjalan di dalam proses API** secara default (`WORKER_INLINE=true`), jadi `pnpm dev:api` sudah cukup; tidak ada proses terpisah yang bisa terlupa. Untuk memisahkannya set `WORKER_INLINE=false` dan jalankan `pnpm worker` (service systemd; `pnpm worker --once` menghabiskan antrean lalu keluar). Butuh **ffmpeg + ffprobe** di PATH (`apt install ffmpeg`) dan env `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `GEMINI_BASE_URL`; bila kosong worker tidak dijalankan dan API menulis peringatan jelas di log. Worker mencatat detak tiap 15 detik (`kalam_pengaturan`, kunci `worker_detak`); `GET /sesi/:uuid` memuat `pemrosesan.workerAktif` (UI menampilkan "Pemrosesan belum dimulai" bila `false`) dan `GET /admin/worker` melaporkannya untuk admin.

```
finish -> status mentranskrip -> [tahap 1] -> menganalisis -> [tahap 2] -> selesai   (atau gagal)
```

1. **Transkripsi**: potongan disambung berurutan, ditranskode **sekali** ke MP3 mono 16 kHz 32 kbps (`<uuid>/playback.mp3`, sekaligus audio pemutar), dipotong per `WHISPER_SEGMENT_DETIK` (600), tiap bagian dikirim ke Whisper (`@cf/openai/whisper-large-v3-turbo`, `vad_filter`). Penanda waktu memakai durasi nyata tiap bagian. Hasil per bagian di-cache, jadi percobaan ulang tidak menghabiskan kuota Whisper untuk bagian yang sudah selesai. Transkrip: `[HH:MM:SS] teks`, tanpa label pembicara (Whisper tidak melakukan diarization).
2. **Analisis**: Gemini lewat gateway sekolah (kompatibel OpenAI `/chat/completions`); bila gagal (gateway mati atau JSON rusak) memakai `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, hanya bila transkrip ≤ 40.000 karakter (di atasnya cadangan dilewati, bukan dipotong diam-diam). Hasil divalidasi (zod) lalu disimpan sebagai `kalam_dokumen` berstatus `draf`; untuk rapat, `action_items` ikut disalin ke `kalam_action_items`. AI menerima **nama** kategori ("Rapat komite"), bukan kodenya.
3. **Antrean di MySQL**: klaim atomik (`UPDATE … LIMIT 1`), aman dengan beberapa worker; kunci 30 menit dengan detak tiap 5 menit (worker mati = kunci kedaluwarsa, sesi diambil lagi); maks `WORKER_MAX_PERCOBAAN` (3) per tahap dengan backoff 5, 10, 20 menit; rekaman sunyi = `gagal` langsung tanpa percobaan ulang; sesi yang kehabisan percobaan karena worker berulang mati disapu menjadi `gagal`. **Kuota/batas laju layanan AI tidak menghabiskan percobaan**: kuota harian Cloudflare habis (429 / kode 4006) menunda sesi sampai 00:05 UTC, batas laju biasa 1 menit; sesi tetap `mentranskrip` dan `pemrosesan.cobaLagiSetelah` terisi. Progres per bagian audio (`progresSelesai/progresTotal`) terlihat di UI dan antrean admin.
4. **Pemotongan audio di jeda hening** (`silencedetect` -35 dB, ≥0,35 dtk): potongan sekitar `WHISPER_SEGMENT_DETIK` dicari titik heningnya (±90 dtk) supaya kata tidak terbelah; tanpa hening yang cocok dipotong tepat di titik ideal. Audio ≤ 1,25× target tidak dipotong. Segmen Whisper yang berulang identik ≥3 kali beruntun (halusinasi pada rekaman sunyi) dibuang. Cache hasil per bagian memuat durasi bagian, sehingga perubahan pemotongan tidak memakai hasil lama.

- Admin: `GET /admin/antrean` (sesi `mentranskrip`/`menganalisis`/`gagal` beserta galatnya, tanpa isi rekaman) dan `POST /admin/sesi/:uuid/ulangi` untuk mengulang sesi `gagal` dari tahap yang belum selesai.
- Hasil (semuanya lewat `findReadable`): `GET /sesi/:uuid/transkrip`, `GET /sesi/:uuid/dokumen`, `GET /sesi/:uuid/audio` (MP3, mendukung `Range`).
- Dokumen berstatus `draf` hanya terlihat oleh perekam dan superadmin; `POST /sesi/:uuid/dokumen/setujui` (perekam) membukanya untuk yang diundang. Transkrip dan audio terlihat oleh yang diundang segera setelah selesai.
- Kontrak keluaran rapat mengikuti `docs/prompt-notulensi.md` (bukan ARCHITECTURE.md §4.1, yang bentuknya berbeda). Prompt supervisi (`src/ai/prompts.ts`) diturunkan dari PRD FR-07..09 karena `docs/rubrik-supervisi.md` belum ada: makna skala 1-4 perlu ditinjau kepala sekolah.
- **PIC action items**: perekam menandai penanggung jawab tiap tugas dari direktori GTK lewat `PATCH /sesi/:uuid/tugas/:id` `{pic_email}` (null = lepas). Kolom `pic_email` + `pic_user_id` (terisi bila orangnya sudah pernah login); `pic_nama` tetap teks asli dari AI. Respons memuat `bisaMembaca`: `false` berarti yang ditandai belum bisa membaca rekaman (belum diundang), UI menawarkan undangan, tidak mengundang otomatis.
- **Momen penting** (PRD FR-04): `penanda_detik` pada `finish` disimpan di `metadata.penanda` dan diteruskan ke prompt sebagai `momen_penting`.
- `GET /gtk?cari=` (login, min. 2 huruf) mencari direktori GTK untuk pemilih guru/PIC/undangan.
- Migrasi database bersifat inkremental (`drizzle/0000…` sampai `0004…`). Jangan generate ulang dari nol pada database yang sudah berjalan: jalankan `pnpm db:generate` lalu `pnpm db:migrate`. Setelah menarik kode baru **selalu** jalankan `pnpm db:migrate`: kode yang lebih baru dari skema gagal dengan 500 ("Unknown column"). API memperingatkan saat start bila ada migrasi tertinggal, dan `/health` melaporkannya.
- **Saklar modul supervisi** (`kalam_pengaturan`, kunci `modul_supervisi`): **mati secara default**. Hanya superadmin yang mengubahnya (`GET/PATCH /admin/pengaturan`, UI: Admin → Pengaturan). Saat mati, server menolak membuat sesi/permintaan supervisi (403 `modul_nonaktif`) dan menyembunyikan semua sesi dan permintaan supervisi dari **semua** endpoint (daftar, detail, transkrip, audio, antrean admin, semua sesi), termasuk untuk superadmin. Datanya tidak dihapus dan muncul lagi saat dinyalakan; rekaman supervisi yang sudah diunggah tetap selesai diproses worker. `GET /auth/me` memuat `modul.supervisi` supaya UI menyembunyikan kontrolnya. Penegakan ada di `src/pengaturan.ts` (`filterModul`) dan dipakai `findOwn`/`findReadable`.
- Perhatian: `node --env-file` **tidak menimpa** variabel yang sudah ada di shell. Jika shell Anda meng-export `DATABASE_URL` global, nilainya mengalahkan `.env`.

## 6. Web (`apps/web`)

PWA mobile-first: React 19, TypeScript, Vite, Tailwind v4, **shadcn/ui** (token warna dan font dari `DESIGN.md`), **TanStack Router** (file-based) + **TanStack Query**, klien Hono bertipe (`AppType` dari `@kalam/api`), `idb` untuk penyimpanan lokal. Monorepo pnpm: `pnpm install` di root.

```bash
pnpm install                                     # di root repo
pnpm --filter @kalam/api dev                     # API :3000 (apps/api/.env)
cp apps/web/.env.example apps/web/.env           # VITE_API_URL=http://localhost:3000
pnpm --filter @kalam/web dev                     # web :5173
pnpm --filter @kalam/web build                   # produksi + service worker PWA
```

- `APP_URL` di `apps/api/.env` harus persis sama dengan origin web (mis. `http://localhost:5173`); API memakainya untuk CORS dan menolak mutasi dari origin lain. Cookie sesi same-site, jadi web dan API boleh beda port/subdomain.
- Layar: login Google, beranda (rekaman saya / dibagikan), setup + perekam live (offline-first: tiap potongan 30 dtk disimpan di IndexedDB sebelum diunggah; pemulihan setelah crash; batas durasi persetujuan ditegakkan), halaman hasil (notulen/lembar observasi, tugas + tag PIC, transkrip interaktif dengan pemutar audio, setujui dokumen, undangan), grup undangan, permintaan rekaman, dan area admin (permintaan, pengguna, antrean, GTK, semua sesi untuk superadmin).
- Mikrofon di browser hanya jalan di **HTTPS** (atau `localhost`).
- Belum ada: ekspor PDF/Word, WhatsApp pengingat tugas, tanda tangan, kuota AI (endpoint belum ada).
