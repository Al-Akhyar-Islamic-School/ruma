import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ErrorNotice, ListSkeleton } from "@/components/app/feedback";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api, ok } from "@/lib/api";
import { formatTimer, formatWaktu } from "@/lib/format";
import { labelKategori, useKategori } from "@/lib/kategori";
import { KotakCari } from "./kotak-cari";
import { pecahKata, Sorot } from "./sorot";

const MIN_HURUF = 2;
const MAKS_RAPAT = 30;

const BAGIAN = {
  judul: "Judul",
  keputusan: "Keputusan",
  tugas: "Tugas",
  ringkasan: "Ringkasan",
  transkrip: "Transkrip",
} as const;

/** Tab Cari: pencarian teks penuh lintas rapat yang bisa dibaca pengguna. */
export function TabCari({ q, onUbahQ }: { q: string; onUbahQ: (q: string) => void }) {
  const kategori = useKategori();
  const kueri = q.trim();
  const siap = kueri.length >= MIN_HURUF;
  const kata = pecahKata(kueri);

  const hasil = useQuery({
    queryKey: ["pengetahuan", "cari", kueri],
    queryFn: async () => ok(await api.pengetahuan.cari.$get({ query: { q: kueri } })),
    enabled: siap,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-4">
      <KotakCari
        label="Cari di semua rapat"
        placeholder="Mis. batas impor soal CBT"
        nilaiAwal={q}
        petunjuk={kueri.length === 1 ? "Ketik minimal 2 huruf." : undefined}
        onKomit={onUbahQ}
      />

      <div aria-live="polite">
        {!siap ? (
          <p className="px-1 text-sm text-muted-foreground">
            Cari judul, ringkasan, keputusan, tugas, dan transkrip dari rapat yang bisa Anda baca. Pisahkan kata dengan
            spasi; semua kata harus muncul.
          </p>
        ) : hasil.isError ? (
          <ErrorNotice error={hasil.error} onRetry={() => void hasil.refetch()} title="Pencarian gagal" />
        ) : !hasil.data ? (
          <ListSkeleton rows={3} />
        ) : hasil.data.hasil.length === 0 ? (
          <div className="space-y-1 px-1 py-8 text-center">
            <p className="font-semibold">Tidak ada rapat yang cocok dengan “{kueri}”.</p>
            <p className="text-sm text-muted-foreground">
              Coba kata yang lebih singkat atau umum, atau kurangi jumlah kata.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="px-1 text-sm text-muted-foreground">{hasil.data.hasil.length} rapat cocok.</p>
            <ul className="space-y-3">
              {hasil.data.hasil.map((r) => (
                <li key={r.uuid}>
                  <Link
                    to="/sesi/$uuid"
                    params={{ uuid: r.uuid }}
                    className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Card className="gap-3 rounded-2xl p-4 transition-colors hover:bg-accent/40">
                      <div className="space-y-1">
                        <p className="font-semibold leading-snug">
                          <Sorot teks={r.judul} kata={kata} />
                        </p>
                        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                          <span>{formatWaktu(r.createdAt)}</span>
                          {r.kategori && <span>· {labelKategori(kategori, r.kategori)}</span>}
                          <span>· oleh {r.pemilik}</span>
                        </p>
                      </div>
                      <ul className="space-y-2">
                        {r.cocok.map((c, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Badge variant="outline" className="mt-0.5 shrink-0 text-[11px]">
                              {BAGIAN[c.bagian]}
                            </Badge>
                            <p className="min-w-0 text-sm leading-relaxed">
                              {c.bagian === "transkrip" && c.detik !== null && (
                                <span className="mr-1.5 font-mono text-xs tabular-nums text-muted-foreground">
                                  [{formatTimer(c.detik)}]
                                </span>
                              )}
                              <Sorot teks={c.cuplikan} kata={kata} />
                            </p>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
            {hasil.data.terpotong && (
              <p className="px-1 text-sm text-muted-foreground">
                Menampilkan {MAKS_RAPAT} rapat terbaru yang cocok. Perjelas kata kunci untuk mempersempit.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
