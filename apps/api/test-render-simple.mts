import { eksporKeGoogleDocs, type DataNotulen } from "./src/integrasi/google-docs.js";
import { db } from "./src/db/index.js";
import { dokumen } from "./src/db/schema.js";
import { eq } from "drizzle-orm";

const [d] = await db.select().from(dokumen).where(eq(dokumen.sesiId, 1)).limit(1);
if (d) {
  console.log("Menguji ekspor Google Docs sederhana (list, bullet, checkbox)...");
  const res = await eksporKeGoogleDocs(1, "Rapat Pemancingan", d.payload as DataNotulen, d.googleDocsFileId);
  console.log("SUKSES! URL:", res.url);
}
