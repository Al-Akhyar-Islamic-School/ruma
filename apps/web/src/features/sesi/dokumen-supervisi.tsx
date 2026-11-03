import { CircleQuestionMarkIcon, MessageSquareQuoteIcon, SproutIcon, StarIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/app/feedback";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DaftarBukti, TeksBukti } from "./bukti";
import { bacaDokumenSupervisi, SKOR_MAKS } from "./payload";

function DaftarButir({ judul, ikon, butir }: { judul: string; ikon: ReactNode; butir: string[] }) {
  if (butir.length === 0) return null;
  return (
    <Card className="gap-3 rounded-2xl p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <span aria-hidden>{ikon}</span>
        {judul}
      </h3>
      <ul className="space-y-2.5">
        {butir.map((b, i) => (
          <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
            <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
            <span className="min-w-0">
              <TeksBukti teks={b} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Tab Lembar observasi: skor, rubrik per kegiatan dengan bukti transkrip, lalu catatan untuk umpan balik. Read-only. */
export function DokumenSupervisi({ payload }: { payload: unknown }) {
  const d = bacaDokumenSupervisi(payload);
  const kosong =
    d.ringkasanSkor === null &&
    d.bagian.every((b) => b.temuan.length === 0 && b.bukti.length === 0) &&
    d.praktikBaik.length + d.areaPengembangan.length + d.pertanyaanReflektif.length === 0 &&
    !d.catatanUmpanBalik;
  if (kosong) {
    return (
      <EmptyState
        title="Lembar observasi belum berisi penilaian"
        hint="AI tidak menghasilkan penilaian untuk rekaman ini. Periksa transkrip di tab Transkrip."
      />
    );
  }

  return (
    <article className="space-y-4">
      {d.identitas.length > 0 && (
        <Card className="rounded-2xl p-5">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {d.identitas.map((i) => (
              <div key={i.label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{i.label}</dt>
                <dd className="text-[15px] font-medium leading-snug">{i.nilai}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <Card className="gap-3 rounded-2xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Skor observasi KBM</h3>
        {d.ringkasanSkor ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-mono text-3xl font-bold tabular-nums">{d.ringkasanSkor.teks}</p>
              <Badge className="h-7 px-3 text-sm">{d.ringkasanSkor.label}</Badge>
            </div>
            <Progress
              value={(d.ringkasanSkor.rata / SKOR_MAKS) * 100}
              className="h-2"
              aria-label={`Rata-rata skor ${d.ringkasanSkor.teks}`}
            />
            <p className="text-xs text-muted-foreground">
              Rata-rata skor bagian yang teramati. Label bersifat sementara sampai ambang resmi ditetapkan.
            </p>
          </>
        ) : (
          <p className="text-[15px] text-muted-foreground">Belum ada skor: semua bagian tidak teramati dalam rekaman.</p>
        )}
      </Card>

      <Card className="rounded-2xl px-5 py-1">
        <Accordion type="multiple" defaultValue={d.bagian.map((b) => b.kunci)}>
          {d.bagian.map((b, i) => (
            <AccordionItem key={b.kunci} value={b.kunci}>
              <AccordionTrigger className="items-center py-3.5 text-base">
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
                  <span className="font-semibold">
                    {i + 1}. {b.judul}
                  </span>
                  {b.skor !== null ? (
                    <Badge variant="secondary" className="font-mono tabular-nums">
                      {b.skor}/{SKOR_MAKS}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="font-normal">
                      Tidak teramati
                    </Badge>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                {b.temuan.length > 0 ? (
                  <dl className="space-y-3">
                    {b.temuan.map((t) => (
                      <div key={t.label}>
                        <dt className="text-xs font-semibold text-muted-foreground">{t.label}</dt>
                        <dd className="whitespace-pre-line text-[15px] leading-relaxed">
                          <TeksBukti teks={t.teks} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-[15px] text-muted-foreground">Tidak ada temuan tertulis untuk bagian ini.</p>
                )}
                <DaftarBukti bukti={b.bukti} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>

      <DaftarButir judul="Praktik baik" ikon={<StarIcon className="size-4" />} butir={d.praktikBaik} />
      <DaftarButir judul="Area pengembangan" ikon={<SproutIcon className="size-4" />} butir={d.areaPengembangan} />
      <DaftarButir judul="Pertanyaan reflektif" ikon={<CircleQuestionMarkIcon className="size-4" />} butir={d.pertanyaanReflektif} />

      {d.catatanUmpanBalik && (
        <Card className="gap-3 rounded-2xl bg-accent p-5 text-accent-foreground">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
            <MessageSquareQuoteIcon className="size-4" aria-hidden />
            Draf catatan umpan balik
          </h3>
          <p className="whitespace-pre-line text-base leading-relaxed">
            <TeksBukti teks={d.catatanUmpanBalik} />
          </p>
        </Card>
      )}
    </article>
  );
}
