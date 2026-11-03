import { GalatLayanan } from "./layanan.js";

/**
 * Membersihkan karakter kontrol literal (raw unescaped newlines/tabs di dalam string literal)
 * yang sering dihasilkan model LLM dan memicu "Bad control character in string literal".
 */
export function bersihkanKarakterKontrol(jsonStr: string): string {
  let inString = false;
  let escaped = false;
  let hasil = "";

  for (let i = 0; i < jsonStr.length; i++) {
    const c = jsonStr[i]!;

    if (escaped) {
      hasil += c;
      escaped = false;
      continue;
    }

    if (c === "\\") {
      hasil += c;
      escaped = true;
      continue;
    }

    if (c === '"') {
      inString = !inString;
      hasil += c;
      continue;
    }

    if (inString) {
      // Karakter kontrol di dalam string literal JSON harus di-escape
      if (c === "\n") {
        hasil += "\\n";
      } else if (c === "\r") {
        hasil += "\\r";
      } else if (c === "\t") {
        hasil += "\\t";
      } else if (c.charCodeAt(0) < 32) {
        // Abaikan karakter kontrol ASCII non-printable lainnya
      } else {
        hasil += c;
      }
    } else {
      hasil += c;
    }
  }

  return hasil;
}

/**
 * Model kadang membungkus JSON dengan ```json ... ``` atau kalimat pengantar; ambil objek terluar.
 * Tahan terhadap karakter kontrol mentah dan trailing commas.
 */
export function ekstrakJson(teksModel: string): unknown {
  const awal = teksModel.indexOf("{");
  const akhir = teksModel.lastIndexOf("}");
  if (awal < 0 || akhir <= awal) throw new GalatLayanan("jawaban model tidak berisi objek JSON");

  let sub = teksModel.slice(awal, akhir + 1);

  // 1. Coba parse langsung
  try {
    return JSON.parse(sub);
  } catch {
    // Lanjut ke perbaikan sanitasi
  }

  // 2. Bersihkan karakter kontrol di dalam string
  sub = bersihkanKarakterKontrol(sub);

  // 3. Bersihkan trailing commas sebelum } atau ]
  sub = sub.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(sub);
  } catch (e) {
    throw new GalatLayanan(`jawaban model bukan JSON valid: ${e instanceof Error ? e.message : e}`);
  }
}
