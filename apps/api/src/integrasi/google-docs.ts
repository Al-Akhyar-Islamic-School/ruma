import { ambilValidAccessToken } from "./google-auth.js";
import { susunStrukturDokumen } from "./renderer-notulen.js";
import { susunFormatBatchUpdate } from "./google-docs-format.js";

const DOCS_BASE = "https://docs.googleapis.com/v1/documents";
const DRIVE_BASE = "https://www.googleapis.com/drive/v3/files";
const NAMA_FOLDER_DEFAULT = "ruma. Notulen";

export type DataNotulen = {
  judul_notulen?: string;
  tanggal?: string;
  tempat?: string;
  pemimpin_rapat?: string;
  peserta_terdeteksi?: string[];
  ringkasan_eksekutif?: string;
  agenda_dan_keputusan?: { agenda: string; pembahasan?: string; keputusan: string }[];
  action_items?: { tugas: string; pic?: string; tenggat_waktu?: string | null; status?: string }[];
};

/** Mencari atau membuat folder khusus ruma. Notulen di Google Drive pengguna */
export async function pastikanFolderRuma(token: string): Promise<string | null> {
  try {
    const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${NAMA_FOLDER_DEFAULT}' and trashed = false`;
    const resList = await fetch(`${DRIVE_BASE}?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resList.ok) {
      const data = (await resList.json()) as { files: { id: string; name: string }[] };
      if (data.files && data.files.length > 0) {
        return data.files[0]!.id;
      }
    }

    const resCreate = await fetch(DRIVE_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: NAMA_FOLDER_DEFAULT,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    if (resCreate.ok) {
      const folder = (await resCreate.json()) as { id: string };
      return folder.id;
    }
  } catch {
    // Non-blocking
  }
  return null;
}

async function pindahkanKeFolder(token: string, fileId: string, folderId: string): Promise<void> {
  try {
    await fetch(`${DRIVE_BASE}/${fileId}?addParents=${folderId}&fields=id,parents`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Non-blocking
  }
}

/** Bagikan berkas Google Docs (role: reader) ke email peserta yang diundang + kirim notifikasi email */
export async function bagikanKePeserta(
  token: string,
  fileId: string,
  emailList: string[],
  judulRapat: string,
  pengirimNama?: string
): Promise<void> {
  const pesanEmail = `Assalamu'alaikum Wr. Wb.\n\nNotulensi resmi untuk rapat "${judulRapat}" telah disetujui${pengirimNama ? ` oleh ${pengirimNama}` : ""} dan dibagikan kepada Anda melalui Google Docs.\n\nDisusun otomatis dan dikirim melalui ruma. (Al Akhyar Meeting Companion).`;

  for (const email of emailList) {
    try {
      const url = `${DRIVE_BASE}/${fileId}/permissions?sendNotificationEmail=true&emailMessage=${encodeURIComponent(pesanEmail)}`;
      await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "reader",
          type: "user",
          emailAddress: email,
        }),
      });
    } catch {
      // Non-blocking per email
    }
  }
}

export async function eksporKeGoogleDocs(
  userId: number,
  judulSesi: string,
  payload: DataNotulen,
  existingFileId?: string | null,
  pesertaUndangan?: { nama: string; email: string }[],
  options?: { isAppend?: boolean; namaSeri?: string }
): Promise<{ fileId: string; url: string }> {
  const token = await ambilValidAccessToken(userId);
  if (!token) {
    throw new Error("Akun Google Drive belum tersambung. Hubungkan Drive terlebih dahulu.");
  }

  const tanggal = payload.tanggal || new Date().toISOString().slice(0, 10);
  const judulDokumen = options?.namaSeri ? `Notulen Seri - ${options.namaSeri}` : `Notulen - ${judulSesi} (${tanggal})`;

  let fileId = existingFileId;
  let startOffset = 1;
  let shouldInsertPageBreak = false;

  // 1. Dapatkan atau buat dokumen baru
  if (fileId) {
    // Cek apakah dokumen lama masih ada dan bisa diakses
    const resCek = await fetch(`${DOCS_BASE}/${fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resCek.ok) {
      fileId = null;
    } else {
      const docObj = (await resCek.json()) as { body?: { content?: { endIndex?: number }[] } };
      const content = docObj.body?.content || [];
      const lastElement = content[content.length - 1];
      const endIndex = (lastElement?.endIndex ?? 1) - 1;

      if (options?.isAppend) {
        // Mode Rekursif (Serial): Sambung di akhir dokumen dengan Page Break
        startOffset = Math.max(1, endIndex);
        shouldInsertPageBreak = startOffset > 1;
      } else {
        // Mode Standar (Sesi Tunggal): Idempotent overwrite konten lama
        if (endIndex > 1) {
          await fetch(`${DOCS_BASE}/${fileId}:batchUpdate`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              requests: [{ deleteContentRange: { range: { startIndex: 1, endIndex } } }],
            }),
          });
        }
        startOffset = 1;
      }
    }
  }


  if (!fileId) {
    const resCreate = await fetch(DOCS_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: judulDokumen }),
    });

    if (!resCreate.ok) {
      const err = await resCreate.text();
      throw new Error(`Gagal membuat dokumen Google Docs: ${err}`);
    }

    const doc = (await resCreate.json()) as { documentId: string };
    fileId = doc.documentId;

    const folderId = await pastikanFolderRuma(token);
    if (folderId) {
      await pindahkanKeFolder(token, fileId, folderId);
    }
  }

  // 2. Jika mode append, masukkan Page Break di awal sebelum menambahkan konten sesi baru
  if (shouldInsertPageBreak) {
    await fetch(`${DOCS_BASE}/${fileId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ insertPageBreak: { location: { index: startOffset } } }],
      }),
    });
    startOffset += 1;
  }

  // 3. Susun dokumen terstruktur via renderer-notulen
  const rendered = susunStrukturDokumen(judulSesi, payload, pesertaUndangan);
  // 4. Susun batchUpdate formatting via google-docs-format
  const { requests } = susunFormatBatchUpdate(rendered, startOffset);

  // 5. Eksekusi batchUpdate
  const resUpdate = await fetch(`${DOCS_BASE}/${fileId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });

  if (!resUpdate.ok) {
    const err = await resUpdate.text();
    throw new Error(`Gagal memformat dokumen Google Docs resmi: ${err}`);
  }
  // 5. Bagikan berkas Docs ke seluruh email peserta undangan (role reader) + kirim notifikasi email Google Drive
  if (pesertaUndangan && pesertaUndangan.length > 0) {
    const emailList = [...new Set(pesertaUndangan.map((p) => p.email.toLowerCase()).filter(Boolean))];
    await bagikanKePeserta(token, fileId, emailList, judulSesi);
  }

  const url = `https://docs.google.com/document/d/${fileId}/edit`;
  return { fileId, url };
}
