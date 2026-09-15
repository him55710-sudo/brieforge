export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ status: "ok", app: "BriefForge", version: "1.0.0", mode: process.env.OPENAI_API_KEY ? "ai" : "offline" }, { headers: { "Cache-Control": "no-store" } });
}
