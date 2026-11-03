import type { ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * Pilihan tunggal 2-4 opsi yang saling meniadakan (mis. mode Rapat / Supervisi). Selalu ada satu yang terpilih.
 * Untuk navigasi antar tampilan (Dokumen / Transkrip) pakai `Tabs`.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      // Radix mengirim "" saat item aktif diketuk lagi; abaikan supaya tidak ada keadaan kosong.
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      variant="default"
      className={cn("grid w-full auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-secondary p-1", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="h-11 rounded-xl text-sm font-semibold data-[state=on]:bg-card data-[state=on]:text-primary data-[state=on]:shadow-sm"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
