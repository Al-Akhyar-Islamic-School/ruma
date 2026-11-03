import { createFileRoute } from "@tanstack/react-router";
import { HalamanPermintaan } from "@/features/permintaan/halaman-permintaan";

export const Route = createFileRoute("/_app/permintaan")({ component: HalamanPermintaan });
