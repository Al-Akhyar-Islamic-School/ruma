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
type GrupKeanggotaan = { id: number; nama: string; pemilik: string; jumlahAnggota: number };

function HalamanGrup() {
  const qc = useQueryClient();
  const [editorBuka, setEditorBuka] = useState(false);
  const [editorId, setEditorId] = useState<number | null>(null);
  const [dihapus, setDihapus] = useState<GrupRingkas | null>(null);
  const [keluarDari, setKeluarDari] = useState<GrupKeanggotaan | null>(null);

  const daftar = useQuery({ queryKey: ["grup"], queryFn: async () => ok(await api.grup.$get()) });
  const keanggotaan = useQuery({ queryKey: ["grup", "keanggotaan"], queryFn: async () => ok(await api.grup.keanggotaan.$get()) });

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
      // Awalan ["grup"] juga mencakup ["grup", id] dan ["grup", "keanggotaan"].
      return qc.invalidateQueries({ queryKey: ["grup"] });
    },
  });

  const keluar = useMutation({
    mutationFn: async (g: GrupKeanggotaan) => ok(await api.grup.keanggotaan[":id"].$delete({ param: { id: String(g.id) } })),
    onSuccess: (_, g) => {
      toast.success(`Anda keluar dari grup ${g.nama}`);
      setKeluarDari(null);
    },
    onError: (e) => toast.error(pesanGalat(e)),
    onSettled: () => {
      // Akses ke rekaman yang diundang lewat grup ini hilang, jadi daftar "Dibagikan" dan detail sesi ikut berubah.
      void qc.invalidateQueries({ queryKey: ["sesi"] });
      return qc.invalidateQueries({ queryKey: ["grup", "keanggotaan"] });
    },
  });

  const bukaEditor = (id: number | null) => {
    setEditorId(id);
    setEditorBuka(true);
  };

  return (
    <div className="space-y-5 pb-36">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">Grup undangan</h1>
          <p className="text-sm text-muted-foreground">
            Kumpulkan orang yang sering diundang bersama ke rekaman rapat.
          </p>
        </div>
        <Button type="button" onClick={() => bukaEditor(null)} className="h-11 gap-1.5 self-start rounded-xl sm:self-auto">
          <PlusIcon className="size-4" aria-hidden />
          <span>Buat grup</span>
        </Button>
      </header>
      <section aria-labelledby="judul-grup-saya" className="space-y-3">
        <div className="space-y-1">
          <h2 id="judul-grup-saya" className="text-base font-semibold">
            Grup saya
          </h2>
          <p className="text-sm text-muted-foreground">
            Buat grup sekali lalu pakai di banyak rekaman: mengubah anggota langsung berlaku di semua rekaman yang memakainya, dan menghapus grup
            mencabut akses yang diberikan lewat grup itu.
          </p>
        </div>

        {daftar.isPending ? (
          <ListSkeleton rows={3} />
        ) : daftar.isError ? (
          <ErrorNotice error={daftar.error} onRetry={() => void daftar.refetch()} />
        ) : daftar.data.length === 0 ? (
          <EmptyState
            title="Belum ada grup"
            hint="Kumpulkan orang yang sering Anda undang bersama, misalnya tim kurikulum atau pimpinan unit."
            action={
              <Button type="button" onClick={() => bukaEditor(null)} className="mt-2 h-10 gap-1.5 rounded-xl">
                <PlusIcon className="size-4" aria-hidden />
                <span>Buat grup baru</span>
              </Button>
            }
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
      </section>

      <section aria-labelledby="judul-keanggotaan" className="space-y-3">
        <div className="space-y-1">
          <h2 id="judul-keanggotaan" className="text-base font-semibold">
            Grup yang menyertakan Anda
          </h2>
          <p className="text-sm text-muted-foreground">
            Anda menjadi anggota grup ini. Pemilik grup dapat mengundang grup ke rekaman, sehingga Anda ikut bisa membacanya.
          </p>
        </div>

        {keanggotaan.isPending ? (
          <ListSkeleton rows={2} />
        ) : keanggotaan.isError ? (
          <ErrorNotice error={keanggotaan.error} onRetry={() => void keanggotaan.refetch()} title="Tidak bisa memuat keanggotaan grup" />
        ) : keanggotaan.data.length === 0 ? (
          <EmptyState title="Anda belum menjadi anggota grup mana pun." />
        ) : (
          <ul className="space-y-3">
            {keanggotaan.data.map((g) => (
              <li key={g.id}>
                <Card className="gap-3 rounded-2xl px-4 py-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-base font-semibold">{g.nama}</p>
                    <p className="truncate text-sm text-muted-foreground">Dibuat oleh {g.pemilik}</p>
                    <p className="text-sm text-muted-foreground">{g.jumlahAnggota} anggota</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setKeluarDari(g)}>
                    Keluar dari grup
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

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

      <Dialog open={keluarDari !== null} onOpenChange={(o) => !o && !keluar.isPending && setKeluarDari(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keluar dari grup {keluarDari?.nama}?</DialogTitle>
            <DialogDescription>
              Anda tidak akan lagi menerima akses ke rekaman yang diundang lewat grup {keluarDari?.nama}. Pemilik grup bisa menambahkan Anda kembali.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={keluar.isPending} onClick={() => setKeluarDari(null)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={keluar.isPending}
              onClick={() => {
                if (keluarDari) keluar.mutate(keluarDari);
              }}
            >
              {keluar.isPending ? "Keluar…" : "Keluar dari grup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
