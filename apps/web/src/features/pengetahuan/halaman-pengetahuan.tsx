import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabCari } from "./tab-cari";
import { TabKeputusan } from "./tab-keputusan";

export type TabPengetahuan = "cari" | "keputusan";

/** Knowledge Management dasar: cari lintas rapat dan daftar keputusan. Keadaan (q, tab) hidup di URL agar bisa dibagikan. */
export function HalamanPengetahuan({
  q,
  tab,
  onUbah,
}: {
  q: string;
  tab: TabPengetahuan;
  onUbah: (perubahan: { q?: string; tab?: TabPengetahuan }) => void;
}) {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold leading-snug">Pengetahuan</h1>
        <p className="text-sm text-muted-foreground">Temukan isi dan keputusan dari rapat yang bisa Anda baca.</p>
      </header>
      <Tabs value={tab} onValueChange={(v) => onUbah({ tab: v === "keputusan" ? "keputusan" : "cari" })} className="gap-4">
        <TabsList className="h-12 w-full">
          <TabsTrigger value="cari">Cari</TabsTrigger>
          <TabsTrigger value="keputusan">Keputusan</TabsTrigger>
        </TabsList>
        <TabsContent value="cari">
          <TabCari q={q} onUbahQ={(nilai) => onUbah({ q: nilai })} />
        </TabsContent>
        <TabsContent value="keputusan">
          <TabKeputusan q={q} onUbahQ={(nilai) => onUbah({ q: nilai })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
