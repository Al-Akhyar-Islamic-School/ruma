import type { ReactNode } from "react";

/**
 * Overlay layar penuh yang menutupi Shell untuk layar perekam. Sengaja memaksa tema gelap pekat
 * (hemat baterai OLED, kontras tinggi) apa pun tema aplikasi; hanya layar ini yang boleh begitu.
 */
export function KerangkaGelap({ children }: { children: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Perekam suara"
      className="dark fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-none bg-background pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-foreground"
    >
      {children}
    </div>
  );
}
