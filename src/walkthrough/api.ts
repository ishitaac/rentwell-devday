import { cacheKey, hashBytes, resultCache } from "./lib/cache";
import type { ShotAnalysis, UnitType } from "./lib/types";
import { validatePhotoResult } from "./lib/validate";

/** Browser client for /api/analyze-photo. Results are cached by image hash and validated again here. */

const CLIENT_TIMEOUT_MS = 30_000;

function base64Bytes(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

const FAILURE_TEXT: Record<string, string> = {
  timeout: "Timed out",
  rate_limited: "Too many photos at once",
  no_key: "Photo analysis is not set up on this server",
  invalid_input: "Photo could not be sent",
  offline: "No connection",
};

/** At most three photo calls in flight across the whole app, so a fast tour doesn't trip rate limits. */
const MAX_IN_FLIGHT = 3;
let inFlight = 0;
const waiting: (() => void)[] = [];

async function acquire(): Promise<void> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight += 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function release(): void {
  const next = waiting.shift();
  if (next) next();
  else inFlight -= 1;
}

export async function analyzeShot(
  unitType: UnitType,
  shotId: string,
  base64: string,
  renterPrompt?: string,
): Promise<ShotAnalysis> {
  await acquire();
  try {
    return await analyzeNow(unitType, shotId, base64, renterPrompt);
  } finally {
    release();
  }
}

async function analyzeNow(
  unitType: UnitType,
  shotId: string,
  base64: string,
  renterPrompt?: string,
): Promise<ShotAnalysis> {
  // crypto.subtle only exists on HTTPS or localhost; without it, skip the cache rather than fail.
  const key = globalThis.crypto?.subtle
    ? cacheKey(await hashBytes(base64Bytes(base64)), unitType, `${shotId}:${renterPrompt ?? ""}`)
    : null;
  const cached = key ? resultCache.get(key) : null;
  if (cached) return { shotId, state: "ok", result: cached };

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const response = await fetch("/api/analyze-photo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ unitType, shotId, imageBase64: base64, renterPrompt }),
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
    if (!response.ok) {
      const code = body?.error?.code ?? "upstream";
      return { shotId, state: "failed", reason: FAILURE_TEXT[code] ?? "Could not analyze" };
    }
    const outcome = validatePhotoResult(body, unitType, shotId);
    if (!outcome.ok) return { shotId, state: "failed", reason: "Could not analyze" };
    if (key) resultCache.set(key, outcome.result);
    return { shotId, state: "ok", result: outcome.result };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return {
      shotId,
      state: "failed",
      reason: aborted ? FAILURE_TEXT.timeout : FAILURE_TEXT.offline,
    };
  } finally {
    window.clearTimeout(timer);
  }
}
