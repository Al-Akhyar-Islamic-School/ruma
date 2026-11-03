import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClockIcon, GraduationCapIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorNotice, ListSkeleton } from "@/components/app/feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError, api, ok, pesanGalat } from "@/lib/api";
import { formatWaktu, STATUS_SESI, type StatusSesi } from "@/lib/format";

const REFRESH_MS = 10_000;

const TAHAP: Record<string, string> = {
  mentranskrip: "tahap transkripsi",
  menganalisis: "tahap analisis (transkrip yang sudah ada dipakai ulang)",
};

export function AntreanAdmin() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "antrean"],
    queryFn: async () => ok(await api.admin.antrean.$get()),
    refetchInterval: REFRESH_MS,
  });

  const worker = useQuery({
    queryKey: ["admin", "worker"],
    queryFn: async () => ok(await api.admin.worker.$get()),
    refetchInterval: REFRESH_MS,
  });
  const adaMenunggu = q.data?.some((s) => s.status === "mentranskrip" || s.status === "menganalisis") ?? false;

  const ulangi = useMutation({
    mutationFn: async (uuid: string) => ok(await api.admin.sesi[":uuid"].ulangi.$post({ param: { uuid } })),
    onSuccess: (d) => {
      toast.success(`Pemrosesan diulang dari ${TAHAP[d.status] ?? "tahap berikutnya"}.`);
      void qc.invalidateQueries({ queryKey: ["admin", "antrean"] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError && e.kode === "sesi_tidak_gagal" ? "Sesi ini sudah tidak berstatus gagal. Daftar diperbarui." : pesanGalat(e));
      void qc.invalidateQueries({ queryKey: ["admin", "antrean"] });
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sesi yang sedang diproses atau gagal. Admin hanya melihat metadata (judul, perekam, status), bukan isi rekaman atau transkrip. Daftar
        diperbarui otomatis tiap {REFRESH_MS / 1000} detik.
      </p>

      <StatusLayanan
        isPending={worker.isPending}
        isError={worker.isError}
        aktif={worker.data?.aktif ?? false}
        detakTerakhir={worker.data?.detakTerakhir ?? null}
        adaMenunggu={adaMenunggu}
      />

      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorNotice error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState title="Antrean kosong" hint="Tidak ada sesi yang sedang diproses atau gagal. Sesi baru muncul di sini setelah perekam menekan selesai." />
      ) : (
        <ul className="space-y-3">
          {q.data.map((s) => {
            const status = STATUS_SESI[s.status as StatusSesi];
            const gagal = s.status === "gagal";
            const Ikon = s.tipeSesi === "supervisi_kelas" ? GraduationCapIcon : UsersIcon;
            return (
              <li key={s.uuid}>
                <Card className="gap-3 rounded-2xl p-4">
                  <div className="flex gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                      <Ikon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 font-semibold leading-snug">{s.judul}</p>
                        <Badge variant={gagal ? "destructive" : "secondary"} className="shrink-0">
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {s.perekam.name} · {formatWaktu(s.createdAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Percobaan: <span className="font-mono tabular-nums">{s.percobaan}</span>
                        {s.cobaLagiSetelah && !gagal && (
                          <span className="inline-flex items-center gap-1">
                            {" "}
                            · <ClockIcon className="size-3" aria-hidden /> dicoba lagi setelah {formatWaktu(s.cobaLagiSetelah)}
                          </span>
                        )}
                      </p>
                      {s.status === "mentranskrip" && s.progresSelesai !== null && s.progresTotal !== null && (
                        <p className="text-xs text-muted-foreground">
                          Bagian <span className="font-mono tabular-nums">{s.progresSelesai}/{s.progresTotal}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {s.galat && <p className="break-words rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{s.galat}</p>}
                  {gagal && (
                    <Button variant="outline" disabled={ulangi.isPending} onClick={() => ulangi.mutate(s.uuid)}>
                      {ulangi.isPending && ulangi.variables === s.uuid ? "Mengulang…" : "Ulangi pemrosesan"}
                    </Button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusLayanan({
  isPending,
  isError,
  aktif,
  detakTerakhir,
  adaMenunggu,
}: {
  isPending: boolean;
  isError: boolean;
  aktif: boolean;
  detakTerakhir: string | null;
  adaMenunggu: boolean;
}) {
  if (isPending) return <Skeleton className="h-16 w-full rounded-2xl" />;
  if (isError) {
    return <p className="rounded-2xl border px-4 py-3 text-sm text-muted-foreground">Status layanan pemrosesan tidak bisa dimuat. Akan dicoba lagi otomatis.</p>;
  }
  return (
    <div className="space-y-3" aria-live="polite">
      <Card className="flex-row items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <div className="min-w-0">
          <p className="font-semibold">Layanan pemrosesan</p>
          <p className="text-sm text-muted-foreground">
            {detakTerakhir ? `Terakhir terdeteksi ${formatWaktu(detakTerakhir)}` : "Belum pernah terdeteksi"}
          </p>
        </div>
        {aktif ? (
          <Badge className="shrink-0 bg-success text-success-foreground">Aktif</Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0">
            Tidak terdeteksi
          </Badge>
        )}
      </Card>
      {!aktif && adaMenunggu && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Layanan pemrosesan tidak aktif</AlertTitle>
          <AlertDescription>
            Sesi yang menunggu tidak akan diproses. Jalankan <code className="font-mono">pnpm --filter @kalam/api worker</code> di server, atau
            pastikan WORKER_INLINE tidak dimatikan dan API berjalan.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
