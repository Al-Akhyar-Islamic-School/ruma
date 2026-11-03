import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheckIcon, CloudIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, ApiError, ok, pesanGalat } from "@/lib/api";
import { useMe } from "@/lib/auth";

/** Tombol "Setujui dokumen" + dialog konfirmasi dengan opsi otomatis ekspor ke Google Drive. */
export function SetujuiDokumen({ uuid }: { uuid: string }) {
  const me = useMe();
  const [buka, setBuka] = useState(false);
  // Default switch aktif jika akun pengguna sudah menyambungkan Drive
  const [eksporDrive, setEksporDrive] = useState(me.driveTersambung);
  const qc = useQueryClient();
  const dokumenKey = ["sesi", uuid, "dokumen"];
  const docsStatusKey = ["sesi", uuid, "google-docs-status"];

  const setujui = useMutation({
    mutationFn: async () => {
      // 1. Setujui dokumen di database ruma.
      await ok(await api.sesi[":uuid"].dokumen.setujui.$post({ param: { uuid } }));

      // 2. Jika opsi ekspor dicentang dan drive tersambung, jalankan ekspor langsung
      if (eksporDrive && me.driveTersambung) {
        try {
          const resDocs = await ok(
            await api.sesi[":uuid"].dokumen["google-docs"].ekspor.$post({ param: { uuid } })
          );
          return { docsUrl: resDocs.url };
        } catch (e) {
          console.error("Ekspor Google Docs latar belakang gagal:", e);
        }
      }
      return { docsUrl: null };
    },
    onSuccess: async (hasil) => {
      toast.success("Dokumen disetujui");
      if (hasil.docsUrl) {
        toast.success("Notulensi berhasil diekspor ke Google Docs!");
        window.open(hasil.docsUrl, "_blank", "noopener,noreferrer");
      }
      setBuka(false);
      await qc.invalidateQueries({ queryKey: dokumenKey });
      await qc.invalidateQueries({ queryKey: docsStatusKey });
      await qc.invalidateQueries({ queryKey: ["pengetahuan"] });
    },
    onError: async (e) => {
      if (e instanceof ApiError && e.kode === "tidak_ada_draf") {
        toast.info("Dokumen ini sudah disetujui");
        setBuka(false);
        await qc.invalidateQueries({ queryKey: dokumenKey });
        return;
      }
      toast.error(pesanGalat(e));
    },
  });

  return (
    <Dialog open={buka} onOpenChange={(o) => !setujui.isPending && setBuka(o)}>
      <DialogTrigger asChild>
        <Button variant="success" size="sm">
          <CircleCheckIcon />
          Setujui dokumen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setujui dokumen ini?</DialogTitle>
          <DialogDescription>
            Dokumen akan terlihat oleh orang yang Anda undang. Pastikan isinya sudah Anda periksa, karena ini hasil
            tulisan AI.
          </DialogDescription>
        </DialogHeader>

        {/* Opsi Ekspor ke Google Docs */}
        <div className="rounded-xl border bg-muted/40 p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="switch-drive" className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer">
                <CloudIcon className="size-4 text-primary" />
                Simpan ke Google Docs
              </Label>
              <p className="text-xs text-muted-foreground">
                {me.driveTersambung
                  ? "Otomatis simpan berkas berformat resmi ke folder 'ruma. Notulen' di Google Drive Anda."
                  : "Google Drive belum tersambung. Sambungkan akun Drive terlebih dahulu di menu Profil."}
              </p>
            </div>
            <Switch
              id="switch-drive"
              checked={eksporDrive && me.driveTersambung}
              disabled={!me.driveTersambung || setujui.isPending}
              onCheckedChange={setEksporDrive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={setujui.isPending} onClick={() => setBuka(false)}>
            Batal
          </Button>
          <Button variant="success" disabled={setujui.isPending} onClick={() => setujui.mutate()}>
            {setujui.isPending && <Loader2Icon className="animate-spin" />}
            {setujui.isPending ? "Menyetujui…" : "Setujui dokumen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
