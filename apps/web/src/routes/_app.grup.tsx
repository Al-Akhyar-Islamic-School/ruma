import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorNotice, ListSkeleton } from "@/components/app/feedback";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GrupSheet } from "@/features/undangan/grup-sheet";
import { api, ok, pesanGalat } from "@/lib/api";

export const Route = createFileRoute("/_app/grup")({ component: HalamanGrup });

type GrupRingkas = { id: number; nama: string; jumlahAnggota: number };

function HalamanGrup() {
  const qc = useQueryClient();
  const [editorBuka, setEditorBuka] = useState(false);
  const [editorId, setEditorId] = useState<number | null>(null);
  const [dihapus, setDihapus] = useState<GrupRingkas | null>(null);

  const daftar = useQuery({ queryKey: ["grup"], queryFn: async () => ok(await api.grup.$get()) });

  const hapus = useMutation({
    mutationFn: async (g: GrupRingkas) => ok(await api.grup[":id"].$delete({ param: { id: String(g.id) } })),
    onSuccess: (_, g) => {
      toast.success(`Grup ${g.nama} dihapus.`);
      setDihapus(null);
    },
    onError: (e) => toast.error(pesanGalat(e)),
    onSettled: () => {
      // Undangan sesi lewat grup ini ikut hilang di server, jadi cache sesi (undangan, daftar dibagikan) tidak lagi akurat.
      void qc.invalidateQueries({ queryKey: ["sesi"] });
      return qc.invalidateQueries({ queryKey: ["grup"] });
    },
  });

  const bukaEditor = (id: number | null) => {
    setEditorId(id);
    setEditorBuka(true);
  };

  return (
    <div className="space-y-5 pb-36">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Grup undangan</h1>
        <p className="text-sm text-muted-foreground">
          Buat grup sekali lalu pakai di banyak rekaman: mengubah anggota langsung berlaku di semua rekaman yang memakainya, dan menghapus grup
          mencabut akses yang diberikan lewat grup itu.
        </p>
      </header>

      {daftar.isPending ? (
        <ListSkeleton rows={3} />
      ) : daftar.isError ? (
        <ErrorNotice error={daftar.error} onRetry={() => void daftar.refetch()} />
      ) : daftar.data.length === 0 ? (
        <EmptyState
          title="Belum ada grup"
          hint="Kumpulkan orang yang sering Anda undang bersama, misalnya tim kurikulum atau pimpinan unit. Tekan Buat grup di bawah untuk memulai."
        />
      ) : (
        <ul className="space-y-3">
          {daftar.data.map((g) => (
            <li key={g.id}>
              <Card className="flex-row items-center gap-1 rounded-2xl py-2 pr-2 pl-2">
                <button
                  type="button"
                  onClick={() => bukaEditor(g.id)}
                  className="min-h-12 min-w-0 flex-1 rounded-xl px-3 py-1 text-left transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  aria-label={`Ubah grup ${g.nama}`}
                >
                  <span className="block truncate text-base font-semibold">{g.nama}</span>
                  <span className="block text-sm text-muted-foreground">{g.jumlahAnggota} anggota</span>
                </button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Hapus grup ${g.nama}`} onClick={() => setDihapus(g)}>
                  <Trash2Icon aria-hidden />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background/90 to-transparent px-4 pt-10 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-3xl">
          <Button type="button" size="lg" className="pointer-events-auto w-full" onClick={() => bukaEditor(null)}>
            <PlusIcon aria-hidden />
            Buat grup
          </Button>
        </div>
      </div>

      <GrupSheet id={editorId} open={editorBuka} onOpenChange={setEditorBuka} />

      <Dialog open={dihapus !== null} onOpenChange={(o) => !o && !hapus.isPending && setDihapus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus grup {dihapus?.nama}?</DialogTitle>
            <DialogDescription>
              Semua anggota grup ini kehilangan akses ke rekaman yang Anda bagikan lewat grup tersebut. Anggota yang juga diundang langsung atau lewat
              unit tetap bisa membaca. Grup yang sudah dihapus tidak bisa dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={hapus.isPending} onClick={() => setDihapus(null)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={hapus.isPending}
              onClick={() => {
                if (dihapus) hapus.mutate(dihapus);
              }}
            >
              {hapus.isPending ? "Menghapus…" : "Hapus grup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
