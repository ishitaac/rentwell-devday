import { analyzeLease } from "../server/analyze.js";
import { ModelError } from "../server/anthropic.js";
import {
  clientIp,
  errorResponse,
  isRateLimited,
  jsonResponse,
  MAX_LEASE_CHARS,
  readJson,
} from "../server/http.js";

const STATUS_BY_CODE: Record<ModelError["code"], number> = {
  no_key: 503,
  timeout: 504,
  rate_limited: 429,
  refused: 422,
  bad_output: 502,
  upstream: 502,
};

export async function POST(request: Request): Promise<Response> {
  if (isRateLimited(clientIp(request))) {
    return errorResponse(429, "rate_limited", "Too many requests. Try again in a few minutes.");
  }
  const body = await readJson(request);
  const leaseText = (body as { leaseText?: unknown } | null)?.leaseText;
  if (typeof leaseText !== "string" || leaseText.trim().length < 50) {
    return errorResponse(400, "invalid_input", "Paste the full lease text (at least a few sentences).");
  }
  if (leaseText.length > MAX_LEASE_CHARS) {
    return errorResponse(413, "too_long", `Leases are capped at ${MAX_LEASE_CHARS.toLocaleString()} characters.`);
  }
  try {
    return jsonResponse(200, await analyzeLease(leaseText));
  } catch (error) {
    if (error instanceof ModelError) {
      return errorResponse(STATUS_BY_CODE[error.code], error.code, error.message);
    }
    return errorResponse(500, "internal", "Something went wrong reading this lease.");
  }
}
