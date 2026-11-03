import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { pesanGalat } from "@/lib/api";

/** Placeholder daftar saat memuat: tinggi sama dengan kartu sesungguhnya agar layout tidak melompat. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Memuat">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="space-y-4 py-2" role="status" aria-label="Memuat">
      <Skeleton className="h-8 w-2/3 rounded-xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}

/** Layar kosong = ajakan bertindak: jelaskan apa ini dan beri tombol langkah berikutnya. */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="text-base font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorNotice({ error, onRetry, title = "Tidak bisa memuat data" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <Alert variant="destructive" className="rounded-2xl">
      <TriangleAlertIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{pesanGalat(error)}</p>
        {onRetry && (
          <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
            Coba lagi
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
