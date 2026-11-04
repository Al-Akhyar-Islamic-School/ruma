import { readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ambilValidAccessToken } from "./google-auth.js";
import { bagikanKePeserta, pastikanFolderRuma } from "./google-docs.js";
import { audioStorage } from "../storage.js";

const DRIVE_UPLOAD_INIT =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink";

/**
 * Mengunggah berkas audio sesi (playback.mp3) ke folder 'ruma. Notulen' di Google Drive pengguna.
 * Menggunakan protokol Google Drive Resumable Upload untuk keandalan berkas audio biner.
 */
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
    throw new Error("Akun Google Drive belum tersambung. Hubungkan Google Drive terlebih dahulu.");
  }

  const folderId = await pastikanFolderRuma(token);
  const namaFile = `Rekaman - ${judulSesi} (${tanggal}).mp3`;

  // Unduh audio ke scratchpad sementara untuk membaca ukuran file dan mengirim data
  const tmpDir = path.join(os.tmpdir(), "ruma-drive-upload", sesi.uuid);
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
      throw new Error(`Gagal inisialisasi upload Google Drive: ${err}`);
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

    // 3. Bagikan ke peserta rapat bila ada
    if (pesertaUndangan && pesertaUndangan.length > 0) {
      const emails = [...new Set(pesertaUndangan.map((p) => p.email.toLowerCase()).filter(Boolean))];
      await bagikanKePeserta(token, fileId, emails, `[Audio] ${judulSesi}`);
    }

    return { fileId, url };
  } finally {
    // Bersihkan file scratchpad sementara jika menggunakan scratchpad lokal R2
    if (audioStorage.isR2) {
      await rm(localFile, { force: true }).catch(() => undefined);
      await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
