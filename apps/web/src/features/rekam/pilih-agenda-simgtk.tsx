import { useQuery } from "@tanstack/react-query";
import { CalendarCheck2Icon, CalendarIcon, LinkIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ok } from "@/lib/api";

export interface AgendaPilihan {
  id: number;
  judul: string;
  tanggal: string;
  tempat?: string | null;
  unit?: string | null;
  pesertas: { user_id: number; nama: string; email: string }[];
}

export function PilihAgendaSimgtk({
  onPilih,
}: {
  onPilih: (agenda: AgendaPilihan) => void;
}) {
  const [bukaInputUrl, setBukaInputUrl] = useState(false);
  const [inputUrl, setInputUrl] = useState("");
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [errorUrl, setErrorUrl] = useState<string | null>(null);

  // Ambil daftar agenda hari ini
  const { data: daftar, isPending } = useQuery({
    queryKey: ["simgtk", "agenda-hari-ini"],
    queryFn: async () => ok(await api.simgtk.agenda.$get()),
    staleTime: 60_000,
  });

  async function cariDariTautan() {
    if (!inputUrl.trim()) return;
    setLoadingUrl(true);
    setErrorUrl(null);
    try {
      const res = await ok(
        await api.simgtk.agenda.detail.$get({ query: { idOrUrl: inputUrl.trim() } })
      );
      onPilih(res as AgendaPilihan);
      setInputUrl("");
      setBukaInputUrl(false);
    } catch (e: any) {
      setErrorUrl(e?.message || "Agenda tidak ditemukan atau Anda tidak memiliki akses.");
    } finally {
      setLoadingUrl(false);
    }
  }

  return (
    <Card className="gap-3 rounded-2xl border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <CalendarCheck2Icon className="size-4" /> Agenda SIMGTK
        </span>
        <Button
          type="button"
          variant="link"
          size="xs"
          onClick={() => setBukaInputUrl(!bukaInputUrl)}
          className="h-auto p-0 text-xs text-primary underline"
        >
          {bukaInputUrl ? "Tutup input tautan" : "Tempel tautan agenda"}
        </Button>
      </div>

      {bukaInputUrl ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Mis. https://simgtk.test/agenda/123"
              className="h-10 text-xs bg-background"
            />
            <Button
              type="button"
              size="sm"
              disabled={loadingUrl || !inputUrl.trim()}
              onClick={cariDariTautan}
              className="h-10 gap-1 text-xs"
            >
              {loadingUrl ? <Loader2Icon className="size-3.5 animate-spin" /> : <LinkIcon className="size-3.5" />}
              <span>Tarik</span>
            </Button>
          </div>
          {errorUrl && <p className="text-xs text-destructive">{errorUrl}</p>}
          <p className="text-[11px] text-muted-foreground">
            Bisa menempelkan tautan rapat lama, rapat besok, atau rapat unit lain dari SIMGTK.
          </p>
        </div>
      ) : isPending ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" /> Memeriksa agenda hari ini...
        </p>
      ) : daftar && daftar.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Pilih agenda rapat hari ini untuk mengisi otomatis:</p>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {daftar.map((a: any) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onPilih(a)}
                className="flex flex-col text-left p-2.5 rounded-xl border bg-card hover:bg-primary/10 transition-colors"
              >
                <span className="text-xs font-bold text-foreground line-clamp-1">{a.judul}</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>📅 {a.tanggal}</span>
                  {a.jam_mulai && <span>⏰ {a.jam_mulai}</span>}
                  {a.tempat && <span>📍 {a.tempat}</span>}
                  {a.unit && <span className="font-semibold text-primary">[{a.unit}]</span>}
                </span>
                {a.pesertas && a.pesertas.length > 0 && (
                  <span className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                    👥 {a.pesertas.length} peserta akan diundang otomatis
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Tidak ada jadwal rapat Anda hari ini di SIMGTK. Gunakan "Tempel tautan agenda" jika ingin menautkan rapat lain.
        </p>
      )}
    </Card>
  );
}
