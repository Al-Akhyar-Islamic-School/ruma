import { createFileRoute } from "@tanstack/react-router";
import { AntreanAdmin } from "@/features/admin/antrean-admin";

export const Route = createFileRoute("/_app/admin/antrean")({ component: AntreanAdmin });
