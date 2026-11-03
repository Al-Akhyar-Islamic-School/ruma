import { Badge } from "@/components/ui/badge";
import { STATUS_SESI, type StatusSesi } from "@/lib/format";

/** Badge status sesi; warna mengikuti `STATUS_SESI` (sama dengan kartu di beranda). */
export function StatusBadge({ status }: { status: StatusSesi }) {
  const { label, tone } = STATUS_SESI[status];
  if (tone === "emerald") return <Badge className="shrink-0 bg-success text-success-foreground">{label}</Badge>;
  if (tone === "amber") return <Badge className="shrink-0 bg-warning text-warning-foreground">{label}</Badge>;
  return <Badge variant={tone === "rose" ? "destructive" : "secondary"} className="shrink-0">{label}</Badge>;
}
