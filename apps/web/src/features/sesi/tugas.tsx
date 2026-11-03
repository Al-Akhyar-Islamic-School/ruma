import { CalendarIcon, CircleCheckIcon, CircleDashedIcon, CircleIcon, UserCheckIcon, UserIcon, UserPenIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/app/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatTanggal } from "@/lib/format";
import { bacaTenggatPayload, cariTenggatPayload, tampilTanggal } from "./payload";
import { TandaiPicSheet } from "./tandai-pic";

export type ItemTugas = {
  id: number;
  tugas: string;
  /** Teks PIC asli dari AI (mis. "Pak Ihwan"). */
  picNama: string;
  /** Orang yang ditandai perekam dari direktori GTK. */
  picEmail: string | null;
  picNamaResmi: string | null;
  tenggatWaktu: string | null;
  status: "pending" | "proses" | "selesai";
};

const STATUS = {
  pending: { label: "Belum dikerjakan", Ikon: CircleIcon, kelas: "text-muted-foreground" },
  proses: { label: "Sedang dikerjakan", Ikon: CircleDashedIcon, kelas: "text-warning" },
  selesai: { label: "Selesai", Ikon: CircleCheckIcon, kelas: "text-success" },
} as const;

function Pic({ t }: { t: ItemTugas }) {
  if (t.picEmail) {
    return (
      <span className="flex items-start gap-1.5">
        <UserCheckIcon className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
        <span className="min-w-0">
          <span className="sr-only">Penanggung jawab:</span>
          <span className="font-medium text-foreground">{t.picNamaResmi ?? t.picEmail}</span>{" "}
          <Badge variant="secondary" className="h-5 px-2 text-[11px]">
            Ditandai
          </Badge>
          {t.picNamaResmi && <span className="block truncate text-xs">{t.picEmail}</span>}
        </span>
      </span>
    );
  }
  return (
    <span className="flex items-start gap-1.5">
      <UserIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="sr-only">Penanggung jawab:</span>
        {t.picNama || "Belum ditentukan"}
        <span className="block text-xs">Dari AI, belum ditandai</span>
      </span>
    </span>
  );
}

/**
 * Tab Tugas: tindak lanjut hasil rapat. Perekam bisa menandai PIC dari direktori GTK; yang lain hanya melihat.
 * `payload` dipakai mengambil teks tenggat relatif yang tidak muat di kolom tanggal.
 */
export function DaftarTugas({
  items,
  payload,
  uuid,
  adalahPerekam,
  onUndang,
}: {
  items: ItemTugas[];
  payload: unknown;
  uuid: string;
  adalahPerekam: boolean;
  onUndang: () => void;
}) {
  const [sheet, setSheet] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(null);
  const target = items.find((t) => t.id === targetId) ?? null;
  const tenggatPayload = useMemo(() => bacaTenggatPayload(payload), [payload]);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Tidak ada tugas dari rapat ini"
        hint="AI tidak menemukan pembagian tugas di dalam rekaman. Keputusan rapat ada di tab Notulen."
      />
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {items.map((t, i) => {
          const { label, Ikon, kelas } = STATUS[t.status];
          const tanggal = t.tenggatWaktu ? new Date(t.tenggatWaktu) : null;
          const tenggat =
            tanggal && !Number.isNaN(tanggal.getTime())
              ? formatTanggal(tanggal)
              : tampilTanggal(cariTenggatPayload(tenggatPayload, t.tugas, i)) || "Tanpa tenggat";
          return (
            <li key={t.id}>
              <Card className="flex-row gap-3 rounded-2xl p-4">
                <Ikon className={`mt-0.5 size-5 shrink-0 ${kelas}`} aria-hidden />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-[15px] font-medium leading-snug">{t.tugas}</p>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <Pic t={t} />
                    <span className="flex items-start gap-1.5">
                      <CalendarIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0">
                        <span className="sr-only">Tenggat:</span>
                        {tenggat}
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{label}</Badge>
                    {adalahPerekam && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTargetId(t.id);
                          setSheet(true);
                        }}
                      >
                        <UserPenIcon />
                        {t.picEmail ? "Ganti PIC" : "Tandai PIC"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      {adalahPerekam && (
        <TandaiPicSheet uuid={uuid} tugas={target} open={sheet} onOpenChange={setSheet} onUndang={onUndang} />
      )}
    </>
  );
}
