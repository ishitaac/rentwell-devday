# Fine Print: what changed and what to decide

**Branch:** `feature/fine-print` · **PR:** [#8](https://github.com/ishitaac/rentwell-devday/pull/8) · **Baseline tag:** `baseline-pre-fine-print` (the `main` commit before any of this)
**Built from:** `FINE_PRINT_SPEC.md` §14 milestones, after an interview round (decisions listed below).

This doc is for the team to decide what to keep and what to roll back. Each section ends with the rollback cost. The headline: **the simulated AI Advisor is gone, replaced by a real lease reader (Fine Print).** The other pages (Check a Rental, Roommate math, Preferences, Matches) were not touched, apart from the nav and one new home-page card.

---

## 1. TL;DR

| | Before (main) | After (this branch) |
|---|---|---|
| AI feature | "AI Advisor" tab, 4 screens of **hardcoded, simulated** findings | **Fine Print**: paste a lease, get real findings from Claude, each one verified against the lease in code |
| Backend | None (static Vite site) | 3 Vercel Functions: `/api/health`, `/api/analyze`, `/api/ask` |
| Money math | Inline in components | All in `src/finePrint/lib/costs.ts`, integer cents, unit-tested |
| Tests | None | 76 unit tests, 14 Playwright E2E tests (1280 px and 375 px), live eval harness |
| Eval on the sample lease | n/a | 23/23 fees, 31/31 citations verified, 15/15 math figures, 11/11 traps, injection-safe (4 live runs) |
| Demo without Wi-Fi | n/a | Works: cached sample analysis plus offline Ask fallbacks (tested with `/api` blocked) |

## 2. Decisions made in the interview (worth re-confirming as a team)

| Question | Decision | Why it matters |
|---|---|---|
| Advisor tab | **Removed** from the codebase (files deleted, not hidden) | It still exists on `main` and at tag `baseline-pre-fine-print` until the PR merges. |
| Pets in the demo | **Found at § 5.1** (spec T08 wins over the §2 demo copy) | "What about pets?" now answers *from the lease*. For the "not in this lease, ask before signing" demo beat, ask **"Is it furnished?"** instead. |
| Sample lease + answer key | Committed to `fixtures/` and `eval/` (repo is **public**; both are fictional) | The answer key is never imported by app code or sent to a model. |
| Extraction speed vs depth | Sonnet 5.5, adaptive thinking, effort **low** | Fits the 20 s budget at full recall. Raise it only if evals show misses. |
| Citations API | **Not used.** Structured output + `verify.ts` everywhere | Anthropic's citations feature can't be combined with structured outputs in one request (API returns 400; confirmed in current docs). |
| Colors | Existing site tokens + **amber** for cautions | Fine Print matches the rest of RentWell. The spec's hex values differ slightly from the live site. |
| 3–4 occupants on a 2-person lease | Allowed, with an **amber warning** linking § 1.3 | Honest, and good on stage. |
| Rent step-up | Hero shows month 1; a line under it says "Rises to $2,398 in months 7–12" with a "Conflicts with § 3.1" chip | |
| Entry points | Nav tab **Fine Print**, header CTA **Read a lease**, and a 3rd home card **03 Read the Fine Print** | |

## 3. UI and workflow changes (what a user sees)

### Navigation and home
- Nav: **"AI Advisor" became "Fine Print"**. The header button **"Try Advisor" became "Read a lease"**.
- Home page: a new wide card under the two existing path cards: *03 Read the Fine Print*.
- *Rollback:* trivial (App.tsx edits are isolated).

### Fine Print flow (new): three states
1. **Intake.** One paste box (also accepts a dropped `.txt`), a **Try the sample lease** button, a 50,000-character counter, and "Not stored by RentWell." PDFs show a "copy the text instead" note (PDF/OCR is a stretch goal, not built).
2. **Analyzing.** The spec's three progress lines. The sample takes about 2.4 s (cached). Live leases take about 15–16 s.
3. **Results** (two columns on desktop, one column plus a sticky **Ask Fine Print** bottom sheet on mobile):
   - Eyebrow "Fine Print found N charges and terms…" and the disclaimer "AI-generated. Not legal advice. Fictional sample."
   - **Hero:** "The real cost is **$2,348** a month. Not $2,100." with a count-up (skipped for reduced-motion users), the **people sharing 1–4** selector ("$1,174 each"), a **stacked bar** (hover or tap highlights the row), the estimates toggle ("Plus about $70/mo estimated utilities. Not a fixed charge."), the rent-step line, and the unpriced items list.
   - **Six groups** with subtotals: *Every month · Only if · At signing (due at signing $3,648, non-refundable $490) · Estimates, not fixed · Needs clarification · Not in this lease.* Long groups show 6 rows plus "Show all".
   - Badges: **Stated · Estimate · Conditional · Not found · Needs clarification**. An estimate is never badged Stated (tested).
   - Every row has **§ links** that open a **clause drawer** with the full lease, scrolled to the clause, with the quoted text highlighted.
   - **Build my landlord question list**: checkable questions, **Copy list** and **Copy as email**. Questions added from Ask are marked "Added from Ask".
   - **Ask Fine Print**: chips (Pets? / What if we move out early? / Guests? / What's not included?), one question in, one answer card out.

### Things that behave differently from the spec (deliberate, please review)
- **Charge count:** the eyebrow counts all verified findings (about 29–31 on the sample), not the answer key's "23 with amounts". The extra rows are no-amount items such as towing, repair costs, and Community Rules fines. Change the copy if you'd rather show 23.
- **Extraction is 3 parallel model calls, not 1** (spec §6 says one call). A single call took **31 s**, over the 20 s budget. Now two calls each extract findings for half the clauses and one call finds conflicts and clarifications. Each call sees the whole lease. Wall time is about 16 s.
- **Code-derived flags:** three traps are flagged by deterministic code, not the model: *late fee has no cap*, *early termination is $4,200 or $4,300*, and *"fixed" rent vs Exhibit A* (a backstop if the model misses it). The model missed the first two in testing; these are math and absence checks, which code does reliably.
- **Displayed quotes are the lease's own text.** Matching ignores whitespace, curly quotes, dashes and **letter case**. The UI then shows the exact lease substring, never the model's string. (Spec says `includes()`; this is slightly looser to match but stricter about what's shown.)
- **Prompt-injection guard:** a clause that looks addressed to AI tools ("ignore previous instructions…") becomes a visible clarification ("contains text addressed to AI tools… Fine Print ignored it"). Findings that cite it never verify.
- **Model answers can't do math:** any dollar figure in an Ask answer must appear in one of its cited quotes, or the answer is withheld ("I couldn't verify that against the lease."). This is deliberately conservative: on the injection lease, a broad "any problems or fees?" question was withheld rather than answered.
- **What-ifs about people are relative-safe:** "my friend moves in too" makes the router return `addOccupants: 1`, and code adds it to the current count. The model never does the counting.

## 4. How it works (architecture)

```
Browser (React)                                   Vercel Functions (server only)
  Intake ─► POST /api/analyze {leaseText} ──────►  segment → 3 parallel Sonnet calls (structured output)
  Results ◄─ AnalysisResult ◄──────────────────────  → verify (code) → costs / checklist / flags / questions (code)
  Ask ────► POST /api/ask {question, topics, clauses} ► pre-router (code) or Haiku router → lane (code)
                                                        → IN_LEASE: Sonnet answer + verified quotes
Shared pure TypeScript (src/finePrint/lib, unit-tested, no network):
  segment · verify · costs · checklist · lanes · derivedFlags · questions · groups · assemble · format
```

- **Models:** `claude-sonnet-5-5` (extraction and answers) and `claude-haiku-5-5` (router). These are the current IDs, checked against the live Anthropic docs on 2026-11-19. Override with `FINE_PRINT_MODEL` / `FINE_PRINT_ROUTER_MODEL`. Sonnet calls enable Anthropic's server-side **refusal fallback** (`fallbacks: "default"`), the documented default for this model.
- **Who decides what:** the model extracts (labels, types, verbatim quotes, numbers *as written*) and classifies Ask messages. **Code** decides verification, every total, Found / Not found, the final Ask lane, every template reply, and every what-if recalculation.
- **Offline / failure behavior:** the sample uses `src/finePrint/data/sample-analysis.json` (a real live run, refreshed with `pnpm cache:sample`). If live analysis of pasted text fails, the user gets a retry state. If the pasted text *is* the sample, the cached result is shown with a notice. If the Ask API is down, the same lanes run locally and answer with exact clause quotes, no model prose.
- **Security and privacy:** `ANTHROPIC_API_KEY` is read only in `server/`. `pnpm check:bundle` fails the build if the key name, a key-shaped string, or the answer key reaches `dist/`. Lease text is never logged or stored. Input is capped at 50k characters. A per-IP rate limit is in memory (per function instance, so a basic guard, not a quota). Request bodies are validated.

## 5. Files

| Area | Files |
|---|---|
| Removed | `src/Advisor.tsx` (946 lines), `src/advisor.css` (1,699 lines) |
| Changed | `src/App.tsx` (nav, CTA, home card, routing), `src/index.css` (dropped Advisor import), `README.md`, `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore` |
| API | `api/health.ts`, `api/analyze.ts`, `api/ask.ts`, `vercel.json` (60 s max duration) |
| Server | `server/anthropic.ts` (only file that calls Claude), `extract.ts`, `analyze.ts`, `ask.ts`, `prompts.ts`, `schemas.ts`, `http.ts`, `devApiPlugin.ts` (serves `/api` in `pnpm dev`) |
| UI | `src/finePrint/*.tsx`, `finePrint.css` |
| Logic | `src/finePrint/lib/*.ts`, each with tests |
| Quality | `e2e/demo.spec.ts`, `playwright.config.ts`, `eval/run.ts`, `eval/answerKey.ts`, `eval/last-run.md`, `scripts/check-bundle.mjs` |
| Fixtures | `fixtures/sample-lease-juniper-row.txt`, `fixtures/injection-lease-juniper-row.txt`, `eval/answer-key.md` |

New dependencies: `@anthropic-ai/sdk`, `zod` (runtime); `vitest`, `tsx`, `@playwright/test` (dev). The package name changed from `figma-make-app` to `rentwell`.

## 6. Verification results

| Check (spec §12) | Result |
|---|---|
| T01 segment ids and § labels, Exhibit A | pass |
| T02 verify: exact passes, altered fails, normalization | pass |
| T03 $2,348 / $1,174 / $2,398 | pass |
| T04 estimate excluded; toggle adds $70 | pass |
| T05 move-in $3,648; non-refundable $490 | pass |
| T06 unknown shows "Not stated", never $0 | pass |
| T07 late fee "$105 plus $15/day" | pass |
| T08 pets found § 5.1; furnished not found; removed clause flips | pass |
| T09 bananas → OFF_TOPIC + redirect; "is this legal" → LEGAL_JUDGMENT | pass |
| T10 injection doesn't change behavior | pass (unit + live eval fixture) |
| Unit tests total | **76/76** |
| E2E (production build, `/api` blocked, 1280 and 375 px) | **14/14**. One earlier run had a timing flake on the "< 8 s" check when 4 workers ran at once; now capped at 2 workers. |
| `pnpm eval` (live, 2 runs × 2 fixtures) | Fee recall **23/23**, citation accuracy **31/31**, math **15/15**, traps **11/11**, injection-safe **yes**, about 15–16 s per analysis |
| Bundle secret check | pass |
| Vercel preview build | **pass** (the Vercel check on PR #8) |

**Honest caveats before quoting these in the pitch:**
- It's **one fictional lease** (plus an injection variant). The spec's rule: only claim measured numbers, on labeled fixtures.
- Three traps are caught by code rules written *after* reading this answer key, so 11/11 overstates how this generalizes to unseen leases. Adding a second hand-labeled lease is the best next step.
- Live Ask answers were spot-checked by hand (pets, guests, parking-without-a-car, late rent, early termination). They are not in the automated eval.

## 7. What still needs a human

1. **Vercel env var:** set `ANTHROPIC_API_KEY` in the `rentwell` project (Preview + Production) on the `ishitaacs-projects` team. Until then, the sample works but pasted leases show "Live analysis isn't set up on this deployment yet."
2. **Deployment Protection:** the preview URL (`rentwell-git-feature-fine-print-ishitaacs-projects.vercel.app`) needs a Vercel login. Judges need a public URL: turn protection off for production, or share a bypass link.
3. **Spec milestone 0's "health route on the deployed URL"** couldn't be checked from here because of (2). After (1), open `/api/health` and confirm `"hasModelKey": true`.
4. **Rotate the API key after the event** (spec §13).
5. Record the 60-second backup demo video (spec §13).

## 8. Code review (run on the full branch diff) and what was fixed

An automated review of `main...feature/fine-print` found **10 real issues: 6 important, 4 nits.** All were fixed in the final commit, with regression tests for the behavioral ones.

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | important | Charges with no stated amount lost their `amount: null`. A conditional no-amount charge on another lease would show **"$NaN"**. (The sample hid it because unknowns render through a different path.) | `amount` is kept through verification; all checks are null/undefined-safe; cache regenerated |
| 2 | important | Ask could quote a clause addressed to AI tools | Such clauses are removed from the answer prompt and can't be cited |
| 3 | important | Ask worst case (router 20 s + answer 20 s) was longer than the browser's 30 s wait | Router capped at 8 s, answer at 15 s |
| 4 | important | A router "what-if" with no actual change rendered an empty card | Falls back to local parsing, else treated as a lease question |
| 5 | important | "Move out **without** notice" was treated as a cost what-if | Local removal what-ifs only fire when the term matches a real charge |
| 6 | important | "gas" became "ga"; "trash fee" could remove the amenity fee | Safe singularizing, stop words, best-match scoring |
| 7 | nit | One slow extraction call failed the whole analysis | Failed call retried once. Deliberately **no** partial results: a missing half would show a falsely low "real cost". |
| 8 | nit | Dev server could corrupt multi-byte characters in long leases | Request body decoded once |
| 9 | nit | `FINE_PRINT_TIMEOUT_MS` in `.env.local` was ignored in dev | Added to the copied env keys |
| 10 | nit | Ask rejected leases that segment into more than 400 clauses | Limit raised; the 50k-character cap is the real limit |

## 9. Rollback menu

| If you want to… | Do this | Cost |
|---|---|---|
| Undo everything | Close PR #8 (or `git reset --hard baseline-pre-fine-print` on a branch) | None. `main` is untouched until merge |
| Keep Fine Print but bring the Advisor back | `git checkout baseline-pre-fine-print -- src/Advisor.tsx src/advisor.css`, re-add the import in `index.css` and its 4 screens in `App.tsx` | Small, but two "AI" tabs would confuse the pitch |
| Drop the home card only | Delete the `fp-home-card` button in `App.tsx` | Trivial |
| Use the spec's exact palette | Change the tokens at the top of `finePrint.css` | Trivial |
| Go back to one extraction call | Replace the `Promise.all` in `server/extract.ts` with one `ExtractionSchema` call | Trivial, but about 31 s (over budget) |
| Remove code-derived traps | Drop `deriveClarifications` / `deriveConflicts` in `assemble.ts` | Trap coverage fell to 9/11 in the one early run without them |
| Make verification strictly case-sensitive | Remove `.toLowerCase()` in `findQuote` (`verify.ts`) | In one test run, 1 of 30 quotes failed on capitalization alone |

## 10. How to run

```bash
pnpm install
cp .env.example .env.local     # then set ANTHROPIC_API_KEY (server-only, never VITE_)
pnpm dev                       # app + /api on one port
pnpm check                     # typecheck, unit tests, build, bundle secret check
pnpm test:e2e                  # offline demo path, desktop + 375 px
pnpm eval                      # live scoring against the answer key
```
