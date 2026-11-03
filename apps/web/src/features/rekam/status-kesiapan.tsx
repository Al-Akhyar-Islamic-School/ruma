import { CircleCheckIcon, CircleXIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ItemKesiapan, KesiapanMikrofon, StatusKesiapan } from "./use-pra-rekam";

function IkonStatus({ status }: { status: StatusKesiapan }) {
  if (status === "memeriksa") return <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" aria-hidden />;
  if (status === "ok") return <CircleCheckIcon className="size-4 text-success" aria-hidden />;
  if (status === "peringatan") return <TriangleAlertIcon className="size-4 text-warning" aria-hidden />;
  return <CircleXIcon className="size-4 text-destructive" aria-hidden />;
}

const LABEL_STATUS: Record<StatusKesiapan, string> = {
  memeriksa: "Memeriksa",
  ok: "Siap",
  peringatan: "Perlu perhatian",
  masalah: "Bermasalah",
};

function Baris({ nama, item, children }: { nama: string; item: ItemKesiapan; children?: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-0.5 shrink-0">
        <IkonStatus status={item.status} />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">
          {nama} <span className="font-normal text-muted-foreground">· {LABEL_STATUS[item.status]}</span>
        </p>
        <p className="text-sm text-muted-foreground">{item.pesan}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * Kesiapan sebelum mulai merekam: satu baris ringkas bila semuanya beres, daftar rinci bila ada peringatan atau masalah.
 * Warna tidak pernah menjadi satu-satunya pembeda: setiap item punya ikon dan label teks.
 * Perubahan status diumumkan lewat satu wilayah `aria-live`; meter level berada di luar wilayah itu.
 */
export function StatusKesiapan({
  mikrofon,
  penyimpanan,
  server,
  onPeriksaMikrofon,
}: {
  mikrofon: KesiapanMikrofon;
  penyimpanan: ItemKesiapan;
  server: ItemKesiapan;
  onPeriksaMikrofon: () => void;
}) {
  const semua = [mikrofon, penyimpanan, server];
  const adaMasalah = semua.some((i) => i.status === "peringatan" || i.status === "masalah");
  const masihMemeriksa = semua.some((i) => i.status === "memeriksa");

  return (
    <section aria-label="Kesiapan merekam" className="space-y-3 rounded-2xl bg-card p-3.5 ring-1 ring-border">
      <div aria-live="polite">
        {adaMasalah ? (
          <ul className="space-y-3">
            <Baris nama="Mikrofon" item={mikrofon}>
              {mikrofon.status === "peringatan" && mikrofon.bisaDiulang && (
                <Button type="button" variant="secondary" size="sm" className="mt-1.5 h-12" onClick={onPeriksaMikrofon}>
                  Periksa mikrofon
                </Button>
              )}
            </Baris>
            <Baris nama="Penyimpanan" item={penyimpanan} />
            <Baris nama="Server" item={server} />
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm">
            {masihMemeriksa ? <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" aria-hidden /> : <CircleCheckIcon className="size-4 text-success" aria-hidden />}
            <span>{semua.map((i) => i.ringkas).join(" · ")}</span>
          </p>
        )}
      </div>

      {mikrofon.meter && (
        <div
          role="meter"
          aria-label="Tingkat suara mikrofon"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(mikrofon.tingkat * 100)}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-100" style={{ width: `${Math.round(mikrofon.tingkat * 100)}%` }} />
        </div>
      )}
    </section>
  );
}
