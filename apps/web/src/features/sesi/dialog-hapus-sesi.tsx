import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangleIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, ok, pesanGalat } from "@/lib/api";
import type { StatusSesi } from "@/lib/format";

export function TombolHapusSesi({
  uuid,
  judul,
  status,
  keBeranda = false,
  varian = "outline",
  hanyaIkon = false,
}: {
  uuid: string;
  judul: string;
  status: StatusSesi;
  keBeranda?: boolean;
  varian?: "outline" | "ghost" | "destructive";
  hanyaIkon?: boolean;
}) {
  const [buka, setBuka] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const sudahSelesai = status === "selesai";

  const hapus = useMutation({
    mutationFn: async () => {
      return ok(await api.sesi[":uuid"].$delete({ param: { uuid } }));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sesi"] });
      toast.success(
        sudahSelesai
          ? "Rapat selesai dan audio di Cloudflare R2 berhasil dihapus permanen."
          : "Sesi rapat yang belum selesai berhasil dibersihkan dari R2."
      );
      setBuka(false);
      if (keBeranda) {
        void navigate({ to: "/" });
      }
    },
    onError: (err) => {
      toast.error(`Gagal menghapus rapat: ${pesanGalat(err)}`);
    },
  });

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button
          variant={varian}
          size={hanyaIkon ? "icon" : "sm"}
          className={
            hanyaIkon
              ? "size-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              : "text-destructive hover:bg-destructive/10 hover:text-destructive"
          }
          title={sudahSelesai ? "Hapus rapat selesai" : "Hapus rapat"}
          aria-label="Hapus rapat"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <Trash2Icon className={hanyaIkon ? "size-3.5" : "size-4"} />
          {!hanyaIkon && <span>Hapus</span>}
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            {sudahSelesai && <AlertTriangleIcon className="size-5 shrink-0 text-destructive" />}
            <span>{sudahSelesai ? "Konfirmasi Hapus Rapat Selesai" : "Hapus Rapat Belum Selesai?"}</span>
          </DialogTitle>
          <DialogDescription>
            {sudahSelesai ? (
              <span className="block space-y-3 text-left">
                <span>
                  Rapat <strong>"{judul}"</strong> telah selesai dan memiliki dokumen notulen resmi. Apakah Anda yakin
                  ingin menghapus permanen sesi ini dari ruma. beserta berkas audio di <strong>Cloudflare R2</strong>?
                </span>
                <span className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-medium text-emerald-800">
                  <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                  <span>
                    <strong>Catatan:</strong> Berkas notulen Google Docs dan rekaman audio yang sudah dikirim ke{" "}
                    <strong>Google Drive</strong> tetap <strong>AMAN</strong> dan <strong>TIDAK akan terhapus</strong>.
                  </span>
                </span>
                <span className="block font-semibold text-destructive">
                  Tindakan penghapusan di ruma. ini tidak dapat dibatalkan.
                </span>
              </span>
            ) : (
              <>
                Rapat <strong>"{judul}"</strong> belum selesai diproses. Apakah Anda ingin menghapus sesi ini? Seluruh
                potongan rekaman audio yang tersimpan di <strong>Cloudflare R2</strong> akan dibersihkan.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={hapus.isPending}
            onClick={() => setBuka(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              hapus.mutate();
            }}
            disabled={hapus.isPending}
          >
            {hapus.isPending ? "Menghapus..." : sudahSelesai ? "Hapus Permanen" : "Hapus Sesi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
