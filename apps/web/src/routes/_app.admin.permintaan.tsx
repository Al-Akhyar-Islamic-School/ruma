import { createFileRoute } from "@tanstack/react-router";
import { PermintaanAdmin } from "@/features/admin/permintaan-admin";

export const Route = createFileRoute("/_app/admin/permintaan")({ component: PermintaanAdmin });
