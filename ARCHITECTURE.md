# Blueprint Arsitektur Teknis: Notula AI

**Versi:** 1.0.0  
**Tanggal:** 3 November 2026  
**Status:** Draf Arsitektur Rekayasa  

---

## 1. Diagram Arsitektur Sistem

```mermaid
flowchart TD
    subgraph Client ["Client Layer (PWA / Mobile)"]
        MIC[Mikrofon Device] --> REC[Web Audio / MediaRecorder API\nOpus @ 32kbps Mono]
        REC --> IDB[(IndexedDB Local Buffer\nAnti-Hilang Sinyal)]
        IDB --> UPL[Background Chunk Uploader]
    end

    subgraph Gateway ["Backend & Orchestration API"]
        UPL --> API[Notula API Service\nNode/Laravel/FastAPI]
        API --> S3[(Object Storage R2/S3\nArsip Audio Terenkripsi)]
        API --> QUEUE[Job Queue / Background Worker]
    end

    subgraph AI_Layer1 ["AI Layer 1: Transkripsi Akustik"]
        QUEUE -->|Audio Buffer Chunk| CF_WHISPER[Cloudflare Workers AI\n@cf/openai/whisper-large-v3-turbo]
        CF_WHISPER -->|Raw Text + Timestamps| TRANSCRIPT[Agregator Transkrip Rapat/Kelas]
    end

    subgraph AI_Layer2 ["AI Layer 2: Penalaran & Notulensi Dokumen"]
        TRANSCRIPT --> DISPATCH{Pilih Mode Sesi}
        
        DISPATCH -->|Mode Rapat| PROMPT_MEETING[Prompt Notulen & Action Items]
        DISPATCH -->|Mode Supervisi| PROMPT_SUPERVISI[Prompt Rubrik Observasi KBM]

        PROMPT_MEETING --> GEMINI[Google Gemini Gateway\nContext Window 2M Token\ngemini-3.7-flash]
        PROMPT_SUPERVISI --> GEMINI

        GEMINI -.->|Jika Gateway Down (Failover)| CF_LLAMA[Cloudflare Workers AI\n@cf/meta/llama-3.3-70b-instruct]
    end

    subgraph Output ["Output & Integrasi"]
        GEMINI --> DOCS[Struktur JSON Terverifikasi]
        CF_LLAMA --> DOCS
        DOCS --> DB[(Database Notulen & Supervisi)]
        DOCS --> EXPORT[Generator Dokumen PDF & Word]
        DOCS --> SYNC_ERAPOR[Sinkronisasi Catatan Supervisi e-Rapor / SIM-GTK]
    end
```

---

## 2. Pipeline Rekaman Audio & Kompresi di Sisi Klien (PWA)

### 2.1 Format & Efisiensi Bitrate
Audio percakapan manusia (*human speech*) tidak membutuhkan kualitas stereo frekuensi tinggi (128–320 kbps).
- **Format:** `audio/webm;codecs=opus` (Android/Chrome/Edge) atau `audio/mp4;codecs=aac` (iOS Safari).
- **Sample Rate:** `16.000 Hz` (standar emas model Whisper).
- **Channels:** `1` (Mono).
- **Bitrate:** `32 kbps`.

**Perbandingan Ukuran Berkas Rapat 60 Menit:**
- Uncompressed WAV: **~635 MB** *(mustahil diunggah via HP guru)*.
- Standard MP3 128 kbps: **~58 MB**.
- **Opus 32 kbps Mono: ~14,4 MB** *(sangat ringan, muat dalam batas upload API, hemat kuota internet sekolah)*.

### 2.2 Mekanisme Anti-Gagal (Network Resilience)
1. **Layar HP Redup / Sleep**: PWA memanggil `navigator.wakeLock.request('screen')` saat tombol rekam ditekan agar sistem operasi Android/iOS tidak membunuh proses perekaman audio di latar belakang.
2. **Offline-First Buffering**: Setiap potongan audio 30 detik disimpan terlebih dahulu ke **IndexedDB** lokal peramban sebelum dikirim ke server. Jika internet sekolah terputus di tengah rapat, audio tetap utuh dan otomatis terkirim saat internet kembali aktif.

---

## 3. Pipeline Pemrosesan AI Hybrid

### 3.1 Tahap 1: Transkripsi via Cloudflare Workers AI (Whisper)
- **Endpoint:** `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/openai/whisper`
- **Model:** `@cf/openai/whisper-large-v3-turbo` (atau `@cf/openai/whisper`).
- **Input:** Buffer biner audio.
- **Output:** JSON berisi teks transkrip dan penanda waktu (*timestamp* vtt/srt):
  ```json
  {
    "result": {
      "text": "Selamat pagi bapak ibu dewan guru, agenda rapat kita hari ini adalah persiapan asesmen sumatif...",
      "word_count": 3400
    }
  }
  ```
- **Kapasitas Gratis:** Jatah 10.000 neuron/hari Cloudflare setara **~240 menit (4 jam rekaman audio per hari)** per akun sekolah.

### 3.2 Tahap 2: Penalaran & Notulensi via Google Gemini Gateway
Mengapa transkrip tidak diproses oleh model lokal kecil, melainkan dialirkan ke Gemini?
- Rapat 90 menit menghasilkan **±12.000 hingga 18.000 kata transkrip**.
- Model LLM open-source kecil (8B atau 14B) sering mengalami *context degradation* (lupa detail awal rapat saat membaca ujung rapat).
- **Google Gemini Gateway** sekolah memiliki jendela konteks **1.000.000 hingga 2.000.000 token**. Transkrip 2 jam rapat dapat dicerna sekaligus tanpa dipotong, menjaga korelasi antara perdebatan di awal dengan kesimpulan di akhir.

---

## 4. Spesifikasi Kontrak Dokumen Output

### 4.1 Modul 1: JSON Notulensi Rapat
```json
{
  "tipe_sesi": "rapat",
  "metadata": {
    "judul_rapat": "Rapat Koordinasi Persiapan SAS & Asesmen Karakter Semester Ganjil",
    "tanggal": "2026-11-03",
    "durasi_menit": 75,
    "pemimpin_rapat": "Kepala Sekolah",
    "peserta_terdeteksi": ["Pak Fajrul", "Pak Ihwan", "Bu Rahma", "Pak Agung"]
  },
  "ringkasan_eksekutif": "Rapat membahas kesiapan perangkat soal sumatif ganjil dan penertiban absensi siswa...",
  "agenda_pembahasan": [
    {
      "topik": "Standardisasi Butir Soal CBT",
      "pembahasan": "Guru mapel diminta menyusun soal berstandar Kurikulum Merdeka...",
      "keputusan": "Batas pengumpulan naskah soal ditetapkan hari Jumat, 20 November 2026."
    }
  ],
  "action_items": [
    {
      "id": "act_1",
      "tugas": "Finalisasi draf paket soal informatika dan upload ke Bank Soal",
      "pic": "Pak Fajrul",
      "tenggat_waktu": "2026-11-20",
      "prioritas": "Tinggi"
    }
  ]
}
```

### 4.2 Modul 2: JSON Supervisi Akademik / Observasi Kelas
```json
{
  "tipe_sesi": "supervisi_kelas",
  "metadata": {
    "guru_yang_diobservasi": "Muh Fajrul Islam S.Kom",
    "mata_pelajaran": "Informatika",
    "kelas": "7 Al Halim",
    "materi_pembelajaran": "Logika Algoritma & Percabangan If-Else",
    "observer": "Kepala Sekolah",
    "tanggal_observasi": "2026-11-03",
    "durasi_menit": 80
  },
  "rubrik_observasi": {
    "kegiatan_pendahuluan": {
      "skor": 4,
      "temuan_faktual": "Guru membuka pelajaran dengan mengaitkan logika percabangan lampu lalu lintas (apersepsi kontekstual)."
    },
    "kegiatan_inti": {
      "skor": 4,
      "pembelajaran_berdiferensiasi": "Siswa dibagi ke dalam 3 kelompok berdasarkan pemahaman awal algoritma.",
      "keaktifan_siswa": "Tinggi, siswa berdiskusi aktif menuliskan pseudocode di papan."
    },
    "kegiatan_penutup": {
      "skor": 3,
      "temuan_faktual": "Refleksi singkat dilakukan, namun asesmen formatif akhir terburu-buru karena waktu habis."
    }
  },
  "praktik_baik_guru": [
    "Penggunaan analogi dunia nyata membuat konsep abstrak variabel mudah dipahami siswa SMP."
  ],
  "area_pengembangan": [
    "Manajemen alokasi waktu pada fase penutup perlu ditingkatkan agar asesmen formatif dapat tuntas."
  ],
  "draf_catatan_umpan_balik_kepsek": "Apresiasi atas pembelajaran yang sangat interaktif. Untuk siklus berikutnya, fokuskan pada pembatasan durasi diskusi kelompok agar fase refleksi penutup memiliki waktu minimal 10 menit."
}
```

---

## 5. Keamanan Data & Kepatuhan UU PDP (Privasi Sekolah)

1. **Rekaman Suara Murid**: Sesuai prinsip UU PDP (Pasal 16 & 35), rekaman audio di ruang kelas memuat suara anak di bawah umur.
   - Berkas audio mentah di storage R2/S3 diberi status **Private Presigned Access** (hanya bisa diputar oleh kepala sekolah dan guru bersangkutan).
   - Berkas audio mentah dapat diatur memiliki kebijakan **Auto-Purge (Retensi 30 Hari)**: setelah transkrip dan notulen disetujui, file audio besar dihapus otomatis dari server, hanya menyisakan dokumen teks yang hemat ruang.
2. **Kerahasiaan Rapat Pimpinan / Yayasan**: Sesi rapat berlabel `Rahasia / Pimpinan` memiliki enkripsi data di database dan tidak dapat dilihat oleh staf atau guru biasa.

---

## 6. Skema Basis Data (Database Tables)

```sql
-- Sesi Rekaman
CREATE TABLE kalam_sesi (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) UNIQUE NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL, -- Perekam (Kepala Sekolah / Notulis)
    sekolah_id CHAR(36) NOT NULL,
    tipe_sesi ENUM('rapat', 'supervisi_kelas') NOT NULL,
    judul VARCHAR(255) NOT NULL,
    status ENUM('merekam', 'mentranskrip', 'menganalisis', 'selesai', 'gagal') DEFAULT 'merekam',
    audio_path VARCHAR(500) NULL,
    durasi_detik INT UNSIGNED DEFAULT 0,
    audio_size_bytes BIGINT UNSIGNED DEFAULT 0,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);

-- Transkrip Mentah dari Whisper
CREATE TABLE kalam_transkrip (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sesi_id BIGINT UNSIGNED NOT NULL,
    raw_text LONGTEXT NOT NULL,
    segments_json LONGTEXT NULL, -- Array [{start: 0, end: 5, text: "..."}]
    whisper_model VARCHAR(100) DEFAULT '@cf/openai/whisper-large-v3-turbo',
    durasi_transkrip_ms INT UNSIGNED DEFAULT 0,
    created_at TIMESTAMP NULL,
    FOREIGN KEY (sesi_id) REFERENCES kalam_sesi(id) ON DELETE CASCADE
);

-- Dokumen Hasil Analisis Gemini (Notulen / Lembar Supervisi)
CREATE TABLE kalam_dokumen (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sesi_id BIGINT UNSIGNED NOT NULL,
    payload_json LONGTEXT NOT NULL, -- Struktur JSON notulen atau rubrik supervisi
    guru_target_id BIGINT UNSIGNED NULL, -- Guru yang disupervisi (khusus supervisi)
    gemini_model VARCHAR(100) NULL,
    status_verifikasi ENUM('draf', 'disetujui') DEFAULT 'draf',
    disetujui_oleh BIGINT UNSIGNED NULL,
    disetujui_pada TIMESTAMP NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (sesi_id) REFERENCES kalam_sesi(id) ON DELETE CASCADE
);

-- Matriks Tindak Lanjut Rapat (Action Items)
CREATE TABLE kalam_action_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dokumen_id BIGINT UNSIGNED NOT NULL,
    tugas TEXT NOT NULL,
    pic_nama VARCHAR(150) NOT NULL,
    pic_user_id BIGINT UNSIGNED NULL,
    tenggat_waktu DATE NULL,
    status ENUM('pending', 'proses', 'selesai') DEFAULT 'pending',
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (dokumen_id) REFERENCES kalam_dokumen(id) ON DELETE CASCADE
);
```
