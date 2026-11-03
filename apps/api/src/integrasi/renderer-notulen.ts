import type { DataNotulen } from "./google-docs.js";

export interface TextRun {
  text: string;
  style?: {
    bold?: boolean;
    italic?: boolean;
    color?: { red: number; green: number; blue: number };
    fontSize?: number;
  };
}

export interface ParagraphBlock {
  type: "paragraph";
  namedStyle?: "NORMAL_TEXT" | "TITLE" | "SUBTITLE" | "HEADING_1" | "HEADING_2";
  alignment?: "START" | "CENTER" | "END" | "JUSTIFIED";
  spaceAbove?: number;
  spaceBelow?: number;
  indentStart?: number;
  backgroundColor?: { red: number; green: number; blue: number };
  borderLeft?: {
    color: { red: number; green: number; blue: number };
    width: number;
    dashStyle: "SOLID";
  };
  runs: TextRun[];
}

export interface RenderedNotulen {
  blocks: ParagraphBlock[];
}

// Palet warna resmi Al Akhyar
const COLOR_PRIMARY = { red: 0.082, green: 0.243, blue: 0.208 }; // #153E35 Forest green
const COLOR_SECONDARY = { red: 0.149, green: 0.463, blue: 0.325 }; // #267653
const COLOR_TEXT_PRIMARY = { red: 0.09, green: 0.137, blue: 0.118 }; // #17231E
const COLOR_TEXT_SECONDARY = { red: 0.408, green: 0.463, blue: 0.431 }; // #68766E
const COLOR_ACCENT_BG = { red: 0.933, green: 0.961, blue: 0.937 }; // #EEF5EF (Latar hijau lembut untuk keputusan)
const COLOR_LIME = { red: 0.722, green: 0.851, blue: 0.424 }; // #B8D96C

/**
 * Mengubah data notulen JSON menjadi struktur teks rapi berbasis daftar (list),
 * butir bullet, dan checkbox tanpa tabel yang membebani request/bandwidth.
 */
export function susunStrukturDokumen(
  judulSesi: string,
  payload: DataNotulen,
  pesertaUndangan?: { nama: string; email: string }[]
): RenderedNotulen {
  const blocks: ParagraphBlock[] = [];
  const tanggal = payload.tanggal || new Date().toISOString().slice(0, 10);

  // 1. Identitas & Kop Dokumen
  blocks.push({
    type: "paragraph",
    namedStyle: "TITLE",
    alignment: "CENTER",
    spaceBelow: 4,
    runs: [
      {
        text: "SEKOLAH ISLAM AL AKHYAR",
        style: { bold: true, fontSize: 12, color: COLOR_PRIMARY },
      },
    ],
  });

  blocks.push({
    type: "paragraph",
    namedStyle: "SUBTITLE",
    alignment: "CENTER",
    spaceAbove: 2,
    spaceBelow: 10,
    runs: [
      {
        text: "NOTULENSI RAPAT RESMI",
        style: { bold: true, fontSize: 16, color: COLOR_PRIMARY },
      },
    ],
  });

  // Garis aksen lime
  blocks.push({
    type: "paragraph",
    alignment: "CENTER",
    spaceBelow: 14,
    runs: [
      {
        text: "―".repeat(44),
        style: { bold: true, color: COLOR_LIME },
      },
    ],
  });

  // 2. Informasi Rapat (List Bullet Rapi)
  blocks.push({
    type: "paragraph",
    namedStyle: "HEADING_2",
    spaceBelow: 6,
    runs: [{ text: "INFORMASI RAPAT", style: { bold: true, fontSize: 11, color: COLOR_PRIMARY } }],
  });

  const infoList: { label: string; nilai: string }[] = [];
  infoList.push({ label: "Judul Sesi", nilai: judulSesi });
  infoList.push({ label: "Tanggal", nilai: tanggal });
  if (payload.tempat) infoList.push({ label: "Tempat", nilai: payload.tempat });
  if (payload.pemimpin_rapat) infoList.push({ label: "Pemimpin Rapat", nilai: payload.pemimpin_rapat });
  // Peserta Hadir: Ambil dari undangan jika ada, jika tidak ada baru gunakan hasil deteksi AI
  let pesertaTeks = "";
  if (pesertaUndangan && pesertaUndangan.length > 0) {
    pesertaTeks = pesertaUndangan.map((p) => p.nama).join(", ");
  } else if (payload.peserta_terdeteksi?.length) {
    pesertaTeks = payload.peserta_terdeteksi.join(", ");
  }
  if (pesertaTeks) {
    infoList.push({ label: "Peserta Hadir", nilai: pesertaTeks });
  }

  for (const item of infoList) {
    blocks.push({
      type: "paragraph",
      spaceBelow: 3,
      indentStart: 14,
      runs: [
        { text: "•  ", style: { bold: true, color: COLOR_SECONDARY } },
        { text: `${item.label}: `, style: { bold: true, color: COLOR_TEXT_SECONDARY } },
        { text: item.nilai, style: { color: COLOR_TEXT_PRIMARY } },
      ],
    });
  }

  // 3. Ringkasan Eksekutif
  if (payload.ringkasan_eksekutif?.trim()) {
    blocks.push({
      type: "paragraph",
      namedStyle: "HEADING_1",
      spaceAbove: 14,
      spaceBelow: 6,
      runs: [{ text: "RINGKASAN EKSEKUTIF", style: { bold: true, fontSize: 12, color: COLOR_PRIMARY } }],
    });

    const paragrafList = payload.ringkasan_eksekutif
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const p of paragrafList) {
      blocks.push({
        type: "paragraph",
        spaceBelow: 6,
        runs: [{ text: p, style: { fontSize: 11, color: COLOR_TEXT_PRIMARY } }],
      });
    }
  }

  // 4. Agenda & Keputusan
  if (payload.agenda_dan_keputusan && payload.agenda_dan_keputusan.length > 0) {
    blocks.push({
      type: "paragraph",
      namedStyle: "HEADING_1",
      spaceAbove: 16,
      spaceBelow: 8,
      runs: [{ text: "AGENDA DAN KEPUTUSAN", style: { bold: true, fontSize: 12, color: COLOR_PRIMARY } }],
    });

    payload.agenda_dan_keputusan.forEach((item, idx) => {
      const nomor = String(idx + 1).padStart(2, "0");

      // Judul Agenda
      blocks.push({
        type: "paragraph",
        spaceAbove: 8,
        spaceBelow: 4,
        runs: [
          {
            text: `${nomor}. ${item.agenda || `Agenda ${idx + 1}`}`,
            style: { bold: true, fontSize: 11, color: COLOR_PRIMARY },
          },
        ],
      });

      // Pembahasan
      if (item.pembahasan?.trim()) {
        blocks.push({
          type: "paragraph",
          spaceBelow: 2,
          indentStart: 18,
          runs: [
            { text: "Pembahasan: ", style: { bold: true, fontSize: 10, color: COLOR_TEXT_SECONDARY } },
            { text: item.pembahasan, style: { fontSize: 11, color: COLOR_TEXT_PRIMARY } },
          ],
        });
      }

      // Keputusan (dengan aksen latar hijau lembut & garis kiri)
      const teksKeputusan = item.keputusan?.trim() || "Belum ada keputusan final";
      blocks.push({
        type: "paragraph",
        spaceAbove: 2,
        spaceBelow: 10,
        indentStart: 18,
        backgroundColor: COLOR_ACCENT_BG,
        borderLeft: { color: COLOR_SECONDARY, width: 3, dashStyle: "SOLID" },
        runs: [
          { text: "✓ Keputusan: ", style: { bold: true, fontSize: 10, color: COLOR_SECONDARY } },
          { text: teksKeputusan, style: { bold: true, fontSize: 11, color: COLOR_PRIMARY } },
        ],
      });
    });
  }

  // 5. Tindak Lanjut (Action Items) — Checkbox List Format
  if (payload.action_items && payload.action_items.length > 0) {
    blocks.push({
      type: "paragraph",
      namedStyle: "HEADING_1",
      spaceAbove: 16,
      spaceBelow: 8,
      runs: [{ text: "TINDAK LANJUT (ACTION ITEMS)", style: { bold: true, fontSize: 12, color: COLOR_PRIMARY } }],
    });

    payload.action_items.forEach((task, idx) => {
      const pic = task.pic?.trim() ? ` — PIC: ${task.pic}` : "";
      const tenggat = task.tenggat_waktu?.trim() ? ` (Tenggat: ${task.tenggat_waktu})` : "";

      blocks.push({
        type: "paragraph",
        spaceBelow: 4,
        indentStart: 14,
        runs: [
          { text: "☐  ", style: { bold: true, fontSize: 12, color: COLOR_PRIMARY } },
          { text: `${idx + 1}. ${task.tugas}`, style: { bold: true, color: COLOR_TEXT_PRIMARY } },
          { text: pic, style: { italic: true, color: COLOR_SECONDARY } },
          { text: tenggat, style: { color: COLOR_TEXT_SECONDARY } },
        ],
      });
    });
  }

  // 6. Penutup Dokumen
  blocks.push({
    type: "paragraph",
    alignment: "CENTER",
    spaceAbove: 20,
    spaceBelow: 4,
    runs: [{ text: "―".repeat(44), style: { color: COLOR_TEXT_SECONDARY } }],
  });

  blocks.push({
    type: "paragraph",
    alignment: "CENTER",
    spaceBelow: 4,
    runs: [
      { text: "Status Dokumen: ", style: { fontSize: 9, color: COLOR_TEXT_SECONDARY } },
      { text: "Notulensi Rapat Resmi\n", style: { bold: true, fontSize: 9, color: COLOR_PRIMARY } },
      {
        text: `Dibuat otomatis oleh ruma. pada ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}`,
        style: { italic: true, fontSize: 8, color: COLOR_TEXT_SECONDARY },
      },
    ],
  });

  return { blocks };
}
