export type ProfilUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  bisaBuatSesiLangsung: boolean;
};

export type KategoriItem = {
  kode: string;
  label: string;
  deskripsi: string | null;
  tertutup: boolean;
};

function ekstraksiPesanGalat(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "error" in err && typeof err.error === "string") {
    return err.error;
  }
  return fallback;
}

export class RumaApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  private headers(contentType?: string): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    };
    if (contentType) {
      h["Content-Type"] = contentType;
    }
    return h;
  }

  async getMe(): Promise<ProfilUser> {
    const res = await fetch(`${this.baseUrl}/auth/me`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`Gagal autentikasi ruma. (status ${res.status})`);
    }
    const data: unknown = await res.json();
    return data as ProfilUser;
  }

  async getKategori(): Promise<KategoriItem[]> {
    try {
      const res = await fetch(`${this.baseUrl}/kategori`, {
        method: "GET",
        headers: this.headers(),
      });
      if (res.ok) {
        const data: unknown = await res.json();
        return Array.isArray(data) ? (data as KategoriItem[]) : [];
      }
    } catch {
      // Fallback bila kategori tidak tersedia
    }
    return [];
  }

  async buatSesi(params: {
    judul: string;
    mime: string;
    kodeMeet: string;
    kategori?: string;
  }): Promise<{ uuid: string }> {
    const meetUrl = `https://meet.google.com/${params.kodeMeet}`;
    const payload = {
      tipe_sesi: "rapat",
      judul: params.judul,
      audio_mime: params.mime,
      metadata: {
        kategori: params.kategori && params.kategori !== "tanpa" ? params.kategori : undefined,
        sumber: "google_meet_extension",
        googleMeetCode: params.kodeMeet,
        googleMeetUrl: meetUrl,
      },
    };

    const res = await fetch(`${this.baseUrl}/sesi`, {
      method: "POST",
      headers: this.headers("application/json"),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err: unknown = await res.json().catch(() => null);
      throw new Error(ekstraksiPesanGalat(err, `Gagal membuat sesi rapat (status ${res.status})`));
    }

    const data: unknown = await res.json();
    return data as { uuid: string };
  }

  async unggahChunk(uuid: string, seq: number, blob: Blob): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sesi/${uuid}/chunks/${seq}`, {
      method: "PUT",
      headers: this.headers("application/octet-stream"),
      body: blob,
    });

    if (!res.ok) {
      throw new Error(`Gagal mengunggah potongan audio ke-${seq} (status ${res.status})`);
    }
  }

  async selesaikanSesi(params: {
    uuid: string;
    jumlahChunk: number;
    durasiDetik: number;
    penandaDetik?: number[];
  }): Promise<{ uuid: string; status: string }> {
    const payload = {
      jumlah_chunk: params.jumlahChunk,
      durasi_detik: params.durasiDetik,
      penanda_detik: params.penandaDetik ?? [],
    };

    const res = await fetch(`${this.baseUrl}/sesi/${params.uuid}/finish`, {
      method: "POST",
      headers: this.headers("application/json"),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err: unknown = await res.json().catch(() => null);
      throw new Error(ekstraksiPesanGalat(err, `Gagal menyelesaikan sesi (status ${res.status})`));
    }

    const data: unknown = await res.json();
    return data as { uuid: string; status: string };
  }
}
