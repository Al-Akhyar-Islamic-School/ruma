import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState, ErrorNotice, PageLoading } from "@/components/app/feedback";
import { Button } from "@/components/ui/button";
import { IsiSesi } from "@/features/sesi/isi-sesi";
import { PemutarProvider } from "@/features/sesi/pemutar";
import { sesiQuery } from "@/features/sesi/queries";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/_app/sesi/$uuid")({ component: HalamanSesi });

function HalamanSesi() {
  const { uuid } = Route.useParams();
  const q = useQuery(sesiQuery(uuid));

  if (q.data) {
    return (
      <PemutarProvider uuid={uuid} audioTersedia={q.data.audioTersedia} durasiDetik={q.data.durasiDetik}>
        <IsiSesi sesi={q.data} />
      </PemutarProvider>
    );
  }
  if (q.isError) {
    // Server membalas 404 (bukan 403) bagi yang tidak punya akses, jadi pesannya mencakup kedua kemungkinan.
    if (q.error instanceof ApiError && q.error.status === 404) {
      return (
        <EmptyState
          title="Sesi tidak ditemukan atau Anda tidak punya akses"
          hint="Tautannya mungkin salah, atau sesi ini belum dibagikan kepada Anda."
          action={
            <Button asChild>
              <Link to="/">Ke beranda</Link>
            </Button>
          }
        />
      );
    }
    return <ErrorNotice error={q.error} onRetry={() => void q.refetch()} title="Tidak bisa memuat sesi" />;
  }
  return <PageLoading />;
}
