import { z } from "zod";

const opt = <T extends z.ZodType>(s: T) => z.preprocess((v) => (v === "" ? undefined : v), s.optional());

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().default(3000),
  // Alamat bind. Di belakang reverse proxy (CloudPanel/Nginx) isi 127.0.0.1 supaya API tidak terbuka langsung di port ini.
  // Kosong = semua antarmuka (dev).
  HOST: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().min(1).optional()),
  API_URL: z.url(),
  APP_URL: z.url(),
  // Origin yang diizinkan untuk CORS dan mutasi POST/PUT/DELETE.
  // Bisa diisi beberapa domain dipisah koma (misal: "https://ruma.alakhyar.sch.id,https://simgtk.alakhyar.sch.id").
  // Jika kosong, otomatis memakai APP_URL.
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((s) => (s ? s.split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean) : [])),
  DATABASE_URL: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  // Domain Workspace yang diizinkan, dipisah koma (mis. "alakhyar.sch.id,gtk.alakhyar.sch.id"): sebagian akun GTK
  // memakai subdomain. Dicocokkan persis dengan klaim `hd` ID token.
  GOOGLE_HD: z
    .string()
    .transform((s) => s.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean))
    .pipe(z.array(z.string()).min(1)),
  // SIM-GTK (opsional): basis URL API (mis. https://simgtk.alakhyar.sch.id/api) dan token Bearer.
  // Kosong = sinkronisasi GTK dinonaktifkan; undangan per unit dan nama resmi tidak berfungsi.
  SIMGTK_API_URL: z
    .string()
    .optional()
    .transform((v) => v?.trim().replace(/\/+$/, "") || undefined)
    .pipe(z.url().optional()),
  SIMGTK_TOKEN: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  // Direktori audio mentah di disk VPS. Harus masuk jadwal backup dan berada di luar folder kode.
  AUDIO_DIR: z.string().min(1).default("./data/audio"),
  // Daftar email (dipisah koma) yang otomatis menjadi superadmin saat login. Satu-satunya jalan menuju superadmin.
  SUPERADMIN_EMAILS: z
    .string()
    .default("")
    .transform((s) => s.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)),

  // --- Worker transkripsi & analisis (pnpm worker). Kosong = worker menolak start; API tidak terpengaruh. ---
  CF_ACCOUNT_ID: opt(z.string().trim().min(1)),
  CF_API_TOKEN: opt(z.string().trim().min(1)),
  CF_API_BASE: z.url().default("https://api.cloudflare.com/client/v4"),
  WHISPER_MODEL: z.string().default("@cf/openai/whisper-large-v3-turbo"),
  CF_LLM_MODEL: z.string().default("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
  // Gateway Gemini sekolah, kompatibel OpenAI: POST {GEMINI_BASE_URL}/chat/completions.
  GEMINI_BASE_URL: opt(z.url()),
  GEMINI_API_KEY: opt(z.string().trim().min(1)),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  // Audio dipotong sepanjang ini sebelum dikirim ke Whisper (detik).
  WHISPER_SEGMENT_DETIK: z.coerce.number().int().min(5).max(1800).default(600),
  WORKER_POLL_DETIK: z.coerce.number().int().min(1).default(10),
  WORKER_MAX_PERCOBAAN: z.coerce.number().int().min(1).default(3),
  // Jalankan worker di dalam proses API (default). "false" = dijalankan sebagai proses sendiri (`pnpm worker`).
  WORKER_INLINE: z
    .string()
    .default("true")
    .transform((v) => !["false", "0", "no"].includes(v.trim().toLowerCase())),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
