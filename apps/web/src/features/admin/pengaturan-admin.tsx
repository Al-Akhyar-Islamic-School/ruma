import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorNotice, PageLoading } from "@/components/app/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, ok, pesanGalat } from "@/lib/api";
import { formatWaktu } from "@/lib/format";

export function PengaturanAdmin() {
  const qc = useQueryClient();
  const [konfirmasi, setKonfirmasi] = useState(false);
  const q = useQuery({ queryKey: ["admin", "pengaturan"], queryFn: async () => ok(await api.admin.pengaturan.$get()) });

  const ubah = useMutation({
    mutationFn: async (aktif: boolean) => ok(await api.admin.pengaturan.$patch({ json: { modul_supervisi: aktif } })),
    onSuccess: (d) => {
      toast.success(d.modulSupervisi ? "Modul supervisi dinyalakan" : "Modul supervisi dimatikan");
    },
    onError: (e) => toast.error(pesanGalat(e)),
    onSettled: () => {
      // Saklar ini memengaruhi profil (`me.modul`) dan semua daftar sesi/permintaan.
      for (const key of [["admin", "pengaturan"], ["me"], ["sesi"], ["admin"], ["permintaan"]]) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });

  if (q.isPending) return <PageLoading />;
  if (q.isError) return <ErrorNotice error={q.error} onRetry={() => q.refetch()} />;

  const aktif = ubah.isPending && ubah.variables !== undefined ? ubah.variables : q.data.modulSupervisi;
  const { terakhirDiubah } = q.data;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Pengaturan fitur untuk seluruh pengguna. Hanya super admin yang bisa mengubahnya.</p>

      <Card className="gap-4 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">Modul supervisi kelas</p>
          <Badge className={aktif ? "shrink-0 bg-success text-success-foreground" : "shrink-0"} variant={aktif ? "default" : "secondary"}>
            {aktif ? "Aktif" : "Nonaktif"}
          </Badge>
        </div>

        <div className="flex min-h-12 items-center justify-between gap-3">
          <Label htmlFor="saklar-supervisi" className="flex-1 text-sm font-medium">
            Aktifkan modul supervisi kelas
          </Label>
          <Switch
            id="saklar-supervisi"
            checked={aktif}
            disabled={ubah.isPending}
            onCheckedChange={(v) => (v ? ubah.mutate(true) : setKonfirmasi(true))}
          />
        </div>

        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Saat nonaktif, semua sesi dan permintaan supervisi disembunyikan dari semua pengguna, termasuk admin dan super admin.</li>
          <li>Supervisi baru tidak bisa dibuat atau diajukan.</li>
          <li>Data tidak dihapus. Semuanya muncul lagi saat modul dinyalakan.</li>
          <li>Rekaman supervisi yang sudah diunggah tetap selesai diproses di latar belakang.</li>
        </ul>

        {terakhirDiubah && (
          <p className="text-xs text-muted-foreground">
            Terakhir diubah{terakhirDiubah.oleh ? ` oleh ${terakhirDiubah.oleh}` : ""} · {formatWaktu(terakhirDiubah.pada)}
          </p>
        )}
      </Card>

      <Dialog open={konfirmasi} onOpenChange={setKonfirmasi}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Matikan modul supervisi?</DialogTitle>
            <DialogDescription>
              Semua sesi dan permintaan supervisi langsung hilang dari daftar semua pengguna dan supervisi baru tidak bisa dibuat. Data tetap
              tersimpan dan muncul lagi saat modul dinyalakan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKonfirmasi(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setKonfirmasi(false);
                ubah.mutate(false);
              }}
            >
              Matikan modul
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
