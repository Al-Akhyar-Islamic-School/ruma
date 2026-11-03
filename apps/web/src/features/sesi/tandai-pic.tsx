import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, UserXIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { type OrangGtk, PilihOrang } from "@/features/undangan/pilih-orang";
import { api, ok, pesanGalat } from "@/lib/api";
import { namaUntukPencarian } from "./payload";
import type { ItemTugas } from "./tugas";

const MIN_HURUF_SARAN = 2;

/**
 * Sheet bawah "Tandai penanggung jawab": saran dari nama yang ditulis AI, pencarian manual, dan lepas tanda.
 * Server menolak non-perekam (404); komponen ini hanya dipasang untuk perekam.
 */
export function TandaiPicSheet({
  uuid,
  tugas,
  open,
  onOpenChange,
  onUndang,
}: {
  uuid: string;
  /** Tugas yang sedang ditandai; dipertahankan selama sheet menutup agar isinya tidak berkedip. */
  tugas: ItemTugas | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Membuka sheet undangan sesi (untuk PIC yang belum bisa membaca rekaman). */
  onUndang: () => void;
}) {
  const qc = useQueryClient();
  const [manual, setManual] = useState<OrangGtk | null>(null);
  const kataSaran = tugas ? namaUntukPencarian(tugas.picNama) : "";
  const adaSaran = kataSaran.length >= MIN_HURUF_SARAN;

  const saran = useQuery({
    queryKey: ["gtk", "semua", kataSaran],
    queryFn: async () => ok(await api.gtk.orang.$get({ query: { cari: kataSaran } })),
    enabled: open && adaSaran,
  });

  const tandai = useMutation({
    mutationFn: async (picEmail: string | null) => {
      if (!tugas) throw new Error("Tugas belum dipilih.");
      return ok(
        await api.sesi[":uuid"].tugas[":id"].$patch({
          param: { uuid, id: String(tugas.id) },
          json: { pic_email: picEmail },
        }),
      );
    },
    onSuccess: async (hasil) => {
      const nama = hasil.picNamaResmi ?? hasil.picEmail;
      ubahBuka(false);
      if (nama) toast.success(`${nama} ditandai sebagai PIC`);
      else toast.success("Tanda PIC dilepas");
      if (nama && hasil.bisaMembaca === false) {
        toast.info(`${nama} belum bisa membaca rekaman ini`, {
          description: "Undang agar PIC bisa melihat notulen dan tugasnya.",
          action: { label: "Undang", onClick: onUndang },
          duration: 10_000,
        });
      }
      await qc.invalidateQueries({ queryKey: ["sesi", uuid, "dokumen"] });
    },
    onError: (e) => toast.error(pesanGalat(e)),
  });

  const pilih = (o: OrangGtk | null) => {
    setManual(o);
    if (o) tandai.mutate(o.email);
  };

  const ubahBuka = (o: boolean) => {
    if (!o) setManual(null);
    onOpenChange(o);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !tandai.isPending && ubahBuka(o)}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="p-0 pr-10">
          <SheetTitle>Tandai penanggung jawab</SheetTitle>
          <SheetDescription className="line-clamp-3">{tugas?.tugas}</SheetDescription>
        </SheetHeader>

        <section aria-labelledby="judul-saran" className="space-y-2">
          <h3 id="judul-saran" className="text-sm font-semibold">
            Saran dari rekaman
          </h3>
          {!adaSaran ? (
            <p className="text-sm text-muted-foreground">
              AI tidak menyebut nama yang bisa dicari{tugas?.picNama ? ` ("${tugas.picNama}")` : ""}. Cari manual di bawah.
            </p>
          ) : saran.isPending ? (
            <div role="status" aria-label="Mencari saran" className="space-y-2">
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
          ) : saran.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {pesanGalat(saran.error)} Cari manual di bawah.
            </p>
          ) : saran.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tidak ada orang yang cocok dengan "{tugas?.picNama}". Cari manual di bawah.
            </p>
          ) : (
            <ul className="space-y-2">
              {saran.data.map((o) => (
                <li key={o.email}>
                  <button
                    type="button"
                    disabled={tandai.isPending}
                    onClick={() => tandai.mutate(o.email)}
                    className="flex min-h-14 w-full flex-col justify-center rounded-2xl border px-4 py-2 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                  >
                    <span className="font-medium leading-snug">{o.namaResmi}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {o.email}
                      {o.units.length > 0 ? ` · ${o.units.join(", ")}` : o.sumber === "pengguna" ? " · Pengguna" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <PilihOrang
          label="Cari orang lain"
          placeholder="Cari nama atau email"
          value={manual}
          onChange={pilih}
        />

        {tugas?.picEmail && (
          <Button variant="outline" disabled={tandai.isPending} onClick={() => tandai.mutate(null)}>
            {tandai.isPending ? <Loader2Icon className="animate-spin" /> : <UserXIcon />}
            Lepas tanda
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
