import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, UserPlusIcon } from "lucide-react";
import { KATEGORI_LABEL } from "@/components/app/sesi-card";
import { Button } from "@/components/ui/button";
import { formatDurasi, formatWaktu } from "@/lib/format";
import { SetujuiDokumen } from "./setujui-dokumen";
import { StatusBadge } from "./status-badge";
import type { DetailSesi } from "./queries";

/** Kepala halaman: kembali, judul, status, meta, dan aksi perekam (Undang, Setujui dokumen). */
export function KepalaSesi({
  sesi,
  bisaSetujui,
  onUndang,
}: {
  sesi: DetailSesi;
  bisaSetujui: boolean;
  onUndang: () => void;
}) {
  const supervisi = sesi.tipeSesi === "supervisi_kelas";
  const sub = supervisi
    ? [sesi.metadata.kelas, sesi.metadata.mapel].filter(Boolean).join(" · ")
    : sesi.metadata.kategori
      ? KATEGORI_LABEL[sesi.metadata.kategori]
      : "";
  const meta: string[] = [formatWaktu(sesi.createdAt)];
  if (sesi.durasiDetik > 0) meta.push(formatDurasi(sesi.durasiDetik));
  if (sub) meta.push(sub);

  return (
    <header className="space-y-3">
      <div className="flex items-start gap-1">
        <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0">
          <Link to="/" aria-label="Kembali ke beranda">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <div className="min-w-0 flex-1 space-y-1.5 pt-2">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold leading-snug">{sesi.judul}</h1>
            <StatusBadge status={sesi.status} />
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            {meta.map((m, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>·</span>}
                {m}
              </span>
            ))}
          </p>
        </div>
      </div>
      {sesi.adalahPerekam && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onUndang}>
            <UserPlusIcon />
            Undang
          </Button>
          {bisaSetujui && <SetujuiDokumen uuid={sesi.uuid} />}
        </div>
      )}
    </header>
  );
}
