import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorNotice, ListSkeleton } from "@/components/app/feedback";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { api, ok, pesanGalat } from "@/lib/api";
import { type KategoriRapat, kategoriQuery } from "@/lib/kategori";

const NAMA_MAKS = 100;

type Ubahan = { nama?: string; terbatas?: boolean; aktif?: boolean };

export function KategoriAdmin() {
  const qc = useQueryClient();
  const q = useQuery(kategoriQuery);
  const [nama, setNama] = useState("");
  const [tertutup, setTertutup] = useState(false);
  const [ubahNama, setUbahNama] = useState<KategoriRapat | null>(null);

  const tambah = useMutation({
    mutationFn: async () => ok(await api.admin.kategori.$post({ json: { nama: nama.trim(), terbatas: tertutup } })),
    onSuccess: () => {
      toast.success("Kategori ditambahkan");
      setNama("");
      setTertutup(false);
      void qc.invalidateQueries({ queryKey: ["kategori"] });
    },
  });

  const ubah = useMutation({
    mutationFn: async (v: { id: number; ubahan: Ubahan; pesan: string }) =>
      ok(await api.admin.kategori[":id"].$patch({ param: { id: String(v.id) }, json: v.ubahan })),
    onSuccess: (_d, v) => toast.success(v.pesan),
    onError: (e) => toast.error(pesanGalat(e)),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["kategori"] }),
  });

  const namaBersih = nama.trim();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (namaBersih && !tambah.isPending) tambah.mutate();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Kategori yang dipilih perekam saat membuat rapat. Kategori tertutup hanya bisa dibuka untuk orang atau grup tertentu, bukan per unit atau
        seluruh organisasi.
      </p>

      <Card className="rounded-2xl p-4">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kategori-nama">Nama kategori baru</Label>
            <Input
              id="kategori-nama"
              className="h-12"
              value={nama}
              maxLength={NAMA_MAKS}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Mis. Rapat wali murid"
            />
          </div>
          <div className="flex min-h-12 items-start justify-between gap-3">
            <Label htmlFor="kategori-tertutup" className="flex-1 flex-col items-start gap-0.5 text-sm font-medium">
              Tertutup
              <span className="text-xs font-normal text-muted-foreground">
                Hanya bisa dibuka untuk orang atau grup tertentu, bukan per unit atau seluruh organisasi.
              </span>
            </Label>
            <Switch id="kategori-tertutup" checked={tertutup} onCheckedChange={setTertutup} />
          </div>
          {tambah.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{pesanGalat(tambah.error)}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={!namaBersih || tambah.isPending}>
            {tambah.isPending ? "Menambahkan…" : "Tambah kategori"}
          </Button>
        </form>
      </Card>

      <p className="text-xs text-muted-foreground">
        Menonaktifkan kategori hanya menyembunyikannya dari pilihan baru; rekaman lama tetap berlabel. Mengubah "Tertutup" hanya berlaku untuk
        undangan baru, undangan yang sudah dibuat tidak berubah.
      </p>

      {q.isPending ? (
        <ListSkeleton rows={3} />
      ) : q.isError ? (
        <ErrorNotice error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState title="Belum ada kategori" hint="Tambahkan kategori pertama lewat formulir di atas." />
      ) : (
        <ul className="space-y-3">
          {q.data.map((k) => {
            const sibuk = ubah.isPending && ubah.variables?.id === k.id;
            return (
              <li key={k.id}>
                <Card className="gap-3 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{k.nama}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {k.terbatas && <Badge variant="outline">Tertutup</Badge>}
                        {!k.aktif && <Badge variant="secondary">Nonaktif</Badge>}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0" onClick={() => setUbahNama(k)}>
                      <PencilIcon aria-hidden /> Ubah nama
                    </Button>
                  </div>
                  <div className="flex min-h-12 items-center justify-between gap-3">
                    <Label htmlFor={`aktif-${k.id}`} className="flex-1 text-sm font-medium">
                      Aktif
                    </Label>
                    <Switch
                      id={`aktif-${k.id}`}
                      checked={k.aktif}
                      disabled={sibuk}
                      onCheckedChange={(v) =>
                        ubah.mutate({ id: k.id, ubahan: { aktif: v }, pesan: v ? "Kategori diaktifkan" : "Kategori dinonaktifkan" })
                      }
                    />
                  </div>
                  <div className="flex min-h-12 items-center justify-between gap-3">
                    <Label htmlFor={`tertutup-${k.id}`} className="flex-1 text-sm font-medium">
                      Tertutup
                    </Label>
                    <Switch
                      id={`tertutup-${k.id}`}
                      checked={k.terbatas}
                      disabled={sibuk}
                      onCheckedChange={(v) =>
                        ubah.mutate({
                          id: k.id,
                          ubahan: { terbatas: v },
                          pesan: "Pengaturan tertutup diubah. Hanya undangan baru yang mengikuti aturan ini.",
                        })
                      }
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={ubahNama !== null} onOpenChange={(o) => !o && setUbahNama(null)}>
        <SheetContent side="bottom" className="gap-0 rounded-t-3xl p-0">
          {ubahNama && (
            <>
              <SheetHeader className="p-5 pb-3">
                <SheetTitle className="text-lg">Ubah nama kategori</SheetTitle>
                <SheetDescription>Nama baru langsung tampil di semua rekaman dengan kategori ini.</SheetDescription>
              </SheetHeader>
              <FormUbahNama key={ubahNama.id} k={ubahNama} onSelesai={() => setUbahNama(null)} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FormUbahNama({ k, onSelesai }: { k: KategoriRapat; onSelesai: () => void }) {
  const qc = useQueryClient();
  const [nama, setNama] = useState(k.nama);
  const bersih = nama.trim();

  const simpan = useMutation({
    mutationFn: async () => ok(await api.admin.kategori[":id"].$patch({ param: { id: String(k.id) }, json: { nama: bersih } })),
    onSuccess: () => {
      toast.success("Nama kategori disimpan");
      void qc.invalidateQueries({ queryKey: ["kategori"] });
      onSelesai();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (bersih && bersih !== k.nama && !simpan.isPending) simpan.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-4 px-5 pb-5">
      <div className="space-y-2">
        <Label htmlFor="ubah-nama">Nama kategori</Label>
        <Input id="ubah-nama" className="h-12" value={nama} maxLength={NAMA_MAKS} onChange={(e) => setNama(e.target.value)} />
      </div>
      {simpan.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{pesanGalat(simpan.error)}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={!bersih || bersih === k.nama || simpan.isPending}>
        {simpan.isPending ? "Menyimpan…" : "Simpan nama"}
      </Button>
    </form>
  );
}
