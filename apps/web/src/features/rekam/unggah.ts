import { useEffect, useState, useSyncExternalStore } from "react";
import { API_URL, apiFetch } from "@/lib/api";
import { ambilBlob, tandaiTerunggah } from "./db";

/** Keadaan satu potongan di buku besar: `tersimpan` (di perangkat, antre/sedang diunggah), `terunggah`, `gagal` (menunggu ulang). */
export type StatusPotongan = "tersimpan" | "terunggah" | "gagal";

export type KodeGalat = "login_berakhir" | "tidak_ditemukan" | "sesi_ditutup" | "melebihi_durasi" | "ditolak" | "tidak_bisa_diselesaikan";
/** Galat yang tidak akan sembuh dengan mengulang otomatis; antrean berhenti sampai pengguna bertindak. */
export type GalatUnggah = { kode: KodeGalat; pesan: string };

export class GalatUnggahError extends Error {
  constructor(readonly galat: GalatUnggah) {
    super(galat.kode);
  }
}

export type SnapshotUnggah = {
  potongan: ReadonlyMap<number, StatusPotongan>;
  online: boolean;
  galat: GalatUnggah | null;
  /** Ada permintaan unggah yang sedang berjalan. */
  sibuk: boolean;
};

const PESAN_GALAT: Record<Exclude<KodeGalat, "ditolak" | "tidak_bisa_diselesaikan">, string> = {
  login_berakhir: "Sesi login berakhir. Masuk lagi; rekaman tetap aman di perangkat dan bisa dikirim dari beranda.",
  tidak_ditemukan: "Sesi ini tidak ditemukan di server atau bukan milik akun ini, jadi rekaman di perangkat tidak bisa dikirim.",
  sesi_ditutup: "Sesi ini sudah ditutup di server, jadi potongan baru tidak diterima lagi.",
  melebihi_durasi: "Rekaman melebihi batas durasi yang diizinkan. Server menolak potongan di atas batas itu.",
};

/** Memetakan respons galat server ke galat tetap, atau `null` bila layak diulang (5xx, 408, 429). */
export function galatTetapDariRespons(status: number, kode: string): GalatUnggah | null {
  if (status === 401) return { kode: "login_berakhir", pesan: PESAN_GALAT.login_berakhir };
  if (status === 404) return { kode: "tidak_ditemukan", pesan: PESAN_GALAT.tidak_ditemukan };
  if (status === 409 && kode === "sesi_sudah_ditutup") return { kode: "sesi_ditutup", pesan: PESAN_GALAT.sesi_ditutup };
  if (status === 409 && kode === "melebihi_durasi_izin") return { kode: "melebihi_durasi", pesan: PESAN_GALAT.melebihi_durasi };
  if (status === 408 || status === 429 || status >= 500) return null;
  if (status >= 400) return { kode: "ditolak", pesan: `Server menolak data rekaman (${kode}). Coba lagi, atau hubungi admin bila terus berulang.` };
  return null;
}

const BACKOFF_AWAL_MS = 1_000;
const BACKOFF_MAKS_MS = 30_000;

/**
 * Antrean unggah potongan satu-per-satu untuk satu sesi. Sumber kebenaran adalah IndexedDB: potongan harus sudah
 * tersimpan di sana sebelum `tambah`. Gagal jaringan/5xx diulang dengan backoff eksponensial (maks ±30 dtk) dan
 * langsung dicoba lagi saat event `online`. Unggah idempoten di server, jadi mengulang potongan yang sama aman.
 */
export class PengunggahChunk {
  private snap: SnapshotUnggah = { potongan: new Map(), online: navigator.onLine, galat: null, sibuk: false };
  private readonly antre = new Set<number>();
  /** Blob yang gagal disimpan ke IndexedDB; diunggah dari memori supaya tidak hilang. */
  private readonly cadangan = new Map<number, Blob>();
  private readonly pendengar = new Set<() => void>();
  private penunggu: { selesai: () => void; gagal: (e: Error) => void }[] = [];
  private aktif = false;
  private memompa = false;
  private bangunkan: (() => void) | null = null;
  private gagalBerturut = 0;

  constructor(private readonly uuid: string) {}

  subscribe = (l: () => void): (() => void) => {
    this.pendengar.add(l);
    return () => this.pendengar.delete(l);
  };

  getSnapshot = (): SnapshotUnggah => this.snap;

  aktifkan(): void {
    this.aktif = true;
    window.addEventListener("online", this.saatOnline);
    window.addEventListener("offline", this.saatOffline);
    this.ubah({ online: navigator.onLine });
    void this.pompa();
  }

  hentikan(): void {
    this.aktif = false;
    window.removeEventListener("online", this.saatOnline);
    window.removeEventListener("offline", this.saatOffline);
    this.bangunkan?.();
    const semua = this.penunggu;
    this.penunggu = [];
    for (const p of semua) p.gagal(new DOMException("Pengunggah dihentikan", "AbortError"));
  }

  /** Memuat keadaan awal (pemulihan): semua potongan yang belum terunggah masuk antrean. */
  muat(daftar: { seq: number; terunggah: boolean }[]): void {
    const peta = new Map(this.snap.potongan);
    for (const { seq, terunggah } of daftar) {
      peta.set(seq, terunggah ? "terunggah" : "tersimpan");
      if (terunggah) this.antre.delete(seq);
      else this.antre.add(seq);
    }
    this.ubah({ potongan: peta });
    void this.pompa();
  }

  /** Potongan baru sudah tersimpan di IndexedDB. `cadangan` hanya diisi bila penyimpanan gagal. */
  tambah(seq: number, cadangan?: Blob): void {
    if (cadangan) this.cadangan.set(seq, cadangan);
    this.antre.add(seq);
    this.setPotongan(seq, "tersimpan");
    void this.pompa();
  }

  /** Mengunggah ulang potongan yang dilaporkan hilang oleh server. */
  ulang(seq: number): void {
    this.tambah(seq);
  }

  /** Apakah isi potongan masih ada di perangkat (IndexedDB atau memori). */
  async punya(seq: number): Promise<boolean> {
    return this.cadangan.has(seq) || (await ambilBlob(this.uuid, seq).catch(() => null)) !== null;
  }

  /** Setelah galat tetap: hapus galat dan coba lagi. */
  cobaLagi(): void {
    this.gagalBerturut = 0;
    this.ubah({ galat: null });
    this.bangunkan?.();
    void this.pompa();
  }

  /** Selesai saat antrean kosong; ditolak dengan `GalatUnggahError` bila antrean berhenti karena galat tetap. */
  tunggu(): Promise<void> {
    if (this.snap.galat) return Promise.reject(new GalatUnggahError(this.snap.galat));
    if (this.antre.size === 0) return Promise.resolve();
    return new Promise<void>((selesai, gagal) => this.penunggu.push({ selesai, gagal }));
  }

  private saatOnline = (): void => {
    this.gagalBerturut = 0;
    this.ubah({ online: true });
    this.bangunkan?.();
    void this.pompa();
  };

  private saatOffline = (): void => this.ubah({ online: false });

  private ubah(patch: Partial<SnapshotUnggah>): void {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.pendengar) l();
    this.periksaPenunggu();
  }

  private setPotongan(seq: number, status: StatusPotongan): void {
    if (this.snap.potongan.get(seq) === status) return;
    this.ubah({ potongan: new Map(this.snap.potongan).set(seq, status) });
  }

  private periksaPenunggu(): void {
    if (this.penunggu.length === 0) return;
    const galat = this.snap.galat;
    if (galat) {
      const semua = this.penunggu;
      this.penunggu = [];
      for (const p of semua) p.gagal(new GalatUnggahError(galat));
    } else if (this.antre.size === 0) {
      const semua = this.penunggu;
      this.penunggu = [];
      for (const p of semua) p.selesai();
    }
  }

  private seqBerikutnya(): number | undefined {
    let kecil: number | undefined;
    for (const s of this.antre) if (kecil === undefined || s < kecil) kecil = s;
    return kecil;
  }

  private tidur(ms: number): Promise<void> {
    return new Promise<void>((selesai) => {
      const bangun = () => {
        clearTimeout(timer);
        this.bangunkan = null;
        selesai();
      };
      const timer = setTimeout(bangun, ms);
      this.bangunkan = bangun;
    });
  }

  private async pompa(): Promise<void> {
    if (this.memompa || !this.aktif) return;
    this.memompa = true;
    try {
      while (this.aktif && !this.snap.galat) {
        const seq = this.seqBerikutnya();
        if (seq === undefined) break;
        this.ubah({ sibuk: true });
        const hasil = await this.kirimSatu(seq);
        if (hasil === "sukses") {
          this.antre.delete(seq);
          this.cadangan.delete(seq);
          this.gagalBerturut = 0;
          this.setPotongan(seq, "terunggah");
        } else if (hasil === "hilang") {
          // Isi potongan tidak ada lagi di perangkat; server akan melaporkannya lewat 409 chunk_tidak_lengkap saat finish.
          this.antre.delete(seq);
        } else if (hasil === "ulang") {
          this.gagalBerturut++;
          this.setPotongan(seq, "gagal");
          const jeda = Math.min(BACKOFF_MAKS_MS, BACKOFF_AWAL_MS * 2 ** (this.gagalBerturut - 1));
          await this.tidur(jeda * (0.8 + Math.random() * 0.4));
        } else {
          this.ubah({ galat: hasil });
        }
      }
    } finally {
      this.memompa = false;
      this.ubah({ sibuk: false });
    }
  }

  private async kirimSatu(seq: number): Promise<"sukses" | "ulang" | "hilang" | GalatUnggah> {
    let blob: Blob | null | undefined = this.cadangan.get(seq);
    if (!blob) {
      try {
        blob = await ambilBlob(this.uuid, seq);
      } catch {
        return "ulang";
      }
    }
    if (!blob) return "hilang";
    try {
      const res = await apiFetch(`${API_URL}/sesi/${this.uuid}/chunks/${seq}`, { method: "PUT", body: blob });
      if (res.ok) {
        await tandaiTerunggah(this.uuid, seq).catch(() => undefined);
        return "sukses";
      }
      const body: unknown = await res.json().catch(() => null);
      const kode = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : `http_${res.status}`;
      return galatTetapDariRespons(res.status, kode) ?? "ulang";
    } catch {
      return "ulang";
    }
  }
}

/** Satu pengunggah per layar; aktif selama komponen terpasang. */
export function usePengunggah(uuid: string): { pengunggah: PengunggahChunk; snap: SnapshotUnggah } {
  const [pengunggah] = useState(() => new PengunggahChunk(uuid));
  useEffect(() => {
    pengunggah.aktifkan();
    return () => pengunggah.hentikan();
  }, [pengunggah]);
  const snap = useSyncExternalStore(pengunggah.subscribe, pengunggah.getSnapshot);
  return { pengunggah, snap };
}

export type HitunganPotongan = { tersimpan: number; terunggah: number; gagal: number };

export function hitungPotongan(potongan: ReadonlyMap<number, StatusPotongan>): HitunganPotongan {
  let terunggah = 0;
  let gagal = 0;
  for (const s of potongan.values()) {
    if (s === "terunggah") terunggah++;
    else if (s === "gagal") gagal++;
  }
  return { tersimpan: potongan.size, terunggah, gagal };
}
