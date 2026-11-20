/**
 * Browser-side client for the fictional roommate. Calls the restricted demo endpoint only when the presenter
 * supplied an access code, and ALWAYS falls back to the deterministic responder on any problem (no code, 4xx/5xx,
 * network error, timeout, non-JSON such as a static host's HTML page, or an invalid/unsafe reply).
 */
import { parseJordanReply, personaFor, scriptedReply, type JordanReply, type JordanTurnInput } from "./jordan";

export type ReplySource = "ai" | "scripted-fallback";
export interface JordanResult {
  source: ReplySource;
  reply: JordanReply;
  /** Why the scripted fallback was used, for the UI status line. */
  fallbackReason?: "no-code" | "unavailable";
}

export interface ClientOptions {
  code?: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
  timeoutMs?: number;
}

export async function requestJordanReply(input: JordanTurnInput, options: ClientOptions = {}): Promise<JordanResult> {
  const persona = personaFor(input.personaId);
  if (!persona) throw new Error("Unknown persona");
  const fallback = (fallbackReason: "no-code" | "unavailable"): JordanResult => ({ source: "scripted-fallback", reply: scriptedReply(persona, input), fallbackReason });
  if (!options.code) return fallback("no-code");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 25_000);
  try {
    const res = await (options.fetchImpl ?? fetch)(options.endpoint ?? "/api/roommate-demo", {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-demo-code": options.code },
      body: JSON.stringify(input),
    });
    if (!res.ok) return fallback("unavailable");
    const body = (await res.json()) as { source?: unknown; reply?: unknown };
    const reply = parseJordanReply(body?.reply);
    if (!reply) return fallback("unavailable");
    return body.source === "ai" ? { source: "ai", reply } : { source: "scripted-fallback", reply, fallbackReason: "unavailable" };
  } catch {
    return fallback("unavailable");
  } finally {
    clearTimeout(timer);
  }
}
