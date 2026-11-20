# Find a Roommate — RentWell

> **Feature documentation | DevDay 2026 | Beta / demonstration**  
> **Repository:** [`ishitaac/rentwell-devday`](https://github.com/ishitaac/rentwell-devday)  
> **Integration:** merged into `dev` through [PR #15](https://github.com/ishitaac/rentwell-devday/pull/15), merge commit `e9ca950`  
> **Scope:** Find a Roommate only; not a general README for RentWell.

## 1. At a glance

**Find a Roommate** helps a renter describe the way they live, compare practical living requirements against potential roommates, explore what sharing a home might feel like, and discuss household expectations *before* moving in.

The feature moves beyond a generic compatibility checklist by combining:

1. **Conversational intake** — describe home life in natural language, then clarify and confirm structured preferences.
2. **Transparent matching** — compare only confirmed housing needs and everyday household habits, with explanations and explicit uncertainty.
3. **Living Together Simulator** — explore hypothetical day-to-day situations and possible friction points.
4. **Roommate negotiation** — discuss quiet hours, guests, cleaning, kitchen rules, expenses, and related topics, then summarize proposed expectations.
5. **Fictional AI roommate demo** — talk to Jordan (or another fictional persona) via a scripted fallback today; Claude-generated responses are supported by a gated server route but have **not yet been validated against the live Claude API**.
6. **Compliance-first boundaries** — protected-trait screening is disabled by default, with deterministic restrictions that Claude cannot override.

**Important:** This is a beta/demo with fictional candidate data. It is not a real roommate marketplace, a legal compliance certification, or a binding roommate agreement.

## 2. The problem we set out to solve

Traditional roommate questionnaires tend to reduce compatibility to broad multiple-choice labels. That can miss the issues that affect day-to-day living:

- Is a **private bedroom** essential, or is a shared room acceptable? What about the bathroom?
- What are the rent budget, move-in date, lease-length, and parking constraints?
- How do different sleep schedules, quiet hours, work-from-home routines, and guest habits fit together?
- Can someone who avoids meat cooking comfortably share a kitchen with someone who frequently cooks meat? The relevant question is about **cooking practices, shared equipment, and household expectations**, not a person's religion or identity.
- When two preferences clash, is there a workable compromise—or a true dealbreaker?

Our product direction is **compatibility based on the lived experience of sharing a home**, with an opportunity to discuss differences before committing to an arrangement.

## 3. End-to-end user journey

The implemented screen follows this seven-stage flow:

| Stage | What the user does | What RentWell does |
|---|---|---|
| **1. Housing** | Supplies housing and location context | Establishes the jurisdiction context and practical housing requirements |
| **2. Your home life** | Describes living habits in their own words | Extracts supported preferences using on-device, deterministic phrase rules |
| **3. Follow-ups** | Answers targeted clarification questions | Asks about missing or ambiguous supported fields with deterministic logic |
| **4. Confirm** | Reviews and edits extracted preferences; sets priorities | Uses only explicitly confirmed fields for matching and simulation |
| **5. Matches** | Reviews fictional candidate matches | Shows scores/categories, strengths, differences, unknowns, and required-need conflicts |
| **6. Simulator** | Explores hypothetical shared-living scenarios | Builds a day-in-the-life timeline and scenario-specific discussion prompts |
| **7. Agreement / chat** | Talks to a fictional roommate, proposes terms, revises terms, reviews a summary | Runs a deterministic negotiation state machine; shows scripted or, when securely enabled, Claude-authored fictional responses |

The user can correct or delete their entered profile during the session. The current UI holds this data in browser component state; no user account or server-side roommate profile database has been implemented for this feature.

### Example walkthrough

A renter says: “I study late, need my own bedroom, am fine sharing a bathroom, and would prefer separate cookware.” RentWell extracts only the supported household fields it recognizes, asks relevant follow-ups, and lets the renter confirm each preference. The user then compares the fictional candidates and chooses **Jordan**. The simulator may flag a quiet-hours or kitchen-routine difference, which the user can take into **Talk to Jordan** to negotiate a practical arrangement.

The fictional Jordan has consistent constraints: for example, Jordan prefers quiet hours around 10 PM, a tidy kitchen, advance notice for guests, and an even split of shared utilities. The underlying code—not the language model—enforces those constraints and records simulated proposal states.

## 4. What we built (A–Z implementation record)

### A. Integrated with the existing renter journey

- Built on the team's `feature/unified-renter-journey` work, rather than replacing the rest of RentWell.
- Added a flag-gated entry point into the existing roommate/living-preferences flow.
- Resolved `src/App.tsx` and `.env.example` integration conflicts with the latest `dev` while preserving the team's existing navigation and environment configuration.
- Integrated via PR #15, **not** a direct feature-to-`main` merge.

### B. Defined a constrained data model

The central field registry in `src/roommateAI/types.ts` covers four groups:

| Group | Examples |
|---|---|
| Housing | Budget share, move-in month, lease length, private/shared bedroom, private/shared bathroom, number of roommates, furnishing, parking |
| Schedule | Sleep schedule, quiet-hours start, noise tolerance, work/study from home |
| Shared spaces | Cleanliness, cookware-sharing rules, cooking frequency, smoking/vaping in shared areas, temperature |
| Social / coordination | Guests, overnight guests, expense splitting, conflict-resolution style |

Each field tracks a value, a priority (**required**, **preferred**, or **flexible**), how it was entered, uncertainty, clarification status, and whether the renter confirmed it.

The matching and simulator logic access **confirmed fields only**. An extracted suggestion cannot silently become a hard requirement.

### C. Built conversational onboarding and clarification

- Free-text preference extraction through deterministic rules in `intake.ts`.
- Targeted follow-up questions for missing or ambiguous supported details.
- User confirmation and editing before a preference is used in compatibility calculations.
- Unsupported or sensitive screening text is not converted into protected-trait matching criteria.

**Current limitation:** The user-facing extraction and follow-up flow is **not yet Claude-powered**. Live Claude extraction is scaffolded separately on the server but unavailable to the UI.

### D. Built an explainable compatibility engine

The engine in `matching.ts` is deterministic and uses **confirmed, mutually available** preferences. It separates:

1. **Required-need conflicts:** a hard mismatch, such as a required private bedroom when the available room is shared, is not canceled by a high lifestyle score.
2. **Preference overlap:** category-specific comparison of housing needs, schedules, shared spaces, and social habits.
3. **Mutual flexibility:** more tolerant preferences reduce the severity of some differences.
4. **Uncertainty:** missing information is surfaced as *unknown*, not labeled incompatible.

Default scoring weights: **Housing 30% · Schedule 25% · Shared spaces 25% · Social 20%**. Scores summarize overlap in stated habits; they do **not** predict interpersonal chemistry or guarantee a good match.

Fictional match fixtures live in `demoData.ts`: **Maya, Alex, Riley, and Jordan**. These are not actual users or available rental listings.

### E. Built the Living Together Simulator

- Generates hypothetical scenarios from known overlaps and differences.
- Provides a day-in-the-life timeline, friction descriptions, suggestions, and discussion prompts.
- Lets the user move from hypothetical friction to a conversation about household expectations.
- Uses deterministic, reviewable text today; there is validation infrastructure for AI narration, but the UI does not request live Claude narration.

The simulator is a decision aid, **not** a prediction of future conflict.

### F. Built a negotiation state machine

`negotiation.ts` models invitations, participation consent, topic opt-in, proposals, counteroffers/revisions, rejection, individual term approvals, and final summaries.

Key guardrails:

- Participants may discuss only topics opened through the modeled opt-in flow.
- A proposed term can be accepted, rejected, edited, or discussed.
- Editing a term increments its version and **clears earlier approvals**.
- Stale-version actions are rejected by revision checks.
- Finalized expectations require agreement to the current accepted terms in the underlying model.
- The final output describes household expectations; it is **not a lease or legally binding contract**.

**Current limitation:** The real two-person version has no production authentication, persistent database, invitation delivery, or enforceable real-user consent workflow. The current screen operates as a **single-user, in-memory simulation**.

### G. Replaced manual fictional responses with “Talk to Jordan”

- Added a chat interface for speaking with a clearly labeled **fictional AI roommate**.
- Added personas for Jordan, Maya, Alex, and Riley, each with stable, ordinary household preferences.
- Made simulated roommate responses automatic rather than requiring the presenter to press a separate “Play” button.
- Carries relevant conversation history, match notes, and simulator context into the response logic.
- Supports discussion, compromise, rejection, and counteroffers rather than unconditional agreement.
- Enforces persona boundaries in deterministic code even if a model response would violate them.
- Labels responses by their actual source: **Claude** or **Scripted fallback**, and labels simulated approvals as fictional rather than real consent.

With no presenter code, an unavailable endpoint, invalid response, or network error, the chat uses the scripted deterministic fallback. **A working chat demo does not by itself prove Claude was called.**

### H. Added server-side Claude infrastructure, but kept it disabled

Two endpoints exist:

| Endpoint | Purpose | Current status |
|---|---|---|
| `api/roommate-ai.ts` | General `extract`, `narrate`, `suggest` tasks | Mounted, disabled by default, and denies requests until real authentication and session authorization exist. Not connected to the UI. |
| `api/roommate-demo.ts` | Fictional roommate chat through Claude | Mounted but disabled by default; requires server flags, a presenter access code, and an Anthropic API key. Has not been live-API smoke-tested yet. |

There is **no live `followup` Claude task** in the general endpoint; user-facing follow-up questions remain deterministic.

Claude can generate proposed conversational wording, **not** override eligibility/compliance checks, match scoring, fictional persona boundaries, or negotiation-state transitions.

### I. Added demo-specific security controls

The fictional chat route:

- Requires server-side `ROOMMATE_AI_ENABLED=1` and `ROOMMATE_DEMO_ENABLED=1`.
- Requires a server-side `ROOMMATE_DEMO_ACCESS_CODE` of at least 12 characters, supplied by a presenter in the chat interface and not embedded in frontend source.
- Uses only synthetic persona data on the server; it is **not** real user authentication.
- Enforces input size, response token caps, an optional origin allowlist, per-IP throttling, wrong-code throttling, and daily request limits.
- Applies deterministic screening to unsafe or prohibited requests and falls back when the model fails.

**Operational caveat:** The rate counters are in-memory and per server instance, not a globally enforced distributed usage cap. Use provider-side spending controls for any live test or deployed demo. An access code protects the restricted demonstration; it does not replace production authentication.

### J. Added compliance safeguards and documented their limits

`compliance.ts` contains a versioned policy layer that differentiates **ALLOWED**, **RESTRICTED**, and **UNVERIFIED** decisions.

- All currently enumerated sensitive screening behaviors are **RESTRICTED** or **UNVERIFIED**, so they remain disabled.
- This includes screening by protected attributes, inferring protected identity, neighborhood-demographic proxies, and excluding assistance animals as ordinary pets.
- Dietary concerns are handled through **observable household practices** (for example, cookware sharing), not through assumptions about religion or other protected characteristics.
- A location context is collected to inform which laws need review. Only limited federal/Utah context is modeled; **municipal rules and other states are not fully evaluated**.
- The system does not assume that a court decision from the Ninth Circuit supplies a blanket roommate exception in Utah.
- Text screening is best-effort and term-based; it is **not** a comprehensive discrimination detector.

**Legal status:** No rule in the current compliance ruleset has received legal review. This feature must not be described as legally certified or launched for unrestricted real-user matching without qualified counsel's review.

### K. Automated verification and CI

The integration PR reported the following checks passing **on the proposed merge result**:

- **285 unit tests passed**, with **3 real-API smoke tests skipped**.
- **27/27 data tests passed**.
- TypeScript (`tsc --noEmit`) passed.
- Renter build, manager build, and feature-enabled build passed.
- **4 Playwright browser E2E tests passed**, testing feature-on and feature-off behavior.
- Feature flag on was tested with `VITE_ROOMMATE_AI=1`; flag off with `VITE_ROOMMATE_AI=0`.

The tests cover intake, compliance, matching, simulator behavior, negotiation revision/approval logic, scripted fictional roommate behavior, mocked API error cases, and browser flow. Browser tests mocked Claude replies; **no successful live Anthropic call had been verified at the time of integration**.

Tests and CI entry points:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm test:data
pnpm exec tsc --noEmit
pnpm build
pnpm build:manager
VITE_ROOMMATE_AI=1 pnpm build
```

Browser tests run under the `e2e` GitHub Actions job; the real-Claude smoke test is **manual/opt-in** under the `ai-smoke` job. Check the current workflow before running it against a paid key.

### L. Safely integrated into the team's `dev` branch

- Original feature implementation: `feature/ai-roommate-intelligence`.
- Feature branch had inherited work from `feature/unified-renter-journey`, so it was **not merged directly into `main`**.
- A dedicated integration branch was based on the latest `dev` to produce a cleaner, roommate-focused diff.
- Conflicts were resolved by preserving `dev`'s navigation and the environment variables from both sides.
- [PR #15](https://github.com/ishitaac/rentwell-devday/pull/15) merged the implementation into `dev` at **`e9ca950`**; at that point `main` was not changed by this PR.
- The merge was reported as **40 changed files, +5,385/−1**, primarily roommate-specific code, server routes, tests, CI, and documentation.
- Existing renter, manager, listings, analytics, RentCast, and shared journey functionality was preserved in the integration diff.

The repository evolves quickly. **Always fetch and compare the latest remote `dev` before subsequent changes or PRs**, and keep future roommate PRs targeted to `dev` unless the team changes that process.

## 5. Architecture and code map

```text
src/
  RoommateAI.tsx                 # Seven-stage user-facing experience
  roommateAI.css                # Feature styling
  roommateAI/
    types.ts                     # Allowed field registry and profile model
    intake.ts                    # Deterministic text extraction and follow-ups
    compliance.ts                # Versioned policy restrictions and text guards
    matching.ts                  # Explainable scoring and hard conflicts
    simulator.ts                 # Timeline and hypothetical scenarios
    negotiation.ts               # Proposal, approval, and revision state machine
    demoData.ts                  # Fictional candidates and discussion fixtures
    jordan.ts                    # Fictional personas, constraints, scripted replies
    jordanClient.ts              # Browser client and deterministic fallback
    *.test.ts                    # Unit/API/model-behavior tests
api/
  roommate-ai.ts                 # General Claude task route (deny by default)
  roommate-demo.ts               # Presenter-gated fictional chat route
server/roommateAI/
  llm.ts                         # Server-side Claude request / validation layer
  handlers.ts                    # General task handlers and rate-limit utilities
  route.ts                       # General route wiring
  demo.ts                        # Restricted demo route
.github/workflows/verify.yml     # CI, browser E2E and manual AI smoke test
e2e/                             # Feature on/off browser tests
docs/ROOMMATE_AI.md              # Prior technical implementation notes
```

**Design principle:** Claude may help with language; deterministic code remains authoritative for matching, boundaries, restrictions, and approvals.

## 6. How to run the feature locally

Use the latest `dev` branch and the repo's existing installation instructions.

```bash
git checkout dev
git pull origin dev
pnpm install --frozen-lockfile
VITE_ROOMMATE_AI=1 pnpm dev
```

Then open the renter application, navigate to **Living preferences / Roommates**, and enter **Describe how you live (AI beta)**.

To verify the feature is hidden:

```bash
VITE_ROOMMATE_AI=0 pnpm dev
```

The full user journey and **scripted** Talk to Jordan demo do **not** require an Anthropic API key.

## 7. Later: enabling live Claude for the controlled demo

**Not part of the completed integration. Do this only when the team is ready.**

Set these on the appropriate **server-side** deployment environment, not in committed source files:

```dotenv
ANTHROPIC_API_KEY=<server-only-secret>
ROOMMATE_AI_ENABLED=1
ROOMMATE_DEMO_ENABLED=1
ROOMMATE_DEMO_ACCESS_CODE=<strong-private-code-12-plus-characters>
ROOMMATE_DEMO_ALLOWED_ORIGINS=https://your-preview-host.example
```

Enable `VITE_ROOMMATE_AI=1` in the **renter build environment**, which is public by design and must never contain secrets.

Before activating:

1. Confirm the hosting provider routes `/api/roommate-demo` to the server function correctly.
2. Set a provider-side spending limit and conservative request limits.
3. Restrict deployment access and allowable origins as appropriate for the presentation.
4. Store `ANTHROPIC_API_KEY` as a GitHub Actions environment secret for the manual `ai-smoke` workflow if running smoke tests there; configure environment approvals where appropriate.
5. Run and inspect a real-API smoke test and an actual deployed preview conversation. Verify labels, persona boundaries, counteroffers, safe fallbacks, and error paths.
6. Never commit real API keys or presenter access codes, and never place them in `VITE_` variables.

The general `/api/roommate-ai` route **will remain unavailable** without genuine user authentication and session authorization. Do not bypass that restriction just to turn on onboarding extraction. The current free-text onboarding and follow-ups work deterministically.

## 8. What is complete vs. what is not

| Capability | State |
|---|---|
| Conversational-looking, rule-based intake and follow-ups | **Implemented** |
| Confirmation and structured profile model | **Implemented** |
| Explainable match scoring and required-need conflicts | **Implemented** |
| Fictional candidate matching | **Implemented** |
| Living Together Simulator | **Implemented; deterministic** |
| Interactive fictional roommate chat | **Implemented; scripted fallback operational** |
| Claude-authored fictional roommate replies | **Code present; gated; live API unverified** |
| Versioned negotiation/approval rules | **Implemented and tested** |
| True two-human, cross-account roommate negotiation | **Not implemented** |
| Account authentication, database, invitations, persistent agreements | **Not implemented** |
| Live Claude preference extraction / follow-ups in UI | **Not implemented** |
| Production fair-housing certification / legal review | **Not completed** |
| Public, production-ready roommate matching marketplace | **Not completed** |

## 9. Known limitations and responsible interpretation

- All candidate roommates in this feature are **fictional demonstration profiles**.
- A match score measures **declared preference overlap**, not personality, trustworthiness, future compatibility, or safety.
- Missing information remains unknown; it is not evidence of incompatibility.
- The simulator creates scenarios for conversation, not forecasts.
- The negotiation UI is single-session and in-memory; approvals involving a fictional roommate are **simulated, not real consent**.
- Synthetic profiles and a presenter code are appropriate to a **restricted demo**, not an unrestricted public product.
- Automatic protected-language screening is incomplete and should not be treated as legal assurance.
- Any future production release needs privacy, fair-housing, accessibility, moderation, storage, security, and qualified legal reviews.

## 10. Future roadmap (not delivered)

Potential later phases, in a sensible order:

1. Activate and smoke-test Claude-backed *fictional* roommate chat in a protected preview.
2. Improve conversational extraction and adaptive follow-ups with safe, server-side authorization and deterministic fallbacks.
3. Add real user authentication, profile ownership, privacy controls, retention and deletion policies.
4. Add secure multi-user invitation/consent flows, persistent negotiation sessions, and versioned approvals.
5. Expand reviewed jurisdiction rules, complete attorney review, and validate accessible, nondiscriminatory matching behavior.
6. Test with consenting real users before any production roommate discovery or matching launch.

## 11. Team notes / source of truth

- **Feature area:** `src/RoommateAI.tsx`, `src/roommateAI/`, `api/roommate-*.ts`, `server/roommateAI/`.
- **Technical status note:** [`docs/ROOMMATE_AI.md`](../../docs/ROOMMATE_AI.md) (path relative to a README stored in `src/roommateAI/`).
- **Integration record:** [PR #15](https://github.com/ishitaac/rentwell-devday/pull/15).
- **Development source of truth:** the latest remote `dev`, not an old feature branch or an earlier snapshot.
- **Deployment/secret status:** never infer from code alone that paid Claude calls have succeeded; verify the deployment and smoke-run evidence.

**Summary:** RentWell Find a Roommate is a **working, tested beta demonstration** of household-fit discovery, simulation, and fictional negotiation, built with deterministic safeguards and an optional gated Claude extension. It is not yet a live authenticated roommate platform.
