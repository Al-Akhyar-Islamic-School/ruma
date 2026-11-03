import { ambilValidAccessToken } from "./google-auth.js";

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
async function pastikanFolderRuma(token: string): Promise<string | null> {
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

interface StylableRange {
  start: number;
  end: number;
  type: "TITLE" | "SUBTITLE" | "HEADING_1" | "HEADING_2" | "BOLD" | "ITALIC";
}

export async function eksporKeGoogleDocs(
  userId: number,
  judulSesi: string,
  payload: DataNotulen,
  existingFileId?: string | null
): Promise<{ fileId: string; url: string }> {
  const token = await ambilValidAccessToken(userId);
  if (!token) {
    throw new Error("Akun Google Drive belum tersambung. Hubungkan Drive terlebih dahulu.");
  }

  const tanggal = payload.tanggal || new Date().toISOString().slice(0, 10);
  const judulDokumen = `Notulen - ${judulSesi} (${tanggal})`;

  let fileId = existingFileId;

  // 1. Buat dokumen jika belum ada
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
  } else {
    // Jika dokumen sudah ada, bersihkan konten lama sebelum diisi ulang
    try {
      const resGet = await fetch(`${DOCS_BASE}/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resGet.ok) {
        const docObj = (await resGet.json()) as { body?: { content?: { endIndex?: number }[] } };
        const content = docObj.body?.content || [];
        const lastElement = content[content.length - 1];
        const endIndex = (lastElement?.endIndex ?? 1) - 1;
        if (endIndex > 1) {
          await fetch(`${DOCS_BASE}/${fileId}:batchUpdate`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              requests: [{ deleteContentRange: { range: { startIndex: 1, endIndex } } }],
            }),
          });
        }
      }
    } catch {
      // Jika pembersihan gagal, tetap lanjutkan
    }
  }

  // 2. Bangun teks beserta penanda styling
  let buffer = "";
  const styles: StylableRange[] = [];

  function tambahTeks(teks: string, style?: StylableRange["type"]) {
    const startIndex = 1 + buffer.length;
    buffer += teks;
    const endIndex = 1 + buffer.length;
    if (style) {
      styles.push({ start: startIndex, end: endIndex, type: style });
    }
  }

  // Header Dokumen
  tambahTeks("SEKOLAH ISLAM AL AKHYAR\n", "TITLE");
  tambahTeks("NOTULENSI RAPAT RESMI\n", "SUBTITLE");
  tambahTeks("\n");

  // Metadata Rapat
  tambahTeks("INFORMASI RAPAT\n", "HEADING_2");
  tambahTeks("Judul Sesi: ", "BOLD");
  tambahTeks(`${judulSesi}\n`);
  tambahTeks("Tanggal: ", "BOLD");
  tambahTeks(`${tanggal}\n`);
  if (payload.tempat) {
    tambahTeks("Tempat: ", "BOLD");
    tambahTeks(`${payload.tempat}\n`);
  }
  if (payload.pemimpin_rapat) {
    tambahTeks("Pemimpin Rapat: ", "BOLD");
    tambahTeks(`${payload.pemimpin_rapat}\n`);
  }
  if (payload.peserta_terdeteksi?.length) {
    tambahTeks("Peserta Hadir: ", "BOLD");
    tambahTeks(`${payload.peserta_terdeteksi.join(", ")}\n`);
  }
  tambahTeks("\n");

  // Ringkasan Eksekutif
  if (payload.ringkasan_eksekutif) {
    tambahTeks("RINGKASAN EKSEKUTIF\n", "HEADING_1");
    tambahTeks(`${payload.ringkasan_eksekutif}\n\n`);
  }

  // Agenda & Keputusan
  if (payload.agenda_dan_keputusan?.length) {
    tambahTeks("AGENDA & KEPUTUSAN\n", "HEADING_1");
    payload.agenda_dan_keputusan.forEach((item, idx) => {
      tambahTeks(`${idx + 1}. Agenda: `, "BOLD");
      tambahTeks(`${item.agenda}\n`);
      if (item.pembahasan) {
        tambahTeks("   Pembahasan: ", "BOLD");
        tambahTeks(`${item.pembahasan}\n`);
      }
      tambahTeks("   Keputusan: ", "BOLD");
      tambahTeks(`${item.keputusan}\n\n`);
    });
  }

  // Action Items / Tindak Lanjut
  if (payload.action_items?.length) {
    tambahTeks("MATRIKS TINDAK LANJUT (ACTION ITEMS)\n", "HEADING_1");
    payload.action_items.forEach((task, idx) => {
      tambahTeks(`[ ] ${idx + 1}. `, "BOLD");
      tambahTeks(task.tugas);
      if (task.pic) {
        tambahTeks(`  (PIC: ${task.pic})`, "ITALIC");
      }
      if (task.tenggat_waktu) {
        tambahTeks(` — Tenggat: ${task.tenggat_waktu}`, "BOLD");
      }
      tambahTeks("\n");
    });
    tambahTeks("\n");
  }

  tambahTeks("Disusun otomatis oleh ruma. — Your AI Meeting Companion\n", "ITALIC");

  // 3. Susun permintaan batchUpdate: Insert Teks duluan, lalu berikan Typography & Styling
  const requests: Record<string, unknown>[] = [
    {
      insertText: {
        location: { index: 1 },
        text: buffer,
      },
    },
  ];

  // Tambahkan formatting typography
  for (const s of styles) {
    if (s.type === "TITLE") {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: s.start, endIndex: s.end },
          paragraphStyle: {
            namedStyleType: "TITLE",
            alignment: "CENTER",
            spaceBelow: { magnitude: 4, unit: "PT" },
          },
          fields: "namedStyleType,alignment,spaceBelow",
        },
      });
      requests.push({
        updateTextStyle: {
          range: { startIndex: s.start, endIndex: s.end - 1 },
          textStyle: {
            bold: true,
            foregroundColor: { color: { rgbColor: { red: 0.08, green: 0.24, blue: 0.21 } } }, // Forest green ruma.
          },
          fields: "bold,foregroundColor",
        },
      });
    } else if (s.type === "SUBTITLE") {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: s.start, endIndex: s.end },
          paragraphStyle: {
            namedStyleType: "SUBTITLE",
            alignment: "CENTER",
            spaceBelow: { magnitude: 16, unit: "PT" },
          },
          fields: "namedStyleType,alignment,spaceBelow",
        },
      });
    } else if (s.type === "HEADING_1") {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: s.start, endIndex: s.end },
          paragraphStyle: {
            namedStyleType: "HEADING_1",
            spaceAbove: { magnitude: 12, unit: "PT" },
            spaceBelow: { magnitude: 6, unit: "PT" },
          },
          fields: "namedStyleType,spaceAbove,spaceBelow",
        },
      });
      requests.push({
        updateTextStyle: {
          range: { startIndex: s.start, endIndex: s.end - 1 },
          textStyle: {
            bold: true,
            foregroundColor: { color: { rgbColor: { red: 0.08, green: 0.24, blue: 0.21 } } },
          },
          fields: "bold,foregroundColor",
        },
      });
    } else if (s.type === "HEADING_2") {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: s.start, endIndex: s.end },
          paragraphStyle: {
            namedStyleType: "HEADING_2",
            spaceBelow: { magnitude: 4, unit: "PT" },
          },
          fields: "namedStyleType,spaceBelow",
        },
      });
    } else if (s.type === "BOLD") {
      requests.push({
        updateTextStyle: {
          range: { startIndex: s.start, endIndex: s.end },
          textStyle: { bold: true },
          fields: "bold",
        },
      });
    } else if (s.type === "ITALIC") {
      requests.push({
        updateTextStyle: {
          range: { startIndex: s.start, endIndex: s.end },
          textStyle: { italic: true },
          fields: "italic",
        },
      });
    }
  }

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
    throw new Error(`Gagal memformat dokumen Google Docs: ${err}`);
  }

  const url = `https://docs.google.com/document/d/${fileId}/edit`;
  return { fileId, url };
}
