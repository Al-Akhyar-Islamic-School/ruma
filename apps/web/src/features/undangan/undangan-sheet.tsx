import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2Icon, SchoolIcon, Trash2Icon, TriangleAlertIcon, UserIcon, UsersIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorNotice, ListSkeleton } from "@/components/app/feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ok, pesanGalat } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AnggotaEditor } from "./anggota-editor";
import { type Anggota, UNIT, type Unit } from "./util";

const MAKS_ORANG = 200;

type Kategori = "pleno" | "kurikulum" | "komite" | "pimpinan";
type Mode = "orang" | "grup" | "unit" | "organisasi";
type Body =
  | { tipe: "orang"; emails: string[] }
  | { tipe: "grup"; grup_id: number }
  | { tipe: "unit"; unit: Unit }
  | { tipe: "organisasi" };

/** Satu baris undangan sesi seperti dikembalikan `GET /sesi/:uuid/undangan`. */
type Undangan = {
  id: number;
  tipe: "orang" | "grup" | "unit" | "organisasi";
  email: string | null;
  namaResmi: string | null;
  grupId: number | null;
  namaGrup: string | null;
  unit: Unit | null;
};

type DeskripsiUndangan = { utama: string; sub: string | null; ikon: typeof UserIcon };

const LABEL_MODE: Record<Mode, string> = { orang: "Orang", grup: "Grup", unit: "Unit", organisasi: "Organisasi" };

function deskripsi(u: Undangan): DeskripsiUndangan {
  switch (u.tipe) {
    case "orang":
      return u.namaResmi
        ? { utama: u.namaResmi, sub: u.email, ikon: UserIcon }
        : { utama: u.email ?? "Email tidak diketahui", sub: null, ikon: UserIcon };
    case "grup":
      return { utama: u.namaGrup ?? "Grup undangan", sub: "Grup undangan", ikon: UsersIcon };
    case "unit":
      return { utama: `Seluruh GTK ${u.unit ?? ""}`.trim(), sub: "Berdasarkan unit", ikon: SchoolIcon };
    case "organisasi":
      return { utama: "Seluruh Al Akhyar", sub: "Semua akun yang login", ikon: Building2Icon };
  }
}

function pesanHasil(b: Body, ditambahkan: number, namaGrup: string): { sukses: boolean; teks: string } {
  switch (b.tipe) {
    case "orang": {
      const total = b.emails.length;
      if (ditambahkan === 0) {
        return { sukses: false, teks: total === 1 ? "Orang ini sudah diundang sebelumnya." : "Semua orang itu sudah diundang sebelumnya." };
      }
      if (ditambahkan < total) {
        return { sukses: true, teks: `${ditambahkan} orang baru diundang. ${total - ditambahkan} lainnya sudah diundang sebelumnya.` };
      }
      return { sukses: true, teks: `${ditambahkan} orang diundang.` };
    }
    case "grup":
      return ditambahkan === 0
        ? { sukses: false, teks: `Grup ${namaGrup} sudah diundang sebelumnya.` }
        : { sukses: true, teks: `Grup ${namaGrup} diundang.` };
    case "unit":
      return ditambahkan === 0
        ? { sukses: false, teks: `Seluruh GTK ${b.unit} sudah diundang sebelumnya.` }
        : { sukses: true, teks: `Seluruh GTK ${b.unit} diundang.` };
    case "organisasi":
      return ditambahkan === 0
        ? { sukses: false, teks: "Seluruh Al Akhyar sudah diundang sebelumnya." }
        : { sukses: true, teks: "Seluruh Al Akhyar diundang." };
  }
}

/** Baris pilihan tunggal (radio asli, mudah dijangkau jempol). */
function BarisPilihan({
  name,
  checked,
  onSelect,
  sudahDiundang,
  children,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  sudahDiundang: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
        sudahDiundang ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={sudahDiundang}
        onChange={onSelect}
        className="size-5 shrink-0 accent-primary"
      />
      <div className="min-w-0 flex-1">{children}</div>
      {sudahDiundang && <Badge variant="secondary">Sudah diundang</Badge>}
    </label>
  );
}

/** Sheet kelola undangan sesi. Hanya dipakai oleh perekam (server menolak yang lain dengan 404). */
export function UndanganSheet({
  uuid,
  kategori,
  open,
  onOpenChange,
}: {
  uuid: string;
  kategori?: Kategori;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const me = useMe();
  const qc = useQueryClient();
  const pimpinan = kategori === "pimpinan";
  const mode: Mode[] = pimpinan ? ["orang", "grup"] : ["orang", "grup", "unit", "organisasi"];

  const [pilihanMode, setPilihanMode] = useState<Mode>("orang");
  const [orang, setOrang] = useState<Anggota[]>([]);
  const [grupId, setGrupId] = useState<number | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const modeAktif = mode.includes(pilihanMode) ? pilihanMode : "orang";

  const undangan = useQuery({
    queryKey: ["sesi", uuid, "undangan"],
    queryFn: async (): Promise<Undangan[]> => ok(await api.sesi[":uuid"].undangan.$get({ param: { uuid } })),
    enabled: open,
  });
  const grup = useQuery({ queryKey: ["grup"], queryFn: async () => ok(await api.grup.$get()), enabled: open });

  const diundang = undangan.data ?? [];
  const grupDiundang = new Set(diundang.flatMap((u) => (u.tipe === "grup" && u.grupId !== null ? [u.grupId] : [])));
  const unitDiundang = new Set(diundang.flatMap((u) => (u.tipe === "unit" && u.unit !== null ? [u.unit] : [])));
  const organisasiDiundang = diundang.some((u) => u.tipe === "organisasi");

  const tambah = useMutation({
    mutationFn: async (b: Body) => ok(await api.sesi[":uuid"].undangan.$post({ param: { uuid }, json: b })),
    onSuccess: (hasil, b) => {
      const namaGrup = b.tipe === "grup" ? (grup.data?.find((g) => g.id === b.grup_id)?.nama ?? "ini") : "";
      const { sukses, teks } = pesanHasil(b, hasil.ditambahkan, namaGrup);
      if (sukses) toast.success(teks);
      else toast.info(teks);
      if (b.tipe === "orang") setOrang([]);
      if (b.tipe === "grup") setGrupId(null);
      if (b.tipe === "unit") setUnit(null);
    },
    onError: (e) => toast.error(pesanGalat(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["sesi", uuid, "undangan"] }),
  });

  const cabut = useMutation({
    mutationFn: async (u: Undangan) => ok(await api.sesi[":uuid"].undangan[":id"].$delete({ param: { uuid, id: String(u.id) } })),
    onSuccess: (_, u) => toast.success(`Akses ${deskripsi(u).utama} dicabut.`),
    onError: (e) => toast.error(pesanGalat(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["sesi", uuid, "undangan"] }),
  });

  const ubahBuka = (o: boolean) => {
    if (!o) {
      setPilihanMode("orang");
      setOrang([]);
      setGrupId(null);
      setUnit(null);
    }
    onOpenChange(o);
  };

  let aksi: { label: string; body: Body | null };
  switch (modeAktif) {
    case "orang":
      aksi = {
        label: orang.length > 0 ? `Undang ${orang.length} orang` : "Undang orang",
        body: orang.length > 0 ? { tipe: "orang", emails: orang.map((a) => a.email) } : null,
      };
      break;
    case "grup":
      aksi = { label: "Undang grup", body: grupId !== null ? { tipe: "grup", grup_id: grupId } : null };
      break;
    case "unit":
      aksi = { label: unit ? `Undang seluruh GTK ${unit}` : "Undang unit", body: unit ? { tipe: "unit", unit } : null };
      break;
    case "organisasi":
      aksi = { label: "Undang seluruh Al Akhyar", body: organisasiDiundang ? null : { tipe: "organisasi" } };
      break;
  }

  return (
    <Sheet open={open} onOpenChange={ubahBuka}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-3xl gap-0 rounded-t-3xl">
        <SheetHeader className="pr-14">
          <SheetTitle className="text-lg font-semibold">Undang ke rekaman ini</SheetTitle>
          <SheetDescription>Orang yang diundang bisa mendengarkan audio dan membaca transkrip serta dokumen yang sudah disetujui.</SheetDescription>
        </SheetHeader>

        <Tabs value={modeAktif} onValueChange={(v) => setPilihanMode(v as Mode)} className="min-h-0 flex-1 flex-col gap-0">
          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-4 pb-6">
            <section aria-label="Tambah undangan" className="space-y-4">
              <TabsList className={cn("grid h-12 w-full rounded-2xl p-1", pimpinan ? "grid-cols-2" : "grid-cols-4")}>
                {mode.map((m) => (
                  <TabsTrigger
                    key={m}
                    value={m}
                    className="h-10 rounded-xl text-sm font-semibold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
                  >
                    {LABEL_MODE[m]}
                  </TabsTrigger>
                ))}
              </TabsList>

              {pimpinan && (
                <p className="text-sm text-muted-foreground">
                  Rapat pimpinan hanya bisa dibuka untuk orang atau grup tertentu, jadi undangan per unit dan seluruh organisasi tidak tersedia.
                </p>
              )}

              <TabsContent value="orang">
                <AnggotaEditor
                  anggota={orang}
                  onChange={setOrang}
                  maks={MAKS_ORANG}
                  emailPemilik={me.email}
                  kosong="Pilih orang dari direktori atau tulis emailnya. Mereka akan masuk ke daftar ini."
                />
              </TabsContent>

              <TabsContent value="grup">
                {grup.isPending ? (
                  <ListSkeleton rows={2} />
                ) : grup.isError ? (
                  <ErrorNotice error={grup.error} onRetry={() => void grup.refetch()} title="Tidak bisa memuat grup" />
                ) : grup.data.length === 0 ? (
                  <EmptyState
                    title="Belum punya grup"
                    hint="Grup mengumpulkan orang yang sering diundang bersama, jadi Anda tidak perlu memilih satu per satu."
                    action={
                      <Button asChild variant="outline">
                        <Link to="/grup" onClick={() => ubahBuka(false)}>
                          Buat grup
                        </Link>
                      </Button>
                    }
                  />
                ) : (
                  <div role="radiogroup" aria-label="Pilih grup" className="space-y-2">
                    {grup.data.map((g) => (
                      <BarisPilihan
                        key={g.id}
                        name="grup-undangan"
                        checked={grupId === g.id}
                        onSelect={() => setGrupId(g.id)}
                        sudahDiundang={grupDiundang.has(g.id)}
                      >
                        <p className="truncate text-sm font-semibold">{g.nama}</p>
                        <p className="text-xs text-muted-foreground">{g.jumlahAnggota} anggota</p>
                      </BarisPilihan>
                    ))}
                  </div>
                )}
              </TabsContent>

              {!pimpinan && (
                <TabsContent value="unit">
                  <div role="radiogroup" aria-label="Pilih unit" className="space-y-2">
                    {UNIT.map((u) => (
                      <BarisPilihan
                        key={u}
                        name="unit-undangan"
                        checked={unit === u}
                        onSelect={() => setUnit(u)}
                        sudahDiundang={unitDiundang.has(u)}
                      >
                        <p className="text-sm font-semibold">Seluruh GTK {u}</p>
                        <p className="text-xs text-muted-foreground">Semua guru dan tenaga kependidikan unit {u} bisa membaca.</p>
                      </BarisPilihan>
                    ))}
                  </div>
                </TabsContent>
              )}

              {!pimpinan && (
                <TabsContent value="organisasi">
                  <Alert className="rounded-2xl border-warning bg-warning/10 text-foreground">
                    <TriangleAlertIcon />
                    <AlertTitle>Terbuka untuk semua yang login</AlertTitle>
                    <AlertDescription>
                      <p>
                        Seluruh akun Al Akhyar yang masuk ke Kalam AI akan bisa mendengarkan dan membaca rekaman ini. Pilih ini hanya bila isinya memang
                        boleh diketahui seluruh sekolah.
                      </p>
                      {organisasiDiundang && <p className="mt-2 font-medium">Rekaman ini sudah terbuka untuk seluruh Al Akhyar.</p>}
                    </AlertDescription>
                  </Alert>
                </TabsContent>
              )}
            </section>

            <section aria-label="Undangan saat ini" className="space-y-3">
              <h3 className="text-sm font-semibold">Sudah diundang</h3>
              {undangan.isPending ? (
                <ListSkeleton rows={2} />
              ) : undangan.isError ? (
                <ErrorNotice error={undangan.error} onRetry={() => void undangan.refetch()} title="Tidak bisa memuat undangan" />
              ) : diundang.length === 0 ? (
                <p className="rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
                  Belum ada yang diundang. Saat ini hanya Anda sebagai perekam yang bisa melihat rekaman ini.
                </p>
              ) : (
                <ul className="divide-y rounded-2xl border">
                  {diundang.map((u) => {
                    const { utama, sub, ikon: Ikon } = deskripsi(u);
                    const sedangDicabut = cabut.isPending && cabut.variables?.id === u.id;
                    return (
                      <li key={u.id} className="flex items-center gap-3 py-2 pr-1 pl-4">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                          <Ikon className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{utama}</p>
                          {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Cabut undangan ${utama}`}
                          disabled={sedangDicabut}
                          onClick={() => cabut.mutate(u)}
                        >
                          <Trash2Icon aria-hidden />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <SheetFooter className="border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              size="lg"
              disabled={aksi.body === null || tambah.isPending}
              onClick={() => {
                if (aksi.body) tambah.mutate(aksi.body);
              }}
            >
              {tambah.isPending ? "Mengundang…" : aksi.label}
            </Button>
          </SheetFooter>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
