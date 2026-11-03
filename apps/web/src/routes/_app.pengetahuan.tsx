import { createFileRoute } from "@tanstack/react-router";
import { HalamanPengetahuan, type TabPengetahuan } from "@/features/pengetahuan/halaman-pengetahuan";

type SearchPengetahuan = { q?: string; tab?: "keputusan" };

export const Route = createFileRoute("/_app/pengetahuan")({
  // `zod` tidak terpasang di web; validasi manual seperti rute login. Tab "cari" adalah bawaan, jadi tidak masuk URL.
  validateSearch: (s: Record<string, unknown>): SearchPengetahuan => ({
    q: typeof s.q === "string" && s.q.trim() !== "" ? s.q.slice(0, 100) : undefined,
    tab: s.tab === "keputusan" ? "keputusan" : undefined,
  }),
  component: RutePengetahuan,
});

function RutePengetahuan() {
  const { q, tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <HalamanPengetahuan
      q={q ?? ""}
      tab={tab ?? "cari"}
      onUbah={(p: { q?: string; tab?: TabPengetahuan }) =>
        void navigate({
          search: (prev) => ({
            q: "q" in p ? p.q || undefined : prev.q,
            tab: "tab" in p ? (p.tab === "keputusan" ? "keputusan" : undefined) : prev.tab,
          }),
          replace: true,
        })
      }
    />
  );
}
