import { readFile } from "node:fs/promises";
import { z } from "zod";
import { env } from "../env.js";
import { GalatKuota, GalatLayanan, panggilJson } from "./layanan.js";

type Pesan = { role: "system" | "user" | "assistant"; content: string };

const KUOTA_HARIAN = /daily free allocation|"code":\s*4006/i;

/** Jatah neuron gratis Cloudflare direset 00:00 UTC; +5 menit sebagai pengaman. */
function resetKuotaHarian(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 5));
}

/** Kuota harian habis atau batas laju (429) bukan kegagalan sesi: tunda tanpa menghabiskan percobaan. */
function sebagaiKuota(e: GalatLayanan): GalatLayanan {
  if (KUOTA_HARIAN.test(e.message)) return new GalatKuota(e.message, resetKuotaHarian(), e.status);
  if (e.status === 429) return new GalatKuota(e.message, new Date(Date.now() + 60_000), e.status);
  return e;
}

async function jalankanModel(model: string, body: unknown, timeoutMs: number): Promise<unknown> {
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) throw new GalatLayanan("CF_ACCOUNT_ID / CF_API_TOKEN belum diisi");
  let j: unknown;
  try {
    j = await panggilJson(
      `Cloudflare ${model}`,
      `${env.CF_API_BASE}/accounts/${env.CF_ACCOUNT_ID}/ai/run/${model}`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
  } catch (e) {
    throw e instanceof GalatLayanan ? sebagaiKuota(e) : e;
  }
  // Amplop REST: { result, success, errors, messages }
  const env_ = z.looseObject({ success: z.boolean().optional(), result: z.unknown(), errors: z.array(z.unknown()).optional() }).parse(j);
  if (env_.success === false) {
    throw sebagaiKuota(new GalatLayanan(`Cloudflare ${model}: ${JSON.stringify(env_.errors).slice(0, 300)}`));
  }
  return env_.result;
}

const hasilWhisper = z.looseObject({
  text: z.string(),
  segments: z.array(z.looseObject({ start: z.number(), end: z.number(), text: z.string() })).default([]),
});
export type HasilWhisper = z.infer<typeof hasilWhisper>;

/** Whisper (large-v3-turbo): audio dikirim base64 dalam JSON. Kontrak: developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo */
export async function transkripsi(berkas: string): Promise<HasilWhisper> {
  const audio = (await readFile(berkas)).toString("base64");
  const r = await jalankanModel(
    env.WHISPER_MODEL,
    // vad_filter membuang bagian sunyi sehingga Whisper tidak berhalusinasi di jeda panjang.
    { audio, task: "transcribe", language: "id", vad_filter: true },
    10 * 60_000,
  );
  return hasilWhisper.parse(r);
}

/** Cadangan saat gateway Gemini mati (ARCHITECTURE.md §1). Mengembalikan teks jawaban model. */
export async function llm(messages: Pesan[]): Promise<string> {
  const r = await jalankanModel(env.CF_LLM_MODEL, { messages, max_tokens: 4096 }, 5 * 60_000);
  return z.looseObject({ response: z.string() }).parse(r).response;
}
