import { Link } from "@tanstack/react-router";
import { ClockIcon, GraduationCapIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDurasi, formatWaktu, STATUS_SESI, type StatusSesi } from "@/lib/format";

export const KATEGORI_LABEL = {
  pleno: "Rapat pleno",
  kurikulum: "Rapat kurikulum",
  komite: "Rapat komite",
  pimpinan: "Rapat pimpinan",
} as const;

export type SesiRingkas = {
  uuid: string;
  tipeSesi: "rapat" | "supervisi_kelas";
  judul: string;
  status: StatusSesi;
  durasiDetik: number;
  createdAt: string;
  metadata: { kategori?: keyof typeof KATEGORI_LABEL; kelas?: string; mapel?: string };
  /** Ada pada daftar "Dibagikan". */
  perekam?: { name: string };
};

const TONE = { amber: "warning", sky: "secondary", emerald: "success", rose: "destructive" } as const;

/** Kartu sesi di beranda (DESIGN.md Layar 1). */
export function SesiCard({ s }: { s: SesiRingkas }) {
  const supervisi = s.tipeSesi === "supervisi_kelas";
  const Ikon = supervisi ? GraduationCapIcon : UsersIcon;
  const sub = supervisi
    ? [s.metadata.kelas, s.metadata.mapel].filter(Boolean).join(" · ")
    : s.metadata.kategori
      ? KATEGORI_LABEL[s.metadata.kategori]
      : "";
  const status = STATUS_SESI[s.status];
  return (
    <Link to="/sesi/$uuid" params={{ uuid: s.uuid }} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <Card className="flex-row items-start gap-3 rounded-2xl p-4 transition-colors hover:bg-accent/40">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Ikon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 font-semibold leading-snug">{s.judul}</p>
            <StatusBadge status={s.status} label={status.label} tone={status.tone} />
          </div>
          {sub && <p className="truncate text-sm text-muted-foreground">{sub}</p>}
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <ClockIcon className="size-3.5" aria-hidden />
            {formatWaktu(s.createdAt)}
            {s.durasiDetik > 0 && <span>({formatDurasi(s.durasiDetik)})</span>}
            {s.perekam && <span>· oleh {s.perekam.name}</span>}
          </p>
        </div>
      </Card>
    </Link>
  );
}

function StatusBadge({ label, tone }: { status: StatusSesi; label: string; tone: keyof typeof TONE }) {
  const v = TONE[tone];
  if (v === "success") return <Badge className="shrink-0 bg-success text-success-foreground">{label}</Badge>;
  if (v === "warning") return <Badge className="shrink-0 bg-warning text-warning-foreground">{label}</Badge>;
  return <Badge variant={v} className="shrink-0">{label}</Badge>;
}
