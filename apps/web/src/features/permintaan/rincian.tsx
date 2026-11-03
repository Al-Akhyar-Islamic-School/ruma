import { GraduationCapIcon, UsersIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { type KategoriRapat, labelKategori, useKategori } from "@/lib/kategori";

export type TipeSesiPermintaan = "rapat" | "supervisi_kelas";

export type MetadataPermintaan = {
  kategori?: string;
  guruEmail?: string;
  kelas?: string;
  mapel?: string;
  materi?: string;
};

/** Bentuk permintaan sesi dari `GET /permintaan` dan `GET /admin/permintaan` (tanggal sudah berupa string JSON). */
export type DataPermintaan = {
  id: number;
  tipeSesi: TipeSesiPermintaan;
  judul: string;
  metadata: MetadataPermintaan;
  alasan: string;
  durasiDimintaMenit: number;
  status: "menunggu" | "disetujui" | "ditolak";
  durasiDiizinkanMenit: number | null;
  berlakuSampai: string | null;
  catatanAdmin: string | null;
  sesiId: number | null;
  createdAt: string;
};

export const JENIS_LABEL: Record<TipeSesiPermintaan, string> = {
  rapat: "Rapat",
  supervisi_kelas: "Supervisi kelas",
};

const tanggalJam = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Makassar",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "3 Nov 2026 08.30". Zona Asia/Makassar. */
export const formatTanggalJam = (iso: string | Date) => tanggalJam.format(new Date(iso));

export const formatMenit = (menit: number) => `${menit} menit`;

export function sudahKedaluwarsa(p: Pick<DataPermintaan, "berlakuSampai">): boolean {
  return p.berlakuSampai !== null && new Date(p.berlakuSampai).getTime() < Date.now();
}

export type TampilanStatus = "menunggu" | "siap" | "dipakai" | "kedaluwarsa" | "ditolak";

/** Status yang dilihat pengguna: gabungan status server, pemakaian (`sesiId`), dan masa berlaku. */
export function tampilanStatus(p: DataPermintaan): TampilanStatus {
  if (p.status === "menunggu") return "menunggu";
  if (p.status === "ditolak") return "ditolak";
  if (p.sesiId !== null) return "dipakai";
  return sudahKedaluwarsa(p) ? "kedaluwarsa" : "siap";
}

export function BadgeStatus({ status }: { status: TampilanStatus }) {
  switch (status) {
    case "menunggu":
      return <Badge className="shrink-0 bg-warning text-warning-foreground">Menunggu</Badge>;
    case "siap":
      return <Badge className="shrink-0 bg-success text-success-foreground">Disetujui</Badge>;
    case "dipakai":
      return <Badge variant="secondary" className="shrink-0">Sudah dipakai</Badge>;
    case "kedaluwarsa":
      return <Badge variant="destructive" className="shrink-0">Kedaluwarsa</Badge>;
    case "ditolak":
      return <Badge variant="destructive" className="shrink-0">Ditolak</Badge>;
  }
}

function ringkasMetadata(p: DataPermintaan, kategori: readonly KategoriRapat[]): string {
  if (p.tipeSesi === "rapat") return p.metadata.kategori ? labelKategori(kategori, p.metadata.kategori) : "";
  return [p.metadata.guruEmail && `Guru: ${p.metadata.guruEmail}`, p.metadata.kelas, p.metadata.mapel, p.metadata.materi]
    .filter(Boolean)
    .join(" · ");
}

function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/** Isi kartu permintaan: judul, jenis, alasan, durasi, dan keputusan admin. Aksi dan pemohon lewat `atas`/`children`. */
export function RincianPermintaan({ p, atas, children }: { p: DataPermintaan; atas?: ReactNode; children?: ReactNode }) {
  const supervisi = p.tipeSesi === "supervisi_kelas";
  const Ikon = supervisi ? GraduationCapIcon : UsersIcon;
  const ringkas = ringkasMetadata(p, useKategori());
  const keputusan = p.status !== "menunggu";
  return (
    <div className="flex gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
        <Ikon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-3 font-semibold leading-snug">{p.judul}</p>
          <BadgeStatus status={tampilanStatus(p)} />
        </div>
        {atas}
        <p className="text-sm text-muted-foreground">
          {JENIS_LABEL[p.tipeSesi]}
          {ringkas && <span className="break-words"> · {ringkas}</span>}
        </p>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Alasan</p>
          <p className="whitespace-pre-line break-words text-sm">{p.alasan}</p>
        </div>
        <dl className="space-y-0.5 text-sm">
          <Baris label="Durasi diminta:">{formatMenit(p.durasiDimintaMenit)}</Baris>
          <Baris label="Diajukan:">{formatTanggalJam(p.createdAt)}</Baris>
          {keputusan && p.status === "disetujui" && p.durasiDiizinkanMenit !== null && (
            <Baris label="Durasi diizinkan:">{formatMenit(p.durasiDiizinkanMenit)}</Baris>
          )}
          {keputusan && p.status === "disetujui" && p.berlakuSampai && (
            <Baris label="Berlaku sampai:">{formatTanggalJam(p.berlakuSampai)}</Baris>
          )}
        </dl>
        {keputusan && p.catatanAdmin && (
          <div className="rounded-xl bg-muted px-3 py-2 text-sm">
            <p className="text-xs font-semibold text-muted-foreground">Catatan admin</p>
            <p className="whitespace-pre-line break-words">{p.catatanAdmin}</p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
