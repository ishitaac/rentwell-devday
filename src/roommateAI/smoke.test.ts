/**
 * Real Claude API smoke test. Skipped everywhere unless ROOMMATE_AI_SMOKE=1, which only the manual,
 * secret-gated CI job sets. It makes ONE real call. The authentication here exists only inside this test.
 */
import { describe, expect, it } from "vitest";

import { createDemoRoute } from "../../server/roommateAI/demo";
import { createRoommateAiRoute } from "../../server/roommateAI/route";

describe.skipIf(process.env.ROOMMATE_AI_SMOKE !== "1")("real Claude API smoke test", () => {
  it("is configured with a secret", () => {
    expect(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY must be set for the smoke test").toBeTruthy();
  });

  it("extract works end to end through the handler", { timeout: 60_000 }, async () => {
    const route = createRoommateAiRoute({ ...process.env, ROOMMATE_AI_ENABLED: "1" }, { authenticate: async () => ({ userId: "smoke-test" }) });
    const res = await route(new Request("https://smoke.test/api/roommate-ai", { method: "POST", body: JSON.stringify({ task: "extract", text: "I go to bed by 10pm, keep the kitchen clean, and prefer no overnight guests." }) }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.source).toBe("ai");
    expect(Array.isArray(body.extractions)).toBe(true);
  });

  it("the fictional roommate chats and holds its boundary (one real call)", { timeout: 60_000 }, async () => {
    const code = "smoke-test-access-code";
    const env = { ...process.env, ROOMMATE_AI_ENABLED: "1", ROOMMATE_DEMO_ENABLED: "1", ROOMMATE_DEMO_ACCESS_CODE: code };
    const route = createDemoRoute(env);
    const message = "How about quiet hours start at 11:30 PM on weeknights?";
    const res = await route(new Request("https://smoke.test/api/roommate-demo", { method: "POST", headers: { "x-demo-code": code }, body: JSON.stringify({ personaId: "demo-jordan", message, history: [], openTopics: ["quiet-hours"], flaggedTopics: [], compatibility: [] }) }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.source).toBe("ai");
    expect(body.reply.message.length).toBeGreaterThan(0);
    // Deterministic rules hold even with the real model: Jordan never accepts a 11:30 PM start.
    expect(body.reply.stance).not.toBe("accept");
  });
});
