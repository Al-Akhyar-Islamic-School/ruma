import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileTextIcon, ExternalLinkIcon, Loader2Icon, MusicIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ok, pesanGalat } from "@/lib/api";

export function TombolGoogleDocs({ uuid }: { uuid: string }) {
  const qc = useQueryClient();
  const queryKey = ["sesi", uuid, "google-docs-status"];

  const { data, isPending } = useQuery({
    queryKey,
    queryFn: async () =>
      ok(await api.sesi[":uuid"].dokumen["google-docs"].status.$get({ param: { uuid } })),
  });

  const ekspor = useMutation({
    mutationFn: async () =>
      ok(await api.sesi[":uuid"].dokumen["google-docs"].ekspor.$post({ param: { uuid } })),
    onSuccess: (res) => {
      toast.success("Berhasil disimpan ke Google Docs!");
      void qc.invalidateQueries({ queryKey });
      void qc.invalidateQueries({ queryKey: ["sesi", uuid, "dokumen"] });
      window.open(res.url, "_blank", "noopener,noreferrer");
    },
    onError: (e) => {
      toast.error(pesanGalat(e));
    },
  });

  if (isPending || !data) return null;

  // Jika sudah diekspor dan ada URL-nya, tampilkan tombol "Buka Google Docs"
  if (data.googleDocsUrl || data.googleDriveAudioUrl) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {data.googleDocsUrl && (
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-1.5 border-primary/20 text-primary hover:bg-primary/10"
          >
            <a href={data.googleDocsUrl} target="_blank" rel="noopener noreferrer">
              <FileTextIcon className="size-4" />
              <span>Buka Google Docs</span>
              <ExternalLinkIcon className="size-3 opacity-60" />
            </a>
          </Button>
        )}
        {data.googleDriveAudioUrl && (
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-1.5 border-primary/20 text-primary hover:bg-primary/10"
          >
            <a href={data.googleDriveAudioUrl} target="_blank" rel="noopener noreferrer">
              <MusicIcon className="size-4" />
              <span>Audio di Drive</span>
              <ExternalLinkIcon className="size-3 opacity-60" />
            </a>
          </Button>
        )}
      </div>
    );
  }

  // Jika Google Drive belum tersambung, tombol mengarahkan ke OAuth consent screen Drive
  if (!data.driveTersambung && data.urlAuth) {
    return (
      <Button
        variant="outline"
        size="sm"
        asChild
        className="gap-1.5 border-dashed"
      >
        <a href={data.urlAuth}>
          <FileTextIcon className="size-4" />
          <span>Sambungkan Google Drive</span>
        </a>
      </Button>
    );
  }

  // Jika Drive tersambung dan siap ekspor
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={ekspor.isPending}
      onClick={() => ekspor.mutate()}
      className="gap-1.5"
    >
      {ekspor.isPending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <FileTextIcon className="size-4" />
      )}
      <span>{ekspor.isPending ? "Menyimpan ke Docs…" : "Simpan ke Google Docs"}</span>
    </Button>
  );
}
