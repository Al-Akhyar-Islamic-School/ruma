import { env } from "../env.js";

export interface PesertaAgendaSimgtk {
  user_id: number;
  nama: string;
  email: string;
}

export interface AgendaRapatSimgtk {
  id: number;
  jenis: string;
  judul: string;
  tanggal: string;
  jam_mulai?: string | null;
  jam_selesai?: string | null;
  tempat?: string | null;
  mode?: "luring" | "daring" | string;
  tautan_daring?: string | null;
  status: string;
  unit?: string | null;
  notulen_ada: boolean;
  notulen_disahkan: boolean;
  boleh_sinkron: boolean;
  pesertas: PesertaAgendaSimgtk[];
}

export interface PayloadSinkronSimgtk {
  email: string;
  ringkasan: string;
  ruma_session_url: string;
  google_docs_url?: string | null;
  tindak_lanjut: {
    deskripsi: string;
    detail?: string | null;
    penanggung_jawab_email?: string | null;
    tenggat?: string | null;
  }[];
}

export interface HasilSinkronSimgtk {
  notulen_id: number;
  dibuat: number;
  diperbarui: number;
  sudah_dikirim: number;
  dilewati: { deskripsi: string; alasan: string }[];
  lengkap: boolean;
}

function simgtkHeaders(): HeadersInit {
  return {
    authorization: `Bearer ${env.SIMGTK_TOKEN}`,
    accept: "application/json",
    "content-type": "application/json",
  };
}

/**
 * 1. Ambil daftar agenda rapat untuk user yang sedang login (GET /api/integrasi/agenda-rapat?email=...&hari_ini=1)
 */
export async function ambilAgendaRapatSimgtk(emailUser: string): Promise<AgendaRapatSimgtk[]> {
  if (!env.SIMGTK_API_URL || !env.SIMGTK_TOKEN) return [];

  const hariIni = new Date();
  const tujuhHariLagi = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const dari = hariIni.toISOString().slice(0, 10);
  const sampai = tujuhHariLagi.toISOString().slice(0, 10);
  // Ambil agenda rapat dari hari ini sampai 7 hari ke depan agar rapat besok / lusa tetap terlihat
  const url = `${env.SIMGTK_API_URL}/integrasi/agenda-rapat?email=${encodeURIComponent(emailUser)}&dari=${dari}&sampai=${sampai}`;
  try {
    const res = await fetch(url, {
      headers: simgtkHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`SIMGTK agenda-rapat HTTP ${res.status}`);
      return [];
    }
    const json = (await res.json()) as { data?: AgendaRapatSimgtk[] };
    return json.data || [];
  } catch (e) {
    console.error("Gagal mengambil agenda rapat dari SIMGTK:", e);
    return [];
  }
}

/**
 * 2. Ambil detail satu agenda rapat berdasarkan ID atau ekstrak dari link URL SIMGTK (GET /api/integrasi/agenda-rapat/{id}?email=...)
 */
export async function ambilDetailAgendaSimgtk(
  idOrUrl: string | number,
  emailUser: string
): Promise<AgendaRapatSimgtk | null> {
  if (!env.SIMGTK_API_URL || !env.SIMGTK_TOKEN) return null;

  let id = String(idOrUrl).trim();
  // Ekstrak ID jika input berupa tautan (misal: https://simgtk.test/agenda/123/notulen)
  const match = id.match(/\/agenda\/(\d+)/);
  if (match && match[1]) {
    id = match[1];
  }

  if (!/^\d+$/.test(id)) return null;

  const url = `${env.SIMGTK_API_URL}/integrasi/agenda-rapat/${id}?email=${encodeURIComponent(emailUser)}`;
  try {
    const res = await fetch(url, {
      headers: simgtkHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Jika 404, bisa jadi ID tersebut adalah ID template rapat berulang (induk_agenda_id).
      // Coba cari rentang tanggal luas untuk menemukan sesi rapat aktualnya
      const urlRange = `${env.SIMGTK_API_URL}/integrasi/agenda-rapat?dari=${new Date().toISOString().slice(0, 10)}&email=${encodeURIComponent(emailUser)}`;
      const resRange = await fetch(urlRange, { headers: simgtkHeaders(), signal: AbortSignal.timeout(10_000) });
      if (resRange.ok) {
        const jsonRange = (await resRange.json()) as { data?: AgendaRapatSimgtk[] };
        const found = (jsonRange.data || []).find((a) => String(a.id) === id);
        if (found) return found;
      }
      return null;
    }
    const json = (await res.json()) as { data?: AgendaRapatSimgtk } | AgendaRapatSimgtk;
    return "data" in json && json.data ? json.data : (json as AgendaRapatSimgtk);
  } catch (e) {
    console.error("Gagal mengambil detail agenda dari SIMGTK:", e);
    return null;
  }
}

/**
 * 3. Kirim balik notulen dan link docs ke SIMGTK (POST /api/integrasi/agenda/{id}/sinkron-ruma)
 */
export async function kirimNotulenKeSimgtk(
  agendaId: number,
  payload: PayloadSinkronSimgtk
): Promise<HasilSinkronSimgtk> {
  if (!env.SIMGTK_API_URL || !env.SIMGTK_TOKEN) {
    throw new Error("SIMGTK API belum dikonfigurasi di server.");
  }

  const url = `${env.SIMGTK_API_URL}/integrasi/agenda/${agendaId}/sinkron-ruma`;
  const res = await fetch(url, {
    method: "POST",
    headers: simgtkHeaders(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SIMGTK menolak sinkronisasi (HTTP ${res.status}): ${errText}`);
  }

  return (await res.json()) as HasilSinkronSimgtk;
}
