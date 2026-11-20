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
| Negotiator UI | **Demo-only** | Uses a scripted FICTIONAL roommate. Every response from the fictional side requires the user to press a button labeled "Play <name>". No real invitation, consent or approval exists. |
| Claude server code (`server/roommateAI/`) | **Prepared, not live** | Tested only against mocked `fetch`. Not mounted on any route. Never called against the real API. |
| Authentication, database, real two-user participation | **Unavailable** | This branch has none. Handlers deny everyone until a deployment supplies `authenticate` / `authorizeSession`. |

## Requires legal review before any public release

Gender-based filtering (UNVERIFIED, disabled), jurisdiction coverage beyond Utah/federal, municipal rules, privacy-law applicability, the household-expectations wording, and the assistance-animal handling. Counsel should also review the legal references in `compliance.ts` (pointers only; Roommates.com is Ninth Circuit authority and is not treated as binding in Utah).

## Run it

```
VITE_ROOMMATE_AI=1 pnpm dev      # shows "Describe how you live (AI beta)" on the Living preferences screen
pnpm test                        # vitest (new tests are in src/roommateAI/ and src/RoommateAI.test.tsx)
```

Server variables (see `.env.example`): `ROOMMATE_AI_ENABLED`, `ANTHROPIC_API_KEY`, `ROOMMATE_AI_MODEL`, `ROOMMATE_AI_MAX_TOKENS`, `ROOMMATE_AI_TIMEOUT_MS`, `ROOMMATE_AI_MAX_INPUT_CHARS`, `ROOMMATE_AI_RATE_LIMIT`. The API key is read only on the server and is never sent to the client.

## Integration notes

- `src/App.tsx` changes are additive: one `Screen` value, one nav-section entry, one flag-gated button on Preferences, one flag-gated render line. With `VITE_ROOMMATE_AI` unset, behavior is unchanged.
- `main` has a separate Claude integration for Fine Print (`server/anthropic.ts`, SDK + zod). It is not on this branch. `server/roommateAI/llm.ts` uses plain `fetch` to avoid new dependencies; consolidate the two when the branches meet.
