import { describe, expect, it, vi } from "vitest";

import type { JordanReply, JordanTurnInput } from "./jordan";
import { requestJordanReply } from "./jordanClient";

const input: JordanTurnInput = { personaId: "demo-jordan", message: "How about quiet hours start at 11:30 PM on weeknights?", history: [], openTopics: ["quiet-hours"], flaggedTopics: [], compatibility: [] };
const aiReply: JordanReply = { message: "Could we do 10 PM?", stance: "counter", topic: "quiet-hours", proposalText: input.message, counterText: "Quiet hours start at 10 PM.", overridden: false };
const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
const f = (m: unknown) => m as typeof fetch;

describe("fictional roommate client", () => {
  it("makes no network call without a presenter code and uses the scripted responder", async () => {
    const m = ok({});
    const r = await requestJordanReply(input, { fetchImpl: f(m) });
    expect(m).not.toHaveBeenCalled();
    expect(r.source).toBe("scripted-fallback");
    expect(r.fallbackReason).toBe("no-code");
    expect(r.reply.stance).toBe("counter");
  });

  it("uses the server reply and sends the code only as a header", async () => {
    const m = ok({ source: "ai", reply: aiReply });
    const r = await requestJordanReply(input, { code: "demo-code-123456", fetchImpl: f(m) });
    expect(r.source).toBe("ai");
    expect(r.reply.message).toBe("Could we do 10 PM?");
    const [, init] = m.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-demo-code"]).toBe("demo-code-123456");
    expect(String(init.body)).not.toContain("demo-code-123456");
  });

  it("labels a server-side fallback as scripted", async () => {
    const r = await requestJordanReply(input, { code: "demo-code-123456", fetchImpl: f(ok({ source: "deterministic-fallback", reply: aiReply })) });
    expect(r.source).toBe("scripted-fallback");
  });

  const failures: Array<[string, typeof fetch]> = [
    ["401", f(ok({ error: {} }, 401))],
    ["429", f(ok({ error: {} }, 429))],
    ["500", f(ok({ error: {} }, 500))],
    ["network error", f(vi.fn(async () => { throw new Error("offline"); }))],
    ["HTML from a static host", f(vi.fn(async () => new Response("<!doctype html><html></html>", { status: 200 })))],
    ["invalid reply shape", f(ok({ source: "ai", reply: { message: "hi", stance: "yes" } }))],
    ["unsafe reply text", f(ok({ source: "ai", reply: { ...aiReply, message: "Only people of my religion." } }))],
  ];
  for (const [name, fetchImpl] of failures) {
    it(`falls back to the deterministic responder on ${name}`, async () => {
      const r = await requestJordanReply(input, { code: "demo-code-123456", fetchImpl });
      expect(r.source).toBe("scripted-fallback");
      expect(r.fallbackReason).toBe("unavailable");
      expect(r.reply.stance).toBe("counter");
    });
  }

  it("falls back on timeout", async () => {
    const hang = f((_u: unknown, init?: RequestInit) => new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
    const r = await requestJordanReply(input, { code: "demo-code-123456", fetchImpl: hang, timeoutMs: 20 });
    expect(r.source).toBe("scripted-fallback");
  });
});
