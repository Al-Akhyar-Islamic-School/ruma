# Rekomendasi LLM Lokal (Desktop Mac & Windows) untuk ruma.

**Tujuan:** menjalankan transkripsi Whisper dan penalaran notulen secara offline/lokal di komputer (macOS / Windows) tanpa biaya API eksternal dan tanpa kuota.

---

## 1. Local Whisper (Audio-to-Text)

Untuk transkripsi lokal, gunakan **`whisper.cpp`** (C/C++ runtime cepat, mendukung Apple Metal GPU & Windows CUDA/DirectML/Vulkan) atau modul **Faster-Whisper** (CTranslate2).

### Pilihan Model Whisper (Gratis & Terbuka)

| Model | Ukuran Berkas | RAM / VRAM Min. | Akurasi Bhs. Indonesia | Kecepatan di Mac M-Series / PC | Rekomendasi Penggunaan |
|---|---|---|---|---|---|
| **`whisper-large-v3-turbo` (GGUF / CoreML)** | **~1.6 GB** | **~4 GB** | **Sangat Baik (95%+)** | **Sangat Cepat (~8x real-time)** | **Pilihan Utama (Default)**. Model terbaru OpenAI dengan kualitas mirip `large-v3` tetapi komputasi jauh lebih ringan. |
| `whisper-medium` | ~1.5 GB | ~4 GB | Baik (~90%) | Cepat (~6x) | Alternatif jika turbo mengalami halusinasi pada audio bising. |
| `whisper-small` | ~460 MB | ~2 GB | Cukup (~80%) | Sangat Cepat | Cocok untuk laptop Windows entry-level tanpa GPU diskret. |
| `whisper-base` | ~140 MB | ~1 GB | Kurang untuk istilah teknis | Instan | Terlalu banyak typo pada istilah pendidikan Al Akhyar. |

- **Format:** GGUF (untuk `whisper.cpp`) atau `ctranslate2` (untuk Python runtime).
- **Tempat Unduh Resmi:** [HuggingFace - ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp) atau via Ollama / CLI `whisper.cpp`.

---

## 2. Local Text LLM (Notulensi & Penalaran)

Untuk menyusun ringkasan rapat, agenda, keputusan, dan action items dari transkrip panjang berbahasa Indonesia.

### Pilihan Model Teks Bahasa Indonesia (Gratis & Ringan)

| Model | Parameter & Varian | Ukuran GGUF (Q4_K_M) | RAM / VRAM Min. | Bahasa Indonesia & Format Notulen | Rekomendasi Hardware |
|---|---|---|---|---|---|
| **Qwen 2.5 7B Instruct** | 7 Miliar | **~4.7 GB** | **8 GB - 16 GB** | **Terbaik di kelasnya.** Sangat fasih berbahasa Indonesia formal, patuh JSON output 100%, mampu membaca konteks hingga 32k - 128k token. | Mac M1/M2/M3 (16GB RAM) atau PC Windows dengan RTX 3060/4060 (6-8GB VRAM). **(Rekomendasi Utama)** |
| **Qwen 2.5 3B Instruct** | 3 Miliar | **~2.0 GB** | **4 GB - 8 GB** | Luar biasa untuk ukurannya. Cukup fasih Indonesia, format rapi. | Laptop tipis tanpa GPU dedicated, Mac 8GB RAM. |
| **Llama 3.1 8B Instruct** | 8 Miliar | ~4.9 GB | 16 GB | Bagus, namun pemahaman idiom dan istilah lokal Indonesia sedikit di bawah Qwen 2.5. | Alternatif jika ingin ekosistem Meta. |
| **Gemma 2 9B Instruct** | 9 Miliar | ~5.5 GB | 16 GB | Bahasa Indonesia sangat baik, tetapi penalaran instruksi terstruktur (JSON) kadang terpotong. | Pilihan ketiga. |

---

## 3. Arsitektur Versi Desktop (Mac & Windows)

### Pilihan Runtime Desktop: **Tauri v2** (Bukan Electron)
- **Ukuran paket installer:** ~15 MB (dibandingkan Electron yang 150 MB+).
- **Bahasa:** Frontend tetap React 19 + Vite (menggunakan UI ruma. yang sudah ada), backend native memakai Rust.
- **Inference Engine Lokal Terbuka:**
  - Opsi A: Bundel engine `llama.cpp` + `whisper.cpp` embedded langsung di dalam binary Tauri.
  - Opsi B: Koneksikan ke **Ollama** lokal yang sudah berjalan di komputer pengguna (`http://localhost:11434/v1` - kompatibel API OpenAI).
