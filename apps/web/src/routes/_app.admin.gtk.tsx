import { createFileRoute } from "@tanstack/react-router";
import { GtkAdmin } from "@/features/admin/gtk-admin";

export const Route = createFileRoute("/_app/admin/gtk")({ component: GtkAdmin });
