import type { KonfigurasiEkstensi } from "../types";

export const DEFAULT_CONFIG: KonfigurasiEkstensi = {
  rumaUrl: "https://ruma.alakhyar.sch.id",
  sertakanMic: true,
  kategoriDefault: "tanpa",
};

export async function muatKonfigurasi(): Promise<KonfigurasiEkstensi> {
  try {
    const data = await chrome.storage.sync.get(["rumaUrl", "sertakanMic", "kategoriDefault", "authToken"]);
    return {
      rumaUrl: (data.rumaUrl as string) || DEFAULT_CONFIG.rumaUrl,
      sertakanMic: data.sertakanMic !== undefined ? Boolean(data.sertakanMic) : DEFAULT_CONFIG.sertakanMic,
      kategoriDefault: (data.kategoriDefault as string) || DEFAULT_CONFIG.kategoriDefault,
      authToken: (data.authToken as string) || undefined,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function simpanKonfigurasi(baru: Partial<KonfigurasiEkstensi>): Promise<void> {
  await chrome.storage.sync.set(baru);
}

export type HasilAutentikasi = {
  token: string;
  activeUrl: string;
};

/**
 * Mengambil token autentikasi aktif.
 * Prioritas:
 * 1. Token eksplisit yang disimpan di opsi ekstensi.
 * 2. Cookie `ruma_session` dari domain rumaUrl.
 * 3. Fallback: domain produksi ruma.alakhyar.sch.id dan localhost.
 */
export async function ambilTokenAutentikasi(
  rumaUrl: string
): Promise<HasilAutentikasi | null> {
  const cfg = await muatKonfigurasi();
  if (cfg.authToken && cfg.authToken.trim()) {
    return { token: cfg.authToken.trim(), activeUrl: rumaUrl };
  }

  const kandidatUrl = [
    rumaUrl,
    "https://ruma.alakhyar.sch.id",
    "http://localhost:5173",
  ];

  const uniqueUrls = [...new Set(kandidatUrl.map((u) => u.trim().replace(/\/+$/, "")))];

  for (const targetUrl of uniqueUrls) {
    try {
      const urlObj = new URL(targetUrl);
      const cookie = await chrome.cookies.get({
        url: urlObj.origin,
        name: "ruma_session",
      });
      if (cookie?.value) {
        return { token: cookie.value, activeUrl: targetUrl };
      }
    } catch {
      // Coba kandidat berikutnya
    }
  }

  return null;
}
