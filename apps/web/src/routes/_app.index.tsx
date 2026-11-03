import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyState, ErrorNotice, ListSkeleton } from "@/components/app/feedback";
import { SesiCard, type SesiRingkas } from "@/components/app/sesi-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PemulihanBanner } from "@/features/rekam/pemulihan-banner";
import { api, ok } from "@/lib/api";
import { useMe } from "@/lib/auth";

export const Route = createFileRoute("/_app/")({ component: Beranda });

type Filter = "semua" | SesiRingkas["tipeSesi"];

function Beranda() {
  const me = useMe();
  const [tab, setTab] = useState<"saya" | "dibagikan">("saya");
  const [filter, setFilter] = useState<Filter>("semua");

  const saya = useQuery({ queryKey: ["sesi", "saya"], queryFn: async () => ok(await api.sesi.$get()) });
  const dibagikan = useQuery({ queryKey: ["sesi", "dibagikan"], queryFn: async () => ok(await api.sesi.dibagikan.$get()) });
  const aktif = tab === "saya" ? saya : dibagikan;
  const semua: SesiRingkas[] = (aktif.data as SesiRingkas[] | undefined) ?? [];
  // Modul supervisi mati: hanya ada rapat, jadi filter jenis tidak berguna dan disembunyikan.
  const filterAktif: Filter = me.modul.supervisi ? filter : "semua";
  const tampil = filterAktif === "semua" ? semua : semua.filter((s) => s.tipeSesi === filterAktif);
  const hitung = (f: Filter) => (f === "semua" ? semua.length : semua.filter((s) => s.tipeSesi === f).length);

  return (
    <div className="space-y-4">
      <PemulihanBanner />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="saya">
            Rekaman saya
          </TabsTrigger>
          <TabsTrigger value="dibagikan">
            Dibagikan ke saya
            {(dibagikan.data?.length ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{dibagikan.data?.length}</span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {me.modul.supervisi && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter jenis sesi">
          {(
            [
              ["semua", "Semua"],
              ["rapat", "Rapat"],
              ["supervisi_kelas", "Supervisi"],
            ] as const
          ).map(([nilai, label]) => (
            <Button
              key={nilai}
              size="sm"
              variant={filterAktif === nilai ? "default" : "secondary"}
              className="rounded-full"
              aria-pressed={filterAktif === nilai}
              onClick={() => setFilter(nilai)}
            >
              {label} ({hitung(nilai)})
            </Button>
          ))}
        </div>
      )}

      {aktif.isPending ? (
        <ListSkeleton />
      ) : aktif.isError ? (
        <ErrorNotice error={aktif.error} onRetry={() => aktif.refetch()} />
      ) : tampil.length === 0 ? (
        tab === "saya" ? (
          <EmptyState
            title="Belum ada rekaman"
            hint={
              me.bisaBuatSesiLangsung
                ? "Tekan tombol rekam di bawah untuk memulai rapat atau supervisi pertama Anda."
                : "Untuk merekam, ajukan permintaan ke admin. Setelah disetujui, tombol rekam akan membawa Anda ke sana."
            }
          />
        ) : (
          <EmptyState title="Belum ada yang dibagikan" hint="Rekaman rapat yang mengundang Anda akan muncul di sini." />
        )
      ) : (
        <ul className="space-y-3">
          {tampil.map((s) => (
            <li key={s.uuid}>
              <SesiCard s={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
