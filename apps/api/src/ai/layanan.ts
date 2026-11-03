/** Galat dari layanan eksternal (Cloudflare/Gemini): pesan sudah dipangkas, aman disimpan di `sesi.galat`. */
export class GalatLayanan extends Error {
  constructor(
    pesan: string,
    /** Status HTTP bila galat berasal dari respons layanan. */
    readonly status?: number,
  ) {
    super(pesan);
  }
}

/**
 * Kuota atau batas laju layanan habis. Bukan kegagalan sesi: pemrosesan ditunda sampai `pulihPada`
 * tanpa menghabiskan jatah percobaan.
 */
export class GalatKuota extends GalatLayanan {
  constructor(
    pesan: string,
    readonly pulihPada: Date,
    status?: number,
  ) {
    super(pesan, status);
  }
}

/** Galat yang tidak akan sembuh dengan mengulang (mis. audio sunyi): sesi langsung `gagal`, tanpa percobaan ulang. */
export class GalatPermanen extends Error {}

export async function panggilJson(nama: string, url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new GalatLayanan(`${nama}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const body = await res.text();
  if (!res.ok) throw new GalatLayanan(`${nama} HTTP ${res.status}: ${body.slice(0, 300)}`, res.status);
  try {
    return JSON.parse(body);
  } catch {
    throw new GalatLayanan(`${nama}: respons bukan JSON: ${body.slice(0, 200)}`, res.status);
  }
}
