import { z } from "zod";

const responseSchema = z.object({ status: z.literal("completed"), output: z.array(z.object({
  type: z.string(), content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
})) });

/** Server-only import: keys never enter the client dependency graph. */
export async function askOpenAI(instructions: string, input: unknown, json = false): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error("AI unavailable");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini", store: false,
      instructions, input: JSON.stringify(input), max_output_tokens: json ? 7000 : 4000,
      ...(json ? { text: { format: { type: "json_object" } } } : {}),
    }),
  });
  if (!response.ok) throw new Error("AI request failed");
  const data = responseSchema.parse(await response.json());
  const text = data.output.filter(item => item.type === "message")
    .flatMap(item => item.content || []).filter(item => item.type === "output_text")
    .map(item => item.text || "").join("\n").trim();
  if (!text || text.length > 24000) throw new Error("Invalid AI response");
  return text;
}
export const jsonHeaders = { "Cache-Control": "no-store" };
export async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > 80000) throw new Error("Input too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 80000) { await reader.cancel(); throw new Error("Input too large"); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
