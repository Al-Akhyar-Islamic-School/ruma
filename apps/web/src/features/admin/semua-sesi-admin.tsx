import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, ErrorNotice, ListSkeleton } from "@/components/app/feedback";
import { SesiCard } from "@/components/app/sesi-card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ok } from "@/lib/api";

const SEMUA = "semua";

export function SemuaSesiAdmin() {
  const [perekam, setPerekam] = useState<string>(SEMUA);
  const userId = perekam === SEMUA ? undefined : perekam;

  const users = useQuery({ queryKey: ["admin", "users"], queryFn: async () => ok(await api.admin.users.$get()) });
  const q = useQuery({
    queryKey: ["admin", "sesi", userId ?? SEMUA],
    queryFn: async () => ok(await api.admin.sesi.$get({ query: userId ? { user_id: userId } : {} })),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Akses baca super admin ke semua sesi, termasuk dokumen berstatus draf. Ketuk sesi untuk membuka transkrip, audio, dan dokumennya.
      </p>

      {users.data && (
        <div className="space-y-2">
          <Label htmlFor="filter-perekam">Perekam</Label>
          <Select value={perekam} onValueChange={setPerekam}>
            <SelectTrigger id="filter-perekam" className="h-12 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua perekam</SelectItem>
              {users.data.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorNotice error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState
          title="Belum ada sesi"
          hint={userId ? "Perekam ini belum punya sesi. Pilih perekam lain atau tampilkan semua." : "Sesi muncul di sini setelah pengguna mulai merekam."}
        />
      ) : (
        <ul className="space-y-3">
          {q.data.map((s) => (
            <li key={s.uuid}>
              <SesiCard s={{ ...s, metadata: {} }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
