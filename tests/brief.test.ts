import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { generateSchema, getQuestions, PRESET_IDEA, presetAnswers, questionListSchema, savedSchema, synthesizeBrief } from "../lib/brief";
import { POST as generate } from "../app/api/generate/route";
import { POST as questions } from "../app/api/questions/route";
import { GET as health } from "../app/api/health/route";

const input = { idea: PRESET_IDEA, preset: true, answers: presetAnswers, localOnly: false };
const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
afterEach(() => { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; });
const request = (body: unknown) => new Request("http://localhost/api/test", { method: "POST", body: JSON.stringify(body) });
const mockResponse = (text: string) => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }] });

test("preset produces deterministic, complete scout contract and parseable JSON schema", () => {
  const brief = synthesizeBrief(input);
  assert.equal(brief, synthesizeBrief(input));
  for (const value of Object.values(presetAnswers)) assert.ok(brief.includes(value));
  for (const marker of ["Asia/Seoul", "오프라인", "생성형 AI 광고물", "### 적합도 A/B", "scout-results.json", "공식", "빈 events"]) assert.ok(brief.includes(marker));
  const schema = JSON.parse(brief.match(/```json\n([\s\S]*?)\n```/)![1]);
  assert.deepEqual(schema.properties.events.items.properties.fit.enum, ["A", "B"]);
  assert.ok(schema.properties.events.items.required.includes("source_url"));
});
test("generic brief preserves custom answers without scout requirements", () => {
  const brief = synthesizeBrief({ ...input, preset: false, idea: "독서 기록 앱" });
  assert.ok(brief.includes("독서 기록 앱"));
  assert.ok(!brief.includes("스카우트 운영 명세"));
  assert.ok(brief.includes(presetAnswers.success));
});
test("input and saved data validation reject missing, whitespace, oversized, and corrupt values", () => {
  assert.equal(generateSchema.safeParse({ ...input, answers: {} }).success, false);
  assert.equal(generateSchema.safeParse({ ...input, idea: "  " }).success, false);
  assert.equal(generateSchema.safeParse({ ...input, answers: { ...presetAnswers, goal: "x".repeat(2001) } }).success, false);
  assert.equal(savedSchema.safeParse({ version: 2, markdown: "oops" }).success, false);
  assert.equal(questionListSchema.safeParse(getQuestions().reverse()).success, false);
});
test("no-key APIs support entire deterministic flow and health reports offline", async () => {
  delete process.env.OPENAI_API_KEY;
  globalThis.fetch = async () => { throw new Error("Must not call external API"); };
  assert.equal((await health().json()).mode, "offline");
  const q = await (await questions(request(input))).json();
  assert.equal(q.questions.length, 7);
  assert.equal(q.mode, "offline");
  const response = await generate(request(input));
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const data = await response.json();
  assert.equal(data.markdown, synthesizeBrief(input));
  assert.equal(data.mode, "offline");
});
test("invalid and oversized request bodies return 400", async () => {
  assert.equal((await generate(request({}))).status, 400);
  assert.equal((await questions(request({ idea: "x".repeat(45000) }))).status, 400);
  assert.equal((await generate(new Request("http://localhost/api/generate", { method: "POST", body: "{" }))).status, 400);
});
test("AI errors, refusals and malformed questions fall back gracefully", async () => {
  process.env.OPENAI_API_KEY = "test-only";
  globalThis.fetch = async () => Response.json({ error: "unavailable" }, { status: 429 });
  const failed = await (await generate(request(input))).json();
  assert.equal(failed.mode, "offline"); assert.equal(failed.fallback, true);
  globalThis.fetch = async () => mockResponse('{"questions": []}');
  const q = await (await questions(request(input))).json();
  assert.equal(q.mode, "offline"); assert.equal(q.questions.length, 7);
  globalThis.fetch = async () => Response.json({ status: "incomplete", output: [] });
  assert.equal((await (await generate(request(input))).json()).mode, "offline");
});
test("AI enriches questions and generation while preserving required contract; store is disabled", async () => {
  process.env.OPENAI_API_KEY = "test-only";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    assert.equal(body.store, false);
    return mockResponse(body.text ? JSON.stringify({ questions: getQuestions(true) }) : "### 데이터 모델\n맞춤 구현 설계입니다.");
  };
  assert.equal((await (await questions(request(input))).json()).mode, "ai");
  const result = await (await generate(request(input))).json();
  assert.equal(result.mode, "ai");
  assert.ok(result.markdown.startsWith(synthesizeBrief(input)));
  assert.ok(result.markdown.includes("맞춤 구현 설계입니다."));
});
test("explicit local mode never calls OpenAI even with key configured", async () => {
  process.env.OPENAI_API_KEY = "test-only";
  globalThis.fetch = async () => { assert.fail("Unexpected external call"); };
  const local = { ...input, localOnly: true };
  assert.equal((await (await generate(request(local))).json()).mode, "offline");
  assert.equal((await (await questions(request(local))).json()).mode, "offline");
});
