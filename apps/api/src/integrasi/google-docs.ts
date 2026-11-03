import { ambilValidAccessToken } from "./google-auth.js";

const DOCS_BASE = "https://docs.googleapis.com/v1/documents";
const DRIVE_BASE = "https://www.googleapis.com/drive/v3/files";

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

  // 1. Jika belum ada dokumen yang dibuat, buat dokumen baru via Google Docs API
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
  }

  // 2. Susun teks konten berformat resmi Al Akhyar
  const baris: string[] = [];
  baris.push("SEKOLAH ISLAM AL AKHYAR");
  baris.push("NOTULENSI RAPAT RESMI");
  baris.push("================================================================================");
  baris.push(`Judul Sesi     : ${judulSesi}`);
  baris.push(`Tanggal Rapat  : ${tanggal}`);
  if (payload.tempat) baris.push(`Tempat         : ${payload.tempat}`);
  if (payload.pemimpin_rapat) baris.push(`Pemimpin Rapat : ${payload.pemimpin_rapat}`);
  if (payload.peserta_terdeteksi?.length) {
    baris.push(`Peserta Hadir  : ${payload.peserta_terdeteksi.join(", ")}`);
  }
  baris.push("--------------------------------------------------------------------------------\n");

  if (payload.ringkasan_eksekutif) {
    baris.push("RINGKASAN EKSEKUTIF");
    baris.push(payload.ringkasan_eksekutif);
    baris.push("\n");
  }

  if (payload.agenda_dan_keputusan?.length) {
    baris.push("AGENDA & KEPUTUSAN");
    payload.agenda_dan_keputusan.forEach((item, idx) => {
      baris.push(`${idx + 1}. Agenda: ${item.agenda}`);
      if (item.pembahasan) baris.push(`   Pembahasan : ${item.pembahasan}`);
      baris.push(`   Keputusan  : ${item.keputusan}`);
    });
    baris.push("\n");
  }

  if (payload.action_items?.length) {
    baris.push("MATRIKS TINDAK LANJUT (ACTION ITEMS)");
    payload.action_items.forEach((task, idx) => {
      const pic = task.pic ? ` [PIC: ${task.pic}]` : "";
      const tenggat = task.tenggat_waktu ? ` (Tenggat: ${task.tenggat_waktu})` : "";
      baris.push(`[ ] ${idx + 1}. ${task.tugas}${pic}${tenggat}`);
    });
    baris.push("\n");
  }

  baris.push("================================================================================");
  baris.push("Disusun otomatis oleh ruma. - Your AI Meeting Companion");
  baris.push("\n\n");

  const isiTeks = baris.join("\n");

  // 3. Masukkan teks ke dalam Google Docs via batchUpdate (insertText pada index 1)
  const resUpdate = await fetch(`${DOCS_BASE}/${fileId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: isiTeks,
          },
        },
      ],
    }),
  });

  if (!resUpdate.ok) {
    const err = await resUpdate.text();
    throw new Error(`Gagal mengisi konten Google Docs: ${err}`);
  }

  const url = `https://docs.google.com/document/d/${fileId}/edit`;
  return { fileId, url };
}
