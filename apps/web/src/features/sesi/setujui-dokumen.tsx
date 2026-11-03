import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleCheckIcon, Loader2Icon } from "lucide-react";
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
import { api, ApiError, ok, pesanGalat } from "@/lib/api";

/** Tombol "Setujui dokumen" + dialog konfirmasi. Hanya untuk perekam, selama dokumen berstatus draf. */
export function SetujuiDokumen({ uuid }: { uuid: string }) {
  const [buka, setBuka] = useState(false);
  const qc = useQueryClient();
  const dokumenKey = ["sesi", uuid, "dokumen"];

  const setujui = useMutation({
    mutationFn: async () => ok(await api.sesi[":uuid"].dokumen.setujui.$post({ param: { uuid } })),
    onSuccess: async () => {
      toast.success("Dokumen disetujui");
      setBuka(false);
      await qc.invalidateQueries({ queryKey: dokumenKey });
    },
    onError: async (e) => {
      if (e instanceof ApiError && e.kode === "tidak_ada_draf") {
        // Sudah disetujui dari tab/perangkat lain: sinkronkan tampilan.
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
        <DialogFooter>
          <Button variant="outline" disabled={setujui.isPending} onClick={() => setBuka(false)}>
            Batal
          </Button>
          <Button variant="success" disabled={setujui.isPending} onClick={() => setujui.mutate()}>
            {setujui.isPending && <Loader2Icon className="animate-spin" />}
            Setujui dokumen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
