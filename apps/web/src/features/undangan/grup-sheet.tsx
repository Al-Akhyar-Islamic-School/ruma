import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { ErrorNotice, ListSkeleton } from "@/components/app/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, ok, pesanGalat } from "@/lib/api";
import { AnggotaEditor } from "./anggota-editor";
import type { Anggota } from "./util";

const MAKS_ANGGOTA = 500;
const MAKS_NAMA = 100;

function GrupForm({
  id,
  awalNama,
  awalAnggota,
  onSelesai,
}: {
  id: number | null;
  awalNama: string;
  awalAnggota: Anggota[];
  onSelesai: () => void;
}) {
  const idNama = useId();
  const qc = useQueryClient();
  const [nama, setNama] = useState(awalNama);
  const [anggota, setAnggota] = useState<Anggota[]>(awalAnggota);
  const valid = nama.trim().length > 0 && anggota.length > 0;

  const simpan = useMutation({
    mutationFn: async () => {
      const json = { nama: nama.trim(), anggota: anggota.map((a) => a.email) };
      return id === null
        ? ok(await api.grup.$post({ json }))
        : ok(await api.grup[":id"].$put({ param: { id: String(id) }, json }));
    },
    onSuccess: () => {
      toast.success(id === null ? "Grup dibuat." : "Perubahan grup disimpan.");
      onSelesai();
    },
    onError: (e) => toast.error(pesanGalat(e)),
    // Kunci ["grup"] juga mencakup ["grup", id] (pencocokan awalan).
    onSettled: () => qc.invalidateQueries({ queryKey: ["grup"] }),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-6">
        <div className="space-y-2">
          <Label htmlFor={idNama}>Nama grup</Label>
          <Input
            id={idNama}
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            maxLength={MAKS_NAMA}
            autoComplete="off"
            placeholder="Contoh: Tim kurikulum SMP"
            className="h-12 rounded-2xl"
          />
        </div>
        <AnggotaEditor
          anggota={anggota}
          onChange={setAnggota}
          maks={MAKS_ANGGOTA}
          kosong="Belum ada anggota. Tambahkan minimal satu orang."
        />
      </div>
      <SheetFooter className="border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!valid && <p className="text-xs text-muted-foreground">Isi nama grup dan tambahkan minimal satu anggota.</p>}
        <Button type="button" size="lg" disabled={!valid || simpan.isPending} onClick={() => simpan.mutate()}>
          {simpan.isPending ? "Menyimpan…" : id === null ? "Buat grup" : "Simpan perubahan"}
        </Button>
      </SheetFooter>
    </div>
  );
}

/**
 * Memuat detail grup lalu menampilkan formulir. Komponen ini hanya hidup selama sheet terbuka dan cache-nya
 * dibuang saat ditutup (`gcTime: 0`), jadi formulir tidak pernah diisi dari data basi setelah grup diubah.
 */
function GrupUbah({ id, onSelesai }: { id: number; onSelesai: () => void }) {
  const detail = useQuery({
    queryKey: ["grup", id],
    queryFn: async () => ok(await api.grup[":id"].$get({ param: { id: String(id) } })),
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  if (detail.isPending) {
    return (
      <div className="px-4 pb-6">
        <ListSkeleton rows={3} />
      </div>
    );
  }
  if (detail.isError) {
    return (
      <div className="px-4 pb-6">
        <ErrorNotice error={detail.error} onRetry={() => void detail.refetch()} title="Tidak bisa memuat grup" />
      </div>
    );
  }
  return (
    <GrupForm
      id={id}
      awalNama={detail.data.nama}
      awalAnggota={detail.data.anggota.map((a) => ({ email: a.email, namaResmi: a.namaResmi }))}
      onSelesai={onSelesai}
    />
  );
}

/** Sheet buat (id = null) atau ubah grup undangan. Isi formulir diinisialisasi sekali dari data server saat sheet dibuka. */
export function GrupSheet({
  id,
  open,
  onOpenChange,
}: {
  id: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-3xl gap-0 rounded-t-3xl">
        <SheetHeader className="pr-14">
          <SheetTitle className="text-lg font-semibold">{id === null ? "Buat grup" : "Ubah grup"}</SheetTitle>
          <SheetDescription>
            {id === null
              ? "Beri nama grup lalu tambahkan orang yang sering Anda undang bersama."
              : "Perubahan anggota langsung berlaku di semua rekaman yang memakai grup ini."}
          </SheetDescription>
        </SheetHeader>
        {id === null ? (
          <GrupForm id={null} awalNama="" awalAnggota={[]} onSelesai={() => onOpenChange(false)} />
        ) : (
          <GrupUbah id={id} onSelesai={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  );
}
