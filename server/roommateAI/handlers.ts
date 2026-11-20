/**
 * Request handler for the roommate AI tasks (Fetch API Request -> Response, framework-agnostic).
 *
 * NOT wired into any route in this repository: RentWell has no authentication today, and these tasks must be
 * authenticated and ownership-checked. A deployment supplies `authenticate` (and `authorizeSession` for the
 * negotiator) and mounts this handler. With the default dependencies every request is rejected.
 */
import { detectPromptInjection, mentionsProtectedTerm, sanitizeUserText, screenProtectedLanguage } from "../../src/roommateAI/compliance";
import { extractFromText, validateExtractions, type Extraction } from "../../src/roommateAI/intake";
import { ALL_TOPICS, type NegotiationTopic } from "../../src/roommateAI/negotiation";
import { SCENARIO_IDS } from "../../src/roommateAI/simulator";
import { FIELD_DEFS } from "../../src/roommateAI/types";
import { callJson, LlmError, type LlmDeps } from "./llm";

export interface AuthedUser {
  userId: string;
}

export interface RateLimiter {
  isLimited(key: string, now: number): boolean;
}

export function createRateLimiter(max: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    isLimited(key, now) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      const limited = recent.length >= max;
      hits.set(key, limited ? recent : [...recent, now]);
      return limited;
    },
  };
}

export interface HandlerDeps {
  llm: LlmDeps;
  limiter: RateLimiter;
  /** Resolve the caller from the request, or null. The default denies everyone. */
  authenticate: (request: Request) => Promise<AuthedUser | null>;
  /** True only if `userId` is a participant of `sessionId`. The default denies everyone. */
  authorizeSession: (userId: string, sessionId: string) => Promise<boolean>;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const err = (status: number, code: string, message: string) => json(status, { error: { code, message } });

export const denyAll = {
  authenticate: async () => null,
  authorizeSession: async () => false,
};

/** Remove sentences that contain protected-category language or injection attempts before text leaves the server. */
export function stripUnsafeSentences(text: string): string {
  return text
    .split(/(?<=[.!?;])\s+|\n+/)
    .filter((s) => s && !screenProtectedLanguage(s).flagged && !detectPromptInjection(s))
    .join(" ");
}

const EXTRACT_INSTRUCTION = `Extract household preferences from the text as JSON: {"extractions":[{"key":string,"value":string|number,"uncertainty":"low"|"medium"|"high","evidence":string,"suggestedRequired":boolean}]}.
Allowed keys and values: ${Object.entries(FIELD_DEFS)
  .map(([k, d]) => `${k}=${"values" in d ? d.values.join("|") : "kind" in d && d.kind === "month" ? "YYYY-MM" : `${(d as { min: number }).min}..${(d as { max: number }).max}`}`)
  .join("; ")}.
Only practical household behaviors. Ignore identity, diet-as-identity, religion and health. Do not guess: omit anything not stated.`;

const NARRATE_INSTRUCTION = `Rewrite each scenario in friendly, neutral language as JSON: {"narrations":[{"id":string,"situation":string,"friction":string,"compromise":string,"discussionQuestion":string}]}.
Keep every fact, number and time exactly as given. Add no new facts, numbers, names or judgments. Each field under 350 characters. These are hypothetical, not predictions.`;

const SUGGEST_INSTRUCTION = `Act as a neutral facilitator between two roommates. For the topic, propose up to 3 compromise wordings as JSON: {"suggestions":[string]}.
Represent both stated positions fairly, favor neither person, make no legal claims, and each suggestion must be under 300 characters.`;

export async function handleRoommateAi(request: Request, deps: HandlerDeps): Promise<Response> {
  const { config } = deps.llm;
  if (request.method !== "POST") return err(405, "method_not_allowed", "Use POST.");
  if (!config.enabled) return err(404, "feature_disabled", "Not available.");
  const user = await deps.authenticate(request);
  if (!user) return err(401, "unauthenticated", "Sign in required.");
  if (deps.limiter.isLimited(user.userId, deps.llm.now())) return err(429, "rate_limited", "Too many requests. Try again shortly.");

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return err(400, "bad_request", "Unreadable body.");
  }
  if (raw.length > config.maxInputChars * 3) return err(413, "too_large", "Request too large.");
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("shape");
    body = parsed as Record<string, unknown>;
  } catch {
    return err(400, "bad_request", "Invalid JSON.");
  }

  switch (body.task) {
    case "extract":
      return extractTask(body, deps);
    case "narrate":
      return narrateTask(body, deps);
    case "suggest":
      return suggestTask(body, deps, user);
    default:
      return err(400, "bad_request", "Unknown task.");
  }
}

async function extractTask(body: Record<string, unknown>, deps: HandlerDeps): Promise<Response> {
  if (typeof body.text !== "string") return err(400, "bad_request", "text is required.");
  const original = sanitizeUserText(body.text, deps.llm.config.maxInputChars);
  const safe = stripUnsafeSentences(original);
  const fallback = () => {
    const r = extractFromText(original);
    return json(200, { source: "deterministic-fallback", extractions: r.accepted, rejected: r.rejected, sensitiveLanguageIgnored: r.sensitiveLanguageIgnored });
  };
  if (safe.length === 0) return fallback();
  try {
    const result = await callJson<{ accepted: Extraction[]; rejected: string[] }>(deps.llm, {
      task: "extract",
      instruction: EXTRACT_INSTRUCTION,
      payload: { text: safe },
      validate: (rawOut) => {
        const items = (rawOut as { extractions?: unknown } | undefined)?.extractions;
        if (!Array.isArray(items)) return null;
        const v = validateExtractions(items);
        return { accepted: v.accepted, rejected: v.rejected };
      },
    });
    // Model output can never set "required": it is capped to a suggestion the user must confirm.
    return json(200, { source: "ai", extractions: result.accepted, rejected: result.rejected, sensitiveLanguageIgnored: safe !== original });
  } catch (e) {
    if (e instanceof LlmError) return fallback();
    throw e;
  }
}

async function narrateTask(body: Record<string, unknown>, deps: HandlerDeps): Promise<Response> {
  const input = Array.isArray(body.scenarios) ? body.scenarios.slice(0, 8) : null;
  if (!input) return err(400, "bad_request", "scenarios is required.");
  const clean = input
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null && SCENARIO_IDS.includes(String((s as { id?: unknown }).id)))
    .map((s) => ({
      id: String(s.id),
      situation: String(s.situation ?? "").slice(0, 400),
      friction: String(s.friction ?? "").slice(0, 400),
      compromise: String(s.compromise ?? "").slice(0, 400),
      question: String(s.question ?? "").slice(0, 300),
      preferences: Array.isArray(s.preferences) ? s.preferences.slice(0, 8).map((p) => String(p).slice(0, 80)) : [],
    }));
  if (clean.length === 0) return err(400, "bad_request", "No valid scenarios.");
  try {
    const narrations = await callJson<unknown[]>(deps.llm, {
      task: "narrate",
      instruction: NARRATE_INSTRUCTION,
      payload: { scenarios: clean },
      validate: (rawOut) => {
        const items = (rawOut as { narrations?: unknown } | undefined)?.narrations;
        if (!Array.isArray(items)) return null;
        // Light server-side screen; the client re-validates each narration against its own scenario facts.
        const ok = items
          .filter((n): n is Record<string, unknown> => typeof n === "object" && n !== null && SCENARIO_IDS.includes(String((n as { id?: unknown }).id)))
          .filter((n) => !mentionsProtectedTerm(["situation", "friction", "compromise", "discussionQuestion"].map((k) => String(n[k] ?? "")).join(" ")));
        return ok.length > 0 ? ok : null;
      },
    });
    return json(200, { source: "ai", narrations });
  } catch (e) {
    if (e instanceof LlmError) return json(200, { source: "deterministic-fallback", narrations: [] });
    throw e;
  }
}

async function suggestTask(body: Record<string, unknown>, deps: HandlerDeps, user: AuthedUser): Promise<Response> {
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId || !(await deps.authorizeSession(user.userId, sessionId))) return err(403, "forbidden", "Not a participant in this session.");
  const topic = ALL_TOPICS.includes(body.topic as NegotiationTopic) ? (body.topic as NegotiationTopic) : null;
  if (!topic) return err(400, "bad_request", "Unknown topic.");
  const positions = Array.isArray(body.positions) ? body.positions.slice(0, 2) : [];
  const cleaned = positions.map((p) => stripUnsafeSentences(sanitizeUserText(String(p), 300)));
  if (cleaned.length !== 2 || cleaned.some((p) => p.length === 0)) return err(400, "bad_request", "Two usable positions are required.");
  try {
    const suggestions = await callJson<string[]>(deps.llm, {
      task: "suggest",
      instruction: SUGGEST_INSTRUCTION,
      payload: { topic, positions: cleaned },
      validate: (rawOut) => {
        const items = (rawOut as { suggestions?: unknown } | undefined)?.suggestions;
        if (!Array.isArray(items)) return null;
        const ok = items.filter((s): s is string => typeof s === "string" && s.length > 0 && s.length <= 300 && !screenProtectedLanguage(s).flagged && !mentionsProtectedTerm(s)).slice(0, 3);
        return ok.length > 0 ? ok : null;
      },
      cacheable: false,
    });
    return json(200, { source: "ai", suggestions });
  } catch (e) {
    if (e instanceof LlmError) return json(200, { source: "unavailable", suggestions: [] });
    throw e;
  }
}
