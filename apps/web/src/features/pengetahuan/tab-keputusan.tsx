import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { GavelIcon } from "lucide-react";
import { useMemo } from "react";
import { EmptyState, ErrorNotice, ListSkeleton } from "@/components/app/feedback";
import { Card } from "@/components/ui/card";
import { tampilTanggal } from "@/features/sesi/payload";
import { api, ok } from "@/lib/api";
import { labelKategori, useKategori } from "@/lib/kategori";
import { KotakCari } from "./kotak-cari";
import { pecahKata, Sorot } from "./sorot";

const MAKS_RAPAT = 100;

/** Tab Keputusan: keputusan dari notulen semua rapat yang bisa dibaca, dikelompokkan per rapat. */
export function TabKeputusan({ q, onUbahQ }: { q: string; onUbahQ: (q: string) => void }) {
  const kategori = useKategori();
  const cari = q.trim();
  const kata = pecahKata(cari);

  const hasil = useQuery({
    queryKey: ["pengetahuan", "keputusan", cari],
    queryFn: async () => ok(await api.pengetahuan.keputusan.$get({ query: cari ? { cari } : {} })),
    staleTime: 30_000,
  });

  // Server mengurutkan menurut rapat; kelompokkan per rapat dengan mempertahankan urutan itu.
  const kelompok = useMemo(() => {
    const per = new Map<string, NonNullable<typeof hasil.data>["items"]>();
    for (const it of hasil.data?.items ?? []) per.set(it.uuid, [...(per.get(it.uuid) ?? []), it]);
    return [...per.values()];
  }, [hasil.data]);

  return (
    <div className="space-y-4">
      <KotakCari
        label="Saring keputusan"
        placeholder="Kata kunci (opsional)"
        nilaiAwal={q}
        onKomit={onUbahQ}
      />

      <div aria-live="polite">
        {hasil.isError ? (
          <ErrorNotice error={hasil.error} onRetry={() => void hasil.refetch()} title="Tidak bisa memuat keputusan" />
        ) : !hasil.data ? (
          <ListSkeleton rows={3} />
        ) : kelompok.length === 0 ? (
          cari ? (
            <EmptyState
              title={`Tidak ada keputusan yang cocok dengan “${cari}”.`}
              hint="Coba kata yang lebih singkat atau hapus kata kunci."
            />
          ) : (
            <EmptyState title="Belum ada keputusan tercatat dari rapat yang bisa Anda baca." />
          )
        ) : (
          <div className="space-y-3">
            <ul className="space-y-3">
              {kelompok.map((butir) => {
                const rapat = butir[0];
                if (!rapat) return null;
                return (
                  <li key={rapat.uuid}>
                    <Card className="gap-3 rounded-2xl p-4">
                      <div className="space-y-1">
                        <Link
                          to="/sesi/$uuid"
                          params={{ uuid: rapat.uuid }}
                          className="inline-block min-h-6 font-semibold leading-snug underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {rapat.judul}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {[tampilTanggal(rapat.tanggal), rapat.kategori ? labelKategori(kategori, rapat.kategori) : ""]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <ul className="space-y-3">
                        {butir.map((k, i) => (
                          <li key={i} className="flex items-start gap-2.5 rounded-xl bg-success/10 p-3">
                            <GavelIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                            <div className="min-w-0 space-y-0.5">
                              {k.agenda && <p className="text-xs text-muted-foreground">{k.agenda}</p>}
                              <p className="whitespace-pre-line text-[15px] font-medium leading-relaxed">
                                <Sorot teks={k.keputusan} kata={kata} />
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </li>
                );
              })}
            </ul>
            {hasil.data.terpotong && (
              <p className="px-1 text-sm text-muted-foreground">Menampilkan keputusan dari {MAKS_RAPAT} rapat terbaru.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
