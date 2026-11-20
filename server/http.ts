/** Small HTTP helpers shared by the /api handlers. Server-only. */

export const MAX_LEASE_CHARS = 50_000;
export const MAX_QUESTION_CHARS = 500;

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse(status, { error: { code, message } });
}

/** Best-effort client IP. Vercel sets x-forwarded-for; locally there is none. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 30;
const hits = new Map<string, number[]>();

/**
 * Per-IP sliding-window limit. In-memory, so it is per function instance:
 * a basic guard against accidental loops and casual abuse, not a hard quota.
 */
export function isRateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  const limited = recent.length >= RATE_MAX_REQUESTS;
  hits.set(ip, limited ? recent : [...recent, now]);
  return limited;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
