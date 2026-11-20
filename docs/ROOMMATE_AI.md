# Find a Roommate: AI Compatibility, Living Simulator & Negotiator (beta)

Branch `feature/ai-roommate-intelligence`, started from `feature/unified-renter-journey` @ `fe2b55c` (see `DEVDAY_BASELINE.md`).

## Status by component

| Component | Status | Notes |
|---|---|---|
| Compliance rules (`src/roommateAI/compliance.ts`) | **Live (deterministic)** | Versioned; every sensitive behavior RESTRICTED or UNVERIFIED (disabled). No rule has had legal review (`reviewerStatus: unreviewed`). |
| Intake, confirmation, clarification (`intake.ts`) | **Live (on-device rules)** | Free-text reading uses deterministic phrase rules. Claude-assisted reading is NOT connected in the UI. |
| Matching (`matching.ts`) | **Live (deterministic)** | Confirmed fields only; unknown is never incompatible; required conflicts can't be outweighed. |
| Simulator (`simulator.ts`, UI) | **Live (deterministic text)** | Claude narration validators exist; narration is not requested by the UI. |
| Negotiator state machine (`negotiation.ts`) | **Implemented and tested** | Server-enforceable rules, revision checks, per-user approvals. In-memory store only. |
| Negotiator UI + fictional AI roommate | **Interactive demo** | Chat with a labeled FICTIONAL AI roommate (Jordan; Maya/Alex/Riley also have personas). Replies come from Claude via `api/roommate-demo.ts` when a presenter access code is entered and the endpoint is enabled; otherwise (or on any failure) a deterministic scripted responder answers, labeled "Scripted fallback". Claude writes the conversation only: acceptable terms, accept/reject/counter, and every state change are decided by `src/roommateAI/jordan.ts` and the negotiation state machine. "Approvals" from the roommate are simulated, are not consent, and are not binding. In-memory, single browser session. |
| Claude server code (`server/roommateAI/`, `api/roommate-ai.ts`) | **Mounted, deny-by-default; not live** | Route returns 404 unless `ROOMMATE_AI_ENABLED=1` and 401 for everyone until a deployment supplies `authenticate`/`authorizeSession`. Tasks: `extract`, `narrate`, `suggest`. Tested against mocked `fetch` (incl. upstream failure paths). A real-API smoke test (`src/roommateAI/smoke.test.ts`) runs only via the manual `ai-smoke` CI job with the `ANTHROPIC_API_KEY` secret. The UI does not call these endpoints. No follow-up-question task exists yet (follow-ups are deterministic). |
| Authentication, database, real two-user participation | **Unavailable** | This branch has none. Handlers deny everyone until a deployment supplies `authenticate` / `authorizeSession`. |

## Requires legal review before any public release

Gender-based filtering (UNVERIFIED, disabled), jurisdiction coverage beyond Utah/federal, municipal rules, privacy-law applicability, the household-expectations wording, and the assistance-animal handling. Counsel should also review the legal references in `compliance.ts` (pointers only; Roommates.com is Ninth Circuit authority and is not treated as binding in Utah).

## Run it

```
VITE_ROOMMATE_AI=1 pnpm dev      # shows "Describe how you live (AI beta)" on the Living preferences screen
pnpm test                        # vitest
pnpm test:data                   # node data-script tests
# Browser E2E runs in CI only (job `e2e`, Playwright pinned in e2e/)
# (new tests are in src/roommateAI/ and src/RoommateAI.test.tsx)
```

Server variables (see `.env.example`): `ROOMMATE_AI_ENABLED`, `ANTHROPIC_API_KEY`, `ROOMMATE_AI_MODEL`, `ROOMMATE_AI_MAX_TOKENS`, `ROOMMATE_AI_TIMEOUT_MS`, `ROOMMATE_AI_MAX_INPUT_CHARS`, `ROOMMATE_AI_RATE_LIMIT`. The API key is read only on the server and is never sent to the client.

## Integration notes

- `src/App.tsx` changes are additive: one `Screen` value, one nav-section entry, one flag-gated button on Preferences, one flag-gated render line. With `VITE_ROOMMATE_AI` unset, behavior is unchanged.
- `main` has a separate Claude integration for Fine Print (`server/anthropic.ts`, SDK + zod). It is not on this branch. `server/roommateAI/llm.ts` uses plain `fetch` to avoid new dependencies; consolidate the two when the branches meet.

## Demo endpoint (`api/roommate-demo.ts`)

Not user authentication, and it does not pretend to be. It is off unless `ROOMMATE_AI_ENABLED=1`, `ROOMMATE_DEMO_ENABLED=1` and `ROOMMATE_DEMO_ACCESS_CODE` (12+ chars) are set, and every request must carry the code in `x-demo-code` (timing-safe compare). It uses a server-side synthetic persona and accepts no profile/account data, caps tokens (450), enforces per-IP and daily limits (per server instance, so use a shared store if you scale out), an optional origin allowlist, and throttles wrong-code attempts. Unsafe or protected-category text never reaches the model. Set a spend limit on the Anthropic key as well.
