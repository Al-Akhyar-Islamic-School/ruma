import { createFileRoute } from "@tanstack/react-router";
import { LayarLive } from "@/features/rekam/layar-live";

export const Route = createFileRoute("/_app/rekam/$uuid")({ component: Perekam });

function Perekam() {
  const { uuid } = Route.useParams();
  return <LayarLive key={uuid} uuid={uuid} />;
}
