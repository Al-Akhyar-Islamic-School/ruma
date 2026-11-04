import type { KonfigurasiEkstensi } from "../types";

export const DEFAULT_CONFIG: KonfigurasiEkstensi = {
  rumaUrl: "http://localhost:5173",
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

/**
 * Mengambil token autentikasi aktif.
 * Prioritas:
 * 1. Token eksplisit yang disimpan di opsi ekstensi.
 * 2. Cookie `ruma_session` dari domain rumaUrl.
 */
export async function ambilTokenAutentikasi(rumaUrl: string): Promise<string | null> {
  const cfg = await muatKonfigurasi();
  if (cfg.authToken && cfg.authToken.trim()) {
    return cfg.authToken.trim();
  }

  try {
    const urlObj = new URL(rumaUrl);
    const cookie = await chrome.cookies.get({
      url: urlObj.origin,
      name: "ruma_session",
    });
    if (cookie?.value) {
      return cookie.value;
    }
  } catch (err) {
    console.warn("Gagal membaca cookie ruma_session:", err);
  }

  return null;
}
