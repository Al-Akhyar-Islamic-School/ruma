import { CalendarIcon, GavelIcon, MapPinIcon, UserIcon, UsersIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/app/feedback";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { bacaDokumenRapat } from "./payload";

function Baris({ ikon, label, children }: { ikon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground" aria-hidden>
        {ikon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-[15px] font-medium leading-snug">{children}</dd>
      </div>
    </div>
  );
}

/** Tab Notulen: kartu dokumen berkontras tinggi (kop, ringkasan eksekutif, agenda dan keputusan). Read-only. */
export function DokumenRapat({ payload, judulSesi }: { payload: unknown; judulSesi: string }) {
  const d = bacaDokumenRapat(payload);
  const kosong = !d.ringkasan && d.agenda.length === 0 && d.peserta.length === 0;
  if (kosong) {
    return (
      <EmptyState
        title="Notulen belum berisi uraian"
        hint="AI tidak menghasilkan ringkasan untuk rekaman ini. Periksa transkrip di tab Transkrip."
      />
    );
  }

  const kop = [
    { ikon: <CalendarIcon className="size-4" />, label: "Tanggal", nilai: d.tanggal },
    { ikon: <MapPinIcon className="size-4" />, label: "Tempat", nilai: d.tempat },
    { ikon: <UserIcon className="size-4" />, label: "Pemimpin rapat", nilai: d.pemimpin },
  ].filter((k) => k.nilai !== "");

  return (
    <article className="space-y-4">
      <Card className="gap-4 rounded-2xl bg-card p-5 ring-foreground/15">
        <h2 className="text-lg font-bold leading-snug">{d.judul || judulSesi}</h2>
        {kop.length > 0 && (
          <dl className="grid gap-3 sm:grid-cols-2">
            {kop.map((k) => (
              <Baris key={k.label} ikon={k.ikon} label={k.label}>
                {k.nilai}
              </Baris>
            ))}
          </dl>
        )}
        {d.peserta.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <UsersIcon className="size-4" aria-hidden />
              Peserta terdeteksi ({d.peserta.length})
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {d.peserta.map((p, i) => (
                <li key={i}>
                  <Badge variant="secondary" className="h-6 px-2.5 text-[13px] font-normal">
                    {p}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {d.ringkasan && (
        <Card className="gap-2 rounded-2xl p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ringkasan eksekutif</h3>
          <p className="whitespace-pre-line text-base leading-relaxed">{d.ringkasan}</p>
        </Card>
      )}

      {d.agenda.length > 0 && (
        <section aria-labelledby="judul-agenda" className="space-y-3">
          <h3 id="judul-agenda" className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Agenda dan keputusan
          </h3>
          <ol className="space-y-3">
            {d.agenda.map((a, i) => (
              <li key={i}>
                <Card className="gap-3 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-sm font-semibold tabular-nums text-primary">
                      {i + 1}
                    </span>
                    <h4 className="pt-0.5 text-base font-semibold leading-snug">{a.agenda || `Agenda ${i + 1}`}</h4>
                  </div>
                  {a.pembahasan && <p className="whitespace-pre-line text-[15px] leading-relaxed">{a.pembahasan}</p>}
                  {a.keputusan && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-success/10 p-3">
                      <GavelIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-success">Keputusan</p>
                        <p className="whitespace-pre-line text-[15px] font-medium leading-relaxed">{a.keputusan}</p>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}
