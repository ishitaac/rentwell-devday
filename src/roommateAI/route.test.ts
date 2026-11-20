import { describe, expect, it, vi } from "vitest";

import { createLlmDeps } from "../../server/roommateAI/llm";
import { createRoommateAiRoute } from "../../server/roommateAI/route";
import { SCENARIO_IDS } from "./simulator";

const KEY = "sk-test-secret-key";
const ENV = { ROOMMATE_AI_ENABLED: "1", ANTHROPIC_API_KEY: KEY };
const post = (body: unknown) => new Request("https://x.test/api/roommate-ai", { method: "POST", body: JSON.stringify(body) });
const reply = (text: string) => vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 }));
const asFetch = (f: unknown) => f as typeof fetch;

function authed(fetchImpl: unknown, env: Record<string, string | undefined> = ENV) {
  return createRoommateAiRoute(env, {
    llm: createLlmDeps(env, { fetch: asFetch(fetchImpl) }),
    authenticate: async () => ({ userId: "u1" }),
    authorizeSession: async (u, s) => u === "u1" && s === "s1",
  });
}

describe("route without authentication (the state of this repository)", () => {
  it("is invisible when the flag is off and never calls the model", async () => {
    const fetchMock = reply("{}");
    const route = createRoommateAiRoute({}, { llm: createLlmDeps({}, { fetch: asFetch(fetchMock) }) });
    expect((await route(post({ task: "extract", text: "hi" }))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("denies every task with 401 even when enabled and keyed, and never calls the model", async () => {
    const fetchMock = reply("{}");
    const route = createRoommateAiRoute(ENV, { llm: createLlmDeps(ENV, { fetch: asFetch(fetchMock) }) });
    for (const task of ["extract", "narrate", "suggest"]) {
      const res = await route(post({ task, text: "I keep a tidy kitchen", sessionId: "s1" }));
      expect(res.status).toBe(401);
      expect(await res.text()).not.toContain(KEY);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects GET without leaking anything", async () => {
    const route = createRoommateAiRoute(ENV);
    expect((await route(new Request("https://x.test/api/roommate-ai"))).status).toBe(405);
  });
});

describe("route with test-supplied authentication and a mocked model", () => {
  it("extract: returns AI output through validation", async () => {
    const res = await authed(reply('{"extractions":[]}'))(post({ task: "extract", text: "I study late and keep things tidy." }));
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe("ai");
  });

  it("narrate: returns validated narrations", async () => {
    const out = JSON.stringify({ narrations: [{ id: SCENARIO_IDS[0], situation: "A", friction: "B", compromise: "C", discussionQuestion: "D" }] });
    const res = await authed(reply(out))(post({ task: "narrate", scenarios: [{ id: SCENARIO_IDS[0], situation: "s", friction: "f", compromise: "c", question: "q" }] }));
    const body = await res.json();
    expect(body.source).toBe("ai");
    expect(body.narrations).toHaveLength(1);
  });

  it("suggest: needs session membership, and a non-member never reaches the model", async () => {
    const fetchMock = reply('{"suggestions":["Quiet hours start at 10 PM on weeknights."]}');
    const route = authed(fetchMock);
    const body = { task: "suggest", topic: "quiet-hours", positions: ["early sleeper", "night owl"] };
    expect((await route(post({ ...body, sessionId: "other" }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    const ok = await route(post({ ...body, sessionId: "s1" }));
    expect((await ok.json()).source).toBe("ai");
  });

  describe("upstream failures degrade safely and never leak upstream detail or the key", () => {
    const failures: Array<[string, unknown]> = [
      ["HTTP 500", vi.fn(async () => new Response("secret-upstream-detail", { status: 500 }))],
      ["HTTP 429", vi.fn(async () => new Response("secret-upstream-detail", { status: 429 }))],
      ["network error", vi.fn(async () => { throw new Error("secret-upstream-detail"); })],
      ["malformed JSON", reply("not json at all")],
      ["wrong shape", reply('{"unexpected":true}')],
    ];
    for (const [name, fetchMock] of failures) {
      it(`extract falls back to deterministic on ${name}`, async () => {
        const res = await authed(fetchMock)(post({ task: "extract", text: "I go to bed early and like a quiet home." }));
        const text = await res.text();
        expect(res.status).toBe(200);
        expect(JSON.parse(text).source).toBe("deterministic-fallback");
        expect(text).not.toContain("secret-upstream-detail");
        expect(text).not.toContain(KEY);
      });
      it(`suggest reports unavailable on ${name}`, async () => {
        const res = await authed(fetchMock)(post({ task: "suggest", sessionId: "s1", topic: "quiet-hours", positions: ["early sleeper", "night owl"] }));
        const text = await res.text();
        expect(res.status).toBe(200);
        expect(JSON.parse(text)).toEqual({ source: "unavailable", suggestions: [] });
        expect(text).not.toContain("secret-upstream-detail");
      });
    }
  });

  it("missing key with the flag on falls back instead of failing", async () => {
    const env = { ROOMMATE_AI_ENABLED: "1" };
    const res = await authed(reply("{}"), env)(post({ task: "extract", text: "I keep a tidy kitchen." }));
    expect((await res.json()).source).toBe("deterministic-fallback");
  });
});
