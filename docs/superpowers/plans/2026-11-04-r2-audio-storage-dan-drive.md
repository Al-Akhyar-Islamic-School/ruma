# Implementasi Penyimpanan Audio Cloudflare R2 (Retensi 90 Hari) & Salinan Audio ke Google Drive

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menggantikan penyimpanan berkas audio lokal di VPS dengan Cloudflare R2 (retensi siklus hidup 90 hari) dan menyediakan fitur penyimpanan salinan rekaman audio (`playback.mp3`) ke Google Drive pengguna di dalam folder yang sama dengan notulen resmi (`"ruma. Notulen"`).

**Architecture:** 
1. **Cloudflare R2 Storage Adapter (`AudioStorage`):** Chunks audio 30 detik diunggah langsung ke Cloudflare R2 (S3-compatible). Saat worker transkripsi berjalan, chunks diunduh ke scratchpad lokal sementara, disambung dan dikonversi ke MP3 oleh ffmpeg, diunggah kembali sebagai `playback.mp3` ke R2, lalu berkas scratchpad lokal dibersihkan. Pemutaran audio di web streaming langsung dari R2 lewat API Hono dengan dukungan Range Request (status 206) tanpa membebani disk VPS.
2. **Retensi 90 Hari:** Diterapkan di level bucket Cloudflare R2 via Object Lifecycle Rule (otomatis terhapus setelah 90 hari tanpa biaya egress). Pada API dan UI, jika rekaman sudah melewati 90 hari, antarmuka pemutar menampilkan notifikasi status retensi tanpa merusak teks notulen/dokumen yang tetap permanen.
3. **Penyimpanan Audio ke Google Drive:** Memanfaatkan Google Drive API v3 (Resumable Upload) menggunakan OAuth token pengguna yang sudah tersambung, mengunggah `playback.mp3` langsung ke folder `"ruma. Notulen"` yang sama dengan dokumen notulen resmi, membagikan akses ke peserta rapat, dan mencatat tautannya di tabel dokumen sesi.

**Tech Stack:**
- Cloudflare R2 via `@aws-sdk/client-s3`
- Node.js 22, TypeScript, Hono v4, Drizzle ORM (MySQL)
- Google Drive API v3 (OAuth 2.0 `drive.file`, Resumable Upload)
- React 19, Vite, TanStack Router & Query, Tailwind CSS, Lucide Icons, Sonner

## Global Constraints

- Bahasa penamaan kode mengikuti konvensi repositori (istilah domain Bahasa Indonesia untuk model dan variabel bisnis: `sesi`, `dokumen`, `undangan`, `storage`).
- Tidak boleh meninggalkan file sementara (scratchpad) di disk VPS setelah proses transkripsi selesai.
- Alur Range Request HTTP (206 Partial Content) untuk pemutar audio peramban wajib tetap bekerja mulus untuk seeking di iOS Safari dan Chrome.
- Akses berkas audio di R2 bersifat privat; tidak boleh membuka public bucket tanpa autentikasi pengguna sesi.
- Scope Google OAuth tetap menggunakan `https://www.googleapis.com/auth/drive.file` (tidak memerlukan perluasan scope berisiko tinggi).

---

### Task 1: Skema Database & Migrasi untuk Kolom Audio Google Drive

**Files:**
- Modify: `apps/api/src/db/schema.ts:210-225`
- Create: `apps/api/drizzle/0001_audio_drive.sql` (dihasilkan via `drizzle-kit generate`)

**Interfaces:**
- Consumes: Skema tabel `dokumen` (`ruma_dokumen`)
- Produces: Kolom baru `googleDriveAudioFileId` (`varchar(255)`) dan `googleDriveAudioUrl` (`varchar(500)`) pada tabel `dokumen`.

- [ ] **Step 1: Tambahkan definisi kolom di `schema.ts`**

Edit `apps/api/src/db/schema.ts` pada tabel `dokumen`:
```typescript
  // Ekspor ke Google Docs & Drive (OAuth Drive pengguna)
  googleDocsFileId: varchar("google_docs_file_id", { length: 255 }),
  googleDocsUrl: varchar("google_docs_url", { length: 500 }),
  googleDriveAudioFileId: varchar("google_drive_audio_file_id", { length: 255 }),
  googleDriveAudioUrl: varchar("google_drive_audio_url", { length: 500 }),
```

- [ ] **Step 2: Generate migrasi database dengan Drizzle Kit**

Run:
```bash
pnpm --filter @kalam/api db:generate
```
Expected: Terbentuk berkas migrasi baru di `apps/api/drizzle/` yang menambahkan `google_drive_audio_file_id` dan `google_drive_audio_url`.

- [ ] **Step 3: Jalankan migrasi pada database lokal**

Run:
```bash
pnpm --filter @kalam/api db:migrate
```
Expected: Migrasi sukses dieksekusi tanpa error.

- [ ] **Step 4: Commit perubahan skema**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat(db): tambahkan kolom google_drive_audio_file_id dan google_drive_audio_url pada ruma_dokumen"
```

---

### Task 2: Konfigurasi Environment & Dependensi Cloudflare R2

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/env.ts`
- Modify: `apps/api/.env.example`

**Interfaces:**
- Consumes: Environment variables sistem
- Produces: Nilai `env.R2_ACCOUNT_ID`, `env.R2_ACCESS_KEY_ID`, `env.R2_SECRET_ACCESS_KEY`, `env.R2_BUCKET_NAME`, `env.R2_ENDPOINT` yang tervalidasi via Zod.

- [ ] **Step 1: Pasang dependensi AWS S3 Client pada `apps/api`**

Run:
```bash
pnpm --filter @kalam/api add @aws-sdk/client-s3
```
Expected: `@aws-sdk/client-s3` tercatat di `dependencies` `apps/api/package.json`.

- [ ] **Step 2: Perbarui skema Zod di `apps/api/src/env.ts`**

Tambahkan variabel R2 ke Zod schema:
```typescript
  // Cloudflare R2 Storage (S3-compatible)
  R2_ACCOUNT_ID: opt(z.string().trim().min(1)),
  R2_ACCESS_KEY_ID: opt(z.string().trim().min(1)),
  R2_SECRET_ACCESS_KEY: opt(z.string().trim().min(1)),
  R2_BUCKET_NAME: opt(z.string().trim().min(1)),
  R2_ENDPOINT: opt(z.url()),
```

- [ ] **Step 3: Perbarui `.env.example` di `apps/api`**

Tambahkan baris berikut ke `apps/api/.env.example`:
```env
# Cloudflare R2 Object Storage (Opsional di dev, wajib di prod untuk zero-disk audio)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=ruma-audio-prod
# R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
```

- [ ] **Step 4: Uji typecheck env**

Run:
```bash
pnpm --filter @kalam/api typecheck
```
Expected: Typecheck lulus tanpa error.

- [ ] **Step 5: Commit konfigurasi env**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/env.ts apps/api/.env.example
git commit -m "feat(api): tambahkan dependensi @aws-sdk/client-s3 dan konfigurasi env Cloudflare R2"
```

---

### Task 3: Implementasi Adapter `R2AudioStorage` & Penggantian `DiskStorage`

**Files:**
- Create: `apps/api/src/r2.ts`
- Modify: `apps/api/src/storage.ts`

**Interfaces:**
- Consumes: `@aws-sdk/client-s3`, `env.ts`
- Produces: Interface `AudioStorage` yang mendukung upload, download ke file lokal, stream Range GET dari R2, penghapusan, dan fallback otomatis ke `DiskStorage` saat R2 tidak dikonfigurasi di lingkungan dev.

- [ ] **Step 1: Buat modul `apps/api/src/r2.ts` untuk koneksi klien S3/R2**

Tulis implementasi pembuat client S3 untuk R2:
```typescript
import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

export function buatKlienR2(): S3Client | null {
  const accountId = env.R2_ACCOUNT_ID || env.CF_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  const endpoint = env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}
```

- [ ] **Step 2: Perbarui antarmuka dan implementasi `apps/api/src/storage.ts`**

Tulis kelas `R2AudioStorage` yang mengimplementasikan `AudioStorage`:
```typescript
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "./env.js";
import { buatKlienR2 } from "./r2.js";

export type HasilStreamAudio = {
  stream: Readable;
  contentLength: number;
  contentRange?: string;
  contentType: string;
  statusCode: 200 | 206;
};

export interface AudioStorage {
  put(key: string, data: Uint8Array | Buffer, contentType?: string): Promise<void>;
  uploadFromFile(localPath: string, key: string, contentType?: string): Promise<void>;
  downloadToFile(key: string, localDestPath: string): Promise<void>;
  getStream(key: string, rangeHeader?: string): Promise<HasilStreamAudio | null>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  /** Mengembalikan path lokal jika menggunakan disk, atau mengunduh sementara ke scratchpad jika R2. */
  pastikanLokal(key: string, scratchDir?: string): Promise<string>;
}
```

Lengkapi metode `R2AudioStorage`:
1. `put`: memanggil `PutObjectCommand` dengan Buffer dan ContentType.
2. `uploadFromFile`: membaca stream file lokal dan mengirim `PutObjectCommand`.
3. `downloadToFile`: memanggil `GetObjectCommand`, menyambungkan stream body ke write stream file lokal.
4. `getStream`: memanggil `GetObjectCommand` dengan meneruskan `Range: rangeHeader`, memetakan status `206 Partial Content` atau `200 OK`.
5. `deletePrefix`: membersihkan seluruh chunk `sesiUuid/` setelah `playback.mp3` berhasil dirakit.
6. Fallback instansiasi:
   ```typescript
   const r2Client = buatKlienR2();
   export const audioStorage: AudioStorage = r2Client && env.R2_BUCKET_NAME
     ? new R2AudioStorage(r2Client, env.R2_BUCKET_NAME)
     : new DiskStorage(env.AUDIO_DIR);
   ```

- [ ] **Step 3: Uji unit / verifikasi kompilasi `storage.ts`**

Run:
```bash
pnpm --filter @kalam/api typecheck
```
Expected: Lulus tanpa type error.

- [ ] **Step 4: Commit adapter storage**

```bash
git add apps/api/src/r2.ts apps/api/src/storage.ts
git commit -m "feat(api): implementasikan adapter R2AudioStorage dengan streaming range dan manajemen objek"
```

---

### Task 4: Penyesuaian Pipeline Transkripsi & Worker untuk R2

**Files:**
- Modify: `apps/api/src/pipeline.ts:30-55`
- Modify: `apps/api/src/pipeline.ts:95-112`

**Interfaces:**
- Consumes: `audioStorage.pastikanLokal`, `audioStorage.uploadFromFile`, `audioStorage.deletePrefix`
- Produces: Transkripsi Whisper yang bekerja dengan scratchpad lokal sementara (`/tmp/ruma-work-<uuid>`), menyimpan `playback.mp3` ke R2, dan menghapus seluruh artefak lokal serta chunk mentah di R2 setelah transkripsi selesai.

- [ ] **Step 1: Modifikasi alur perakitan audio di `pipeline.ts`**

Ubah tahap awal `tahapTranskripsi` agar:
1. Menyiapkan folder kerja scratchpad lokal (`path.join(os.tmpdir(), "ruma-work", s.uuid)`).
2. Memeriksa apakah `playback.mp3` sudah ada di R2. Jika belum:
   - Ambil daftar chunk dari database `audioChunks`.
   - Unduh setiap chunk ke scratchpad lokal melalui `audioStorage.downloadToFile(c.key, localChunkPath)`.
   - Sambungkan (`sambung`) dan transkode (`keMp3`) ke `playback.tmp.mp3`.
   - Unggah hasil `playback.mp3` ke R2 (`await audioStorage.uploadFromFile(playbackLocal, playbackKey, "audio/mpeg")`).
3. Jalankan `potongDiHening` pada `playbackLocal` di scratchpad lokal untuk segmen Whisper.
4. Lakukan transkripsi Whisper seperti biasa.

- [ ] **Step 2: Modifikasi pembersihan setelah transkripsi selesai**

Setelah transaksi database sukses (`tx.update(sesi).set({ status: "menganalisis", audioPath: playbackKey, ... })`):
1. Hapus scratchpad lokal sepenuhnya: `await rm(dir, { recursive: true, force: true })`.
2. Bersihkan chunk mentah `.part` di R2 untuk menghemat kuota penyimpanan:
   ```typescript
   // Chunk mentah sudah digantikan oleh playback.mp3; hapus untuk menghemat ruang
   await audioStorage.deletePrefix(`${s.uuid}/`).catch(() => undefined);
   ```

- [ ] **Step 3: Uji typecheck pipeline**

Run:
```bash
pnpm --filter @kalam/api typecheck
```
Expected: Lulus tanpa error kompilasi.

- [ ] **Step 4: Commit penyesuaian pipeline**

```bash
git add apps/api/src/pipeline.ts
git commit -m "feat(worker): sesuaikan pipeline transkripsi untuk scratchpad lokal dan upload playback ke R2"
```

---

### Task 5: Streaming Pemutar Audio dari R2 & Handler Retensi 90 Hari

**Files:**
- Modify: `apps/api/src/routes/hasil.ts:150-160`

**Interfaces:**
- Consumes: `audioStorage.getStream`, `sesi.createdAt`
- Produces: Endpoint `GET /sesi/:uuid/audio` yang streaming langsung dari R2 dengan HTTP 206 Range Request, serta mengembalikan HTTP 410 Gone jika objek telah melewati batas retensi 90 hari.

- [ ] **Step 1: Perbarui handler `GET /:uuid/audio` di `apps/api/src/routes/hasil.ts`**

Gantikan fungsi `kirimBerkas` lama dengan streaming dari `audioStorage.getStream`:
```typescript
  .get("/:uuid/audio", zValidator("param", uuidParam), async (c) => {
    const { uuid } = c.req.valid("param");
    const s = await sesiDenganIzin(uuid, c.get("user"));
    if (!s) return c.json({ error: "tidak_ditemukan" }, 404);
    if (!s.audioPath) return c.json({ error: "belum_tersedia", status: s.status }, 404);

    // Cek batas waktu retensi 90 hari (90 * 24 * 3600 * 1000 ms)
    const usiaMs = Date.now() - s.createdAt.getTime();
    const RETENSI_90_HARI_MS = 90 * 24 * 3600 * 1000;
    if (usiaMs > RETENSI_90_HARI_MS) {
      return c.json(
        {
          error: "audio_kedaluwarsa",
          pesan: "Audio rekaman telah kedaluwarsa sesuai kebijakan retensi 90 hari.",
        },
        410
      );
    }

    const range = c.req.header("range");
    const hasilStream = await audioStorage.getStream(s.audioPath, range);
    if (!hasilStream) {
      return c.json(
        {
          error: "audio_tidak_ditemukan",
          pesan: "Berkas audio tidak ditemukan di penyimpanan objek atau telah kedaluwarsa.",
        },
        410
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": hasilStream.contentType,
      "Accept-Ranges": "bytes",
      "Content-Length": String(hasilStream.contentLength),
      "Cache-Control": "private, max-age=3600",
    };
    if (hasilStream.contentRange) {
      headers["Content-Range"] = hasilStream.contentRange;
    }

    return new Response(hasilStream.stream as any, {
      status: hasilStream.statusCode,
      headers,
    });
  })
```

- [ ] **Step 2: Uji typecheck `hasil.ts`**

Run:
```bash
pnpm --filter @kalam/api typecheck
```
Expected: Lulus tanpa error.

- [ ] **Step 3: Commit rute streaming audio**

```bash
git add apps/api/src/routes/hasil.ts
git commit -m "feat(api): layani streaming audio langsung dari R2 dengan Range request dan proteksi retensi 90 hari"
```

---

### Task 6: Modul Unggah Audio ke Google Drive Resumable API di Folder `"ruma. Notulen"`

**Files:**
- Create: `apps/api/src/integrasi/google-drive-audio.ts`
- Modify: `apps/api/src/integrasi/google-docs.ts` (ekspor fungsi `pastikanFolderRuma` dan `bagikanKePeserta`)

**Interfaces:**
- Consumes: Token OAuth Drive pengguna (`ambilValidAccessToken`), `pastikanFolderRuma`, stream audio dari `audioStorage`
- Produces: Fungsi `unggahAudioKeGoogleDrive(userId, sesi, judul, tanggal, pesertaUndangan): Promise<{ fileId: string; url: string }>`

- [ ] **Step 1: Ekspor `pastikanFolderRuma` dan `bagikanKePeserta` di `google-docs.ts`**

Pastikan fungsi pembantu di `apps/api/src/integrasi/google-docs.ts` diekspor agar dapat digunakan bersama:
```typescript
export async function pastikanFolderRuma(token: string): Promise<string | null> { ... }
export async function bagikanKePeserta(token: string, fileId: string, emailList: string[], judul: string, pengirim?: string): Promise<void> { ... }
```

- [ ] **Step 2: Buat `apps/api/src/integrasi/google-drive-audio.ts`**

Implementasikan upload audio menggunakan Google Drive Resumable Upload protocol:
```typescript
import { ambilValidAccessToken } from "./google-auth.js";
import { bagikanKePeserta, pastikanFolderRuma } from "./google-docs.js";
import { audioStorage } from "../storage.js";
import os from "node:os";
import path from "node:path";
import { readFile, rm, stat } from "node:fs/promises";

const DRIVE_UPLOAD_INIT = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink";

export async function unggahAudioKeGoogleDrive(
  userId: number,
  sesi: { uuid: string; audioPath: string | null },
  judulSesi: string,
  tanggal: string,
  pesertaUndangan?: { nama: string; email: string }[]
): Promise<{ fileId: string; url: string }> {
  if (!sesi.audioPath) {
    throw new Error("Berkas audio sesi belum tersedia.");
  }

  const token = await ambilValidAccessToken(userId);
  if (!token) {
    throw new Error("Akun Google Drive belum tersambung.");
  }

  const folderId = await pastikanFolderRuma(token);
  const namaFile = `Rekaman - ${judulSesi} (${tanggal}).mp3`;

  // Unduh audio ke scratchpad sementara untuk membaca ukuran file dan stream
  const tmpDir = path.join(os.tmpdir(), "ruma-drive-upload");
  const localFile = await audioStorage.pastikanLokal(sesi.audioPath, tmpDir);

  try {
    const ukuran = (await stat(localFile)).size;

    // 1. Inisialisasi Resumable Upload
    const initRes = await fetch(DRIVE_UPLOAD_INIT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "audio/mpeg",
        "X-Upload-Content-Length": String(ukuran),
      },
      body: JSON.stringify({
        name: namaFile,
        description: `Rekaman audio rapat "${judulSesi}" yang direkam melalui ruma. (Al Akhyar Meeting Companion)`,
        parents: folderId ? [folderId] : undefined,
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`Gagal inisialisasi upload Drive: ${err}`);
    }

    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl) {
      throw new Error("Google Drive tidak mengembalikan URL upload resumable.");
    }

    // 2. Unggah data audio biner
    const fileBuffer = await readFile(localFile);
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(ukuran),
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Gagal mengunggah biner audio ke Drive: ${err}`);
    }

    const data = (await uploadRes.json()) as { id: string; webViewLink?: string };
    const fileId = data.id;
    const url = data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    // 3. Bagikan ke peserta rapat
    if (pesertaUndangan && pesertaUndangan.length > 0) {
      const emails = [...new Set(pesertaUndangan.map((p) => p.email.toLowerCase()).filter(Boolean))];
      await bagikanKePeserta(token, fileId, emails, `[Audio] ${judulSesi}`);
    }

    return { fileId, url };
  } finally {
    // Bersihkan file sementara
    await rm(localFile, { force: true }).catch(() => undefined);
  }
}
```

- [ ] **Step 3: Uji typecheck modul integrasi audio**

Run:
```bash
pnpm --filter @kalam/api typecheck
```
Expected: Lulus tanpa error.

- [ ] **Step 4: Commit modul Google Drive Audio**

```bash
git add apps/api/src/integrasi/google-docs.ts apps/api/src/integrasi/google-drive-audio.ts
git commit -m "feat(integrasi): tambahkan modul unggah audio ke Google Drive resumable API"
```

---

### Task 7: Endpoint API Sinkronisasi Audio ke Google Drive

**Files:**
- Modify: `apps/api/src/routes/hasil.ts:160-220`

**Interfaces:**
- Consumes: `unggahAudioKeGoogleDrive`, `dokumen.googleDriveAudioUrl`, `userTokens`
- Produces: 
  - `POST /sesi/:uuid/audio/drive/ekspor` untuk ekspor audio tersendiri
  - Opsi `sertakanAudio` pada `POST /sesi/:uuid/dokumen/google-docs/ekspor`
  - Field `googleDriveAudioUrl` pada `GET /sesi/:uuid/dokumen/google-docs/status`

- [ ] **Step 1: Perbarui endpoint status Google Docs/Drive di `hasil.ts`**

Tambahkan `googleDriveAudioUrl` pada response `GET /:uuid/dokumen/google-docs/status`:
```typescript
    return c.json({
      driveTersambung,
      urlAuth: driveTersambung ? null : urlOAuthDrive(`sesi_${s.uuid}`),
      googleDocsUrl: d?.googleDocsUrl ?? null,
      googleDriveAudioUrl: d?.googleDriveAudioUrl ?? null,
    });
```

- [ ] **Step 2: Tambahkan endpoint `POST /:uuid/audio/drive/ekspor`**

```typescript
  // Ekspor rekaman audio ke folder ruma. Notulen di Google Drive
  .post("/:uuid/audio/drive/ekspor", zValidator("param", uuidParam), async (c) => {
    const user = c.var.user;
    const s = await findOwn(user, c.req.valid("param").uuid);
    if (!s) return c.json({ error: "not_found" }, 404);
    if (!s.audioPath) return c.json({ error: "audio_belum_siap" }, 400);

    const [d] = await db.select().from(dokumen).where(eq(dokumen.sesiId, s.id)).limit(1);
    const tanggal = s.createdAt.toISOString().slice(0, 10);
    const pesertaUndangan = await daftarPesertaDariUndangan(s.id);

    try {
      const hasil = await unggahAudioKeGoogleDrive(
        user.id,
        s,
        s.judul,
        tanggal,
        pesertaUndangan
      );

      if (d) {
        await db
          .update(dokumen)
          .set({
            googleDriveAudioFileId: hasil.fileId,
            googleDriveAudioUrl: hasil.url,
          })
          .where(eq(dokumen.id, d.id));
      }

      return c.json({ ok: true, fileId: hasil.fileId, url: hasil.url });
    } catch (e: any) {
      return c.json({ error: "gagal_ekspor_audio", pesan: e.message }, 500);
    }
  })
```

- [ ] **Step 3: Hubungkan opsi `sertakanAudio` di `POST /:uuid/dokumen/google-docs/ekspor`**

Terima payload opsional `{ sertakanAudio?: boolean }`:
Jika `sertakanAudio === true` dan `s.audioPath` ada, jalankan `unggahAudioKeGoogleDrive` secara paralel/berurutan dan simpan tautan ke tabel `dokumen`.

- [ ] **Step 4: Uji typecheck `hasil.ts`**

Run:
```bash
pnpm --filter @kalam/api typecheck
```
Expected: Lulus tanpa error.

- [ ] **Step 5: Commit endpoint sinkronisasi audio Drive**

```bash
git add apps/api/src/routes/hasil.ts
git commit -m "feat(api): tambahkan endpoint ekspor audio ke Google Drive dan sertakan link di status"
```

---

### Task 8: Antarmuka Pengguna (UI Web): Switch Audio di Modal & Tautan Audio Drive

**Files:**
- Modify: `apps/web/src/features/sesi/setujui-dokumen.tsx`
- Modify: `apps/web/src/features/sesi/tombol-google-docs.tsx`
- Modify: `apps/web/src/features/sesi/pemutar.tsx`

**Interfaces:**
- Consumes: `api.sesi[":uuid"].dokumen["google-docs"].status`, `googleDriveAudioUrl`
- Produces: Switch simpan audio di modal persetujuan, tombol "Buka Audio di Drive", dan penanganan tampilan audio kedaluwarsa 90 hari.

- [ ] **Step 1: Tambahkan opsi simpan audio di `setujui-dokumen.tsx`**

Tambahkan state dan switch baru di dalam dialog persetujuan dokumen:
```tsx
const [simpanAudioDrive, setSimpanAudioDrive] = useState(true);
```
Tampilkan di bawah switch simpan Docs:
```tsx
<div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
  <div className="space-y-0.5">
    <Label htmlFor="switch-audio-drive" className="text-sm font-medium">
      Simpan rekaman audio ke Drive
    </Label>
    <p className="text-xs text-muted-foreground">
      Salinan berkas MP3 disimpan permanen di folder 'ruma. Notulen' (aman meski retensi 90 hari habis).
    </p>
  </div>
  <Switch
    id="switch-audio-drive"
    checked={simpanAudioDrive && me.driveTersambung}
    disabled={!me.driveTersambung || setujui.isPending}
    onCheckedChange={setSimpanAudioDrive}
  />
</div>
```

- [ ] **Step 2: Perbarui `tombol-google-docs.tsx` untuk menampilkan tautan Audio Drive**

Jika `data.googleDriveAudioUrl` tersedia, tampilkan tombol tautan audio berdampingan:
```tsx
{data.googleDriveAudioUrl && (
  <Button
    variant="outline"
    size="sm"
    asChild
    className="gap-1.5 text-xs"
  >
    <a href={data.googleDriveAudioUrl} target="_blank" rel="noopener noreferrer">
      <MusicIcon className="size-3.5" />
      <span>Audio di Drive</span>
      <ExternalLinkIcon className="size-3 opacity-60" />
    </a>
  </Button>
)}
```

- [ ] **Step 3: Tangani status audio kedaluwarsa (410) di `pemutar.tsx`**

Jika pemutar menerima error 410 / audio kedaluwarsa:
Tampilkan banner informatif:
```tsx
<div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground flex items-center justify-between gap-3">
  <div className="flex items-center gap-2">
    <ClockAlertIcon className="size-4 shrink-0 text-amber-500" />
    <span>Audio asli telah kedaluwarsa sesuai kebijakan retensi 90 hari.</span>
  </div>
  {googleDriveAudioUrl && (
    <Button size="xs" variant="secondary" asChild>
      <a href={googleDriveAudioUrl} target="_blank" rel="noopener noreferrer">
        Buka di Drive
      </a>
    </Button>
  )}
</div>
```

- [ ] **Step 4: Uji typecheck web**

Run:
```bash
pnpm --filter @kalam/web typecheck
```
Expected: Lulus tanpa error.

- [ ] **Step 5: Commit perubahan antarmuka**

```bash
git add apps/web/src/features/sesi/
git commit -m "feat(web): tambahkan switch simpan audio di modal persetujuan dan tautan audio drive di pemutar"
```

---

### Task 9: Verifikasi, Lifecycle Bucket R2, dan Pembaruan Dokumentasi

**Files:**
- Modify: `docs/roadmap-todo.md`
- Modify: `ARCHITECTURE.md`
- Create: Skrip helper / dokumentasi setting Lifecycle Rule Cloudflare R2 di `docs/panduan-r2-retensi-90-hari.md`

**Interfaces:**
- Consumes: Arsitektur Cloudflare R2 & Google Drive
- Produces: Dokumentasi lengkap konfigurasi Cloudflare R2 dashboard/CLI dan checklist roadmap yang terverifikasi.

- [ ] **Step 1: Tulis panduan konfigurasi lifecycle rule Cloudflare R2**

Tulis berkas `docs/panduan-r2-retensi-90-hari.md`:
Jelaskan cara setting aturan lifecycle rule 90 hari di Cloudflare Dashboard:
1. Buka Cloudflare Dashboard -> **R2 Object Storage**.
2. Pilih bucket `ruma-audio-prod`.
3. Buka tab **Settings** -> bagian **Object Lifecycle Rules**.
4. Klik **Add Rule**:
   - Rule Name: `retensi-audio-90-hari`
   - Target: All objects (prefix kosong)
   - Action: **Delete object**
   - Object age: **90 days**
5. Klik **Save Rule**.

- [ ] **Step 2: Perbarui `ARCHITECTURE.md` dan `docs/roadmap-todo.md`**

Catat perubahan arsitektur:
- Audio aktif disimpan di Cloudflare R2 dengan retensi 90 hari (zero disk VPS, zero egress fee).
- Salinan audio permanen disimpan di Google Drive pengguna (`"ruma. Notulen"`).

- [ ] **Step 3: Jalankan full typecheck & build**

Run:
```bash
pnpm run build
```
Expected: Seluruh paket (`@kalam/api` dan `@kalam/web`) berhasil di-build tanpa error.

- [ ] **Step 4: Commit dokumentasi**

```bash
git add docs/ ARCHITECTURE.md
git commit -m "docs: tambahkan panduan konfigurasi retensi 90 hari R2 dan perbarui arsitektur audio"
```
