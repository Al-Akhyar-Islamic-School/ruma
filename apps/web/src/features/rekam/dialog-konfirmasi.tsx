import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Dialog konfirmasi dua pilihan untuk tindakan yang membuang atau menghentikan rekaman. */
export function DialogKonfirmasi({
  open,
  onOpenChange,
  judul,
  deskripsi,
  labelTetap,
  labelAksi,
  onAksi,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  judul: string;
  deskripsi: ReactNode;
  /** Pilihan aman (menutup dialog tanpa tindakan). */
  labelTetap: string;
  /** Tindakan merusak/menghentikan. */
  labelAksi: string;
  onAksi: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-base">{judul}</DialogTitle>
          <DialogDescription className="space-y-2 text-sm leading-relaxed">{deskripsi}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" size="lg" onClick={onAksi}>
            {labelAksi}
          </Button>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            {labelTetap}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
