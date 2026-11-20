/**
 * Route adapter for the roommate AI handler. Server-only.
 *
 * RentWell has no authentication, so by default every request is denied (401) and the feature is invisible
 * (404) unless ROOMMATE_AI_ENABLED=1. A deployment that adds real authentication passes `authenticate` and
 * `authorizeSession` as overrides; nothing here invents users, consent or sessions.
 */
import { createRateLimiter, denyAll, handleRoommateAi, type HandlerDeps } from "./handlers";
import { createLlmDeps } from "./llm";

export function createRoommateAiRoute(env: Record<string, string | undefined>, overrides: Partial<HandlerDeps> = {}) {
  // Safe log: task name, outcome and timing only (see llm.ts). Never user text, model output or the key.
  const llm = overrides.llm ?? createLlmDeps(env, { log: (entry) => console.info("[roommate-ai]", JSON.stringify(entry)) });
  const limiter = overrides.limiter ?? createRateLimiter(llm.config.rateLimitMax, llm.config.rateLimitWindowMs);
  const deps: HandlerDeps = { ...denyAll, ...overrides, llm, limiter };
  return (request: Request) => handleRoommateAi(request, deps);
}
