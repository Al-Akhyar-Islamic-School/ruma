import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
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
}: {
  uuid: string;
  judul: string;
  status: StatusSesi;
  keBeranda?: boolean;
  varian?: "outline" | "ghost" | "destructive";
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
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <Trash2Icon className="size-4" />
          <span>Hapus</span>
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            {sudahSelesai ? "⚠️ Konfirmasi Hapus Rapat Selesai" : "Hapus Rapat Belum Selesai?"}
          </DialogTitle>
          <DialogDescription>
            {sudahSelesai ? (
              <>
                Rapat <strong>"{judul}"</strong> telah selesai dan memiliki dokumen notulen resmi. Apakah Anda yakin
                ingin menghapus permanen sesi ini beserta berkas audio di <strong>Cloudflare R2</strong>?
                <br />
                <br />
                <span className="font-semibold text-destructive">Tindakan ini tidak dapat dibatalkan.</span>
              </>
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
