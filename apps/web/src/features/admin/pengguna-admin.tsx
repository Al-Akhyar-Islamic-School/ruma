import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorNotice, ListSkeleton } from "@/components/app/feedback";
import { ROLE_LABEL } from "@/components/app/shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, ok, pesanGalat } from "@/lib/api";
import { type Me, useMe } from "@/lib/auth";

type Role = Me["role"];

/** Peran yang bisa dipilih lewat UI. `superadmin` hanya berasal dari SUPERADMIN_EMAILS di server. */
const PERAN_BISA_DIPILIH = ["admin", "kepsek", "wakasek", "notulis", "guru"] as const satisfies readonly Role[];
/** Peran yang otomatis boleh merekam langsung (selaras `LANGSUNG` di server). */
const PERAN_LANGSUNG: readonly Role[] = ["superadmin", "admin", "kepsek", "wakasek"];

type Pengguna = {
  id: number;
  name: string;
  email: string;
  role: Role;
  bisaMerekam: boolean;
  lastLoginAt: string | null;
};

type Perubahan = { role: Role } | { bisa_merekam: boolean };

export function PenggunaAdmin() {
  const me = useMe();
  const qc = useQueryClient();
  const [cari, setCari] = useState("");
  const kunci = ["admin", "users"] as const;

  const q = useQuery({ queryKey: kunci, queryFn: async () => ok(await api.admin.users.$get()) });

  const ubah = useMutation({
    mutationFn: async (v: { id: number; perubahan: Perubahan }) =>
      ok(await api.admin.users[":id"].$patch({ param: { id: String(v.id) }, json: v.perubahan })),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: kunci });
      const sebelum = qc.getQueryData<Pengguna[]>(kunci);
      qc.setQueryData<Pengguna[]>(kunci, (lama) =>
        lama?.map((u) =>
          u.id !== v.id ? u : "role" in v.perubahan ? { ...u, role: v.perubahan.role } : { ...u, bisaMerekam: v.perubahan.bisa_merekam },
        ),
      );
      return { sebelum };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.sebelum) qc.setQueryData(kunci, ctx.sebelum);
      toast.error(pesanGalat(e));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: kunci }),
  });

  const kata = cari.trim().toLowerCase();
  const daftar = (q.data as Pengguna[] | undefined)?.filter(
    (u) => !kata || u.name.toLowerCase().includes(kata) || u.email.toLowerCase().includes(kata),
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Atur peran dan izin merekam langsung. Pengguna tanpa izin merekam mengajukan permintaan ke admin lebih dulu.
      </p>

      <div className="space-y-2">
        <Label htmlFor="cari-pengguna">Cari pengguna</Label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="cari-pengguna"
            type="search"
            className="h-12 pl-9"
            placeholder="Nama atau email"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
          />
        </div>
      </div>

      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorNotice error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState title="Belum ada pengguna" hint="Pengguna muncul di sini setelah masuk dengan akun Google sekolah." />
      ) : !daftar || daftar.length === 0 ? (
        <EmptyState title="Pengguna tidak ditemukan" hint={`Tidak ada nama atau email yang cocok dengan "${cari.trim()}".`} />
      ) : (
        <>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Menampilkan {daftar.length} dari {q.data.length} pengguna
          </p>
          <ul className="space-y-3">
            {daftar.map((u) => (
              <li key={u.id}>
                <BarisPengguna u={u} aktorSuperadmin={me.role === "superadmin"} onUbah={(perubahan) => ubah.mutate({ id: u.id, perubahan })} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function BarisPengguna({
  u,
  aktorSuperadmin,
  onUbah,
}: {
  u: Pengguna;
  aktorSuperadmin: boolean;
  onUbah: (p: Perubahan) => void;
}) {
  const superadmin = u.role === "superadmin";
  // Server menolak perubahan pada superadmin (siapa pun aktornya) dan pada admin bila aktor bukan superadmin.
  const terkunci = superadmin || (u.role === "admin" && !aktorSuperadmin);
  const idSwitch = `merekam-${u.id}`;
  const idPeran = `peran-${u.id}`;

  return (
    <Card className="gap-3 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{u.name}</p>
          <p className="truncate text-sm text-muted-foreground">{u.email}</p>
        </div>
        <Badge variant={superadmin ? "default" : "secondary"} className="shrink-0">
          {ROLE_LABEL[u.role]}
        </Badge>
      </div>

      <div className="flex min-h-12 items-center justify-between gap-3">
        <Label htmlFor={idSwitch} className="flex-1 flex-col items-start gap-0.5 text-sm font-medium">
          Boleh merekam langsung
          {PERAN_LANGSUNG.includes(u.role) && <span className="text-xs font-normal text-muted-foreground">Sudah termasuk dari peran ini.</span>}
        </Label>
        <Switch
          id={idSwitch}
          checked={u.bisaMerekam}
          disabled={terkunci}
          onCheckedChange={(v) => onUbah({ bisa_merekam: v })}
        />
      </div>

      {superadmin ? (
        <p className="text-xs text-muted-foreground">Peran super admin tidak bisa diubah di sini. Diatur lewat SUPERADMIN_EMAILS di server.</p>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor={idPeran} className="text-sm font-medium">
            Peran
          </Label>
          <Select value={u.role} onValueChange={(v) => onUbah({ role: v as Role })} disabled={terkunci}>
            <SelectTrigger id={idPeran} className="h-12 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERAN_BISA_DIPILIH.map((r) => (
                <SelectItem key={r} value={r} disabled={r === "admin" && !aktorSuperadmin}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {terkunci && <p className="text-xs text-muted-foreground">Hanya super admin yang bisa mengubah admin.</p>}
        </div>
      )}
    </Card>
  );
}
