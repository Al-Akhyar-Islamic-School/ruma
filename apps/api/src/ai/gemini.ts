import { z } from "zod";
import { env } from "../env.js";
import { GalatLayanan, panggilJson } from "./layanan.js";

type Pesan = { role: "system" | "user" | "assistant"; content: string };

const jawaban = z.looseObject({
  choices: z.array(z.looseObject({ message: z.looseObject({ content: z.string() }) })).min(1),
});

/** Gateway Gemini sekolah, kompatibel OpenAI: POST {GEMINI_BASE_URL}/chat/completions. */
export async function chat(messages: Pesan[]): Promise<string> {
  if (!env.GEMINI_BASE_URL) throw new GalatLayanan("GEMINI_BASE_URL belum diisi");
  const j = await panggilJson(
    "Gemini gateway",
    `${env.GEMINI_BASE_URL.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.GEMINI_API_KEY ? { authorization: `Bearer ${env.GEMINI_API_KEY}` } : {}),
      },
      body: JSON.stringify({ model: env.GEMINI_MODEL, messages, temperature: 0.2 }),
    },
    10 * 60_000,
  );
  const parsed = jawaban.safeParse(j);
  if (!parsed.success) throw new GalatLayanan(`Gemini gateway: bentuk respons tak dikenal: ${JSON.stringify(j).slice(0, 200)}`);
  return parsed.data.choices[0]!.message.content;
}
