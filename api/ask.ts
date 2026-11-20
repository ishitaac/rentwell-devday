import { answerQuestion } from "../server/ask.js";
import {
  clientIp,
  errorResponse,
  isRateLimited,
  jsonResponse,
  MAX_LEASE_CHARS,
  MAX_QUESTION_CHARS,
  readJson,
} from "../server/http.js";
import type { AskRequest } from "../src/finePrint/lib/lanes.js";

const MAX_CLAUSES = 5_000; // the 50k-character cap is the real limit; this only rejects absurd payloads

/** Validates the untrusted request body into an AskRequest, or returns an error message. */
function parseRequest(body: unknown): AskRequest | string {
  const b = body as Partial<AskRequest> | null;
  if (!b || typeof b.question !== "string" || !b.question.trim()) return "Ask a question about the lease.";
  if (b.question.length > MAX_QUESTION_CHARS) return `Keep questions under ${MAX_QUESTION_CHARS} characters.`;
  const clauses = b.leaseClauses;
  if (!Array.isArray(clauses) || clauses.length === 0 || clauses.length > MAX_CLAUSES) return "Missing lease clauses.";
  const clean = clauses.filter(
    (c) => c && typeof c.id === "string" && typeof c.section === "string" && typeof c.text === "string",
  );
  if (clean.length !== clauses.length) return "Malformed lease clauses.";
  if (clean.reduce((n, c) => n + c.text.length, 0) > MAX_LEASE_CHARS) return "Lease is too long.";
  const topics = b.analysis?.topics;
  if (!Array.isArray(topics)) return "Missing lease topics.";
  return {
    question: b.question.trim(),
    analysis: { topics, charges: Array.isArray(b.analysis?.charges) ? b.analysis.charges : [] },
    leaseClauses: clean.map((c) => ({ id: c.id, section: c.section, text: c.text, ...(c.heading ? { heading: c.heading } : {}) })),
  };
}

export async function POST(request: Request): Promise<Response> {
  if (isRateLimited(clientIp(request))) {
    return errorResponse(429, "rate_limited", "Too many questions. Try again in a few minutes.");
  }
  const parsed = parseRequest(await readJson(request));
  if (typeof parsed === "string") return errorResponse(400, "invalid_input", parsed);
  try {
    return jsonResponse(200, await answerQuestion(parsed));
  } catch {
    return errorResponse(502, "upstream", "Fine Print couldn't answer right now.");
  }
}
