import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { ErrorNotice, PageLoading } from "@/components/app/feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError, api, ok, pesanGalat } from "@/lib/api";
import { formatWaktu } from "@/lib/format";

const UNIT = ["TK", "SD", "SMP", "SMA"] as const;

function pesanSinkron(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.kode === "simgtk_belum_dikonfigurasi") {
      return "Koneksi SIM-GTK belum diatur. Isi SIMGTK_API_URL dan SIMGTK_TOKEN di env server, lalu mulai ulang server.";
    }
    if (e.kode === "sinkron_sedang_berjalan") return "Sinkronisasi lain sedang berjalan. Tunggu sebentar, lalu coba lagi.";
    if (e.kode === "sinkron_gagal") {
      const pesan = e.body && typeof e.body === "object" && "pesan" in e.body && typeof e.body.pesan === "string" ? e.body.pesan : null;
      return `Sinkronisasi gagal${pesan ? `: ${pesan}` : "."} Data GTK yang ada tidak diubah.`;
    }
  }
  return pesanGalat(e);
}

function HitungUnit({ perUnit }: { perUnit: Record<string, number> }) {
  return (
    <dl className="grid grid-cols-4 gap-2 text-center">
      {UNIT.map((u) => (
        <div key={u} className="rounded-xl bg-muted px-2 py-2">
          <dt className="text-xs font-semibold text-muted-foreground">{u}</dt>
          <dd className="font-mono text-lg font-semibold tabular-nums">{perUnit[u] ?? 0}</dd>
        </div>
      ))}
    </dl>
  );
}

export function GtkAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "gtk"], queryFn: async () => ok(await api.admin.gtk.$get()) });

  const sinkron = useMutation({
    mutationFn: async () => ok(await api.admin.gtk.sinkron.$post()),
    onSuccess: (d) => {
      toast.success(`Sinkronisasi selesai: ${d.total} GTK.`);
      void qc.invalidateQueries({ queryKey: ["admin", "gtk"] });
      void qc.invalidateQueries({ queryKey: ["gtk"] });
    },
  });

  if (q.isPending) return <PageLoading />;
  if (q.isError) return <ErrorNotice error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  const hasil = sinkron.data;
  const unitAsing = hasil ? Object.entries(hasil.unitTidakDikenal) : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Direktori GTK (nama resmi dan unit) disalin dari SIM-GTK untuk pemilihan guru dan undangan per unit. Sinkron hanya membaca SIM-GTK; data di
        sana tidak diubah.
      </p>

      <Card className="gap-4 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">Direktori GTK</p>
            <p className="text-sm text-muted-foreground">
              Terakhir sinkron: {s.terakhirSinkron ? formatWaktu(s.terakhirSinkron) : "belum pernah"}
            </p>
          </div>
          {s.dikonfigurasi ? (
            <Badge className="shrink-0 bg-success text-success-foreground">SIM-GTK terhubung</Badge>
          ) : (
            <Badge variant="destructive" className="shrink-0">Belum dikonfigurasi</Badge>
          )}
        </div>
        <p>
          <span className="font-mono text-3xl font-extrabold tabular-nums">{s.total}</span>
          <span className="ml-2 text-sm text-muted-foreground">GTK tercatat</span>
        </p>
        <HitungUnit perUnit={s.perUnit} />

        {!s.dikonfigurasi && (
          <p className="text-sm text-muted-foreground">
            Koneksi SIM-GTK belum diatur. Isi SIMGTK_API_URL dan SIMGTK_TOKEN di env server, lalu mulai ulang server.
          </p>
        )}
        <Button size="lg" disabled={!s.dikonfigurasi || sinkron.isPending} onClick={() => sinkron.mutate()}>
          <RefreshCwIcon className={sinkron.isPending ? "animate-spin" : undefined} aria-hidden />
          {sinkron.isPending ? "Menyinkronkan…" : "Sinkron sekarang"}
        </Button>
      </Card>

      <div aria-live="polite" className="space-y-3">
        {sinkron.isError && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Sinkronisasi tidak berhasil</AlertTitle>
            <AlertDescription>{pesanSinkron(sinkron.error)}</AlertDescription>
          </Alert>
        )}

        {hasil && !sinkron.isPending && (
          <Card className="gap-3 rounded-2xl p-4">
            <p className="font-semibold">Hasil sinkron terakhir</p>
            <p className="text-sm">
              <span className="font-mono font-semibold tabular-nums">{hasil.total}</span> GTK disalin ·{" "}
              <span className="font-mono font-semibold tabular-nums">{hasil.dinonaktifkan}</span> dinonaktifkan karena tidak ada lagi di SIM-GTK
            </p>
            <HitungUnit perUnit={hasil.perUnit} />
            {unitAsing.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Kode unit tidak dikenal (dilewati): {unitAsing.map(([kode, n]) => `${kode} (${n})`).join(", ")}.
              </p>
            )}
            {hasil.tanpaEmail > 0 && (
              <p className="text-sm text-muted-foreground">{hasil.tanpaEmail} data SIM-GTK dilewati karena tidak punya email.</p>
            )}
            {hasil.elemenRusak > 0 && (
              <p className="text-sm text-muted-foreground">{hasil.elemenRusak} data SIM-GTK dilewati karena formatnya rusak.</p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
