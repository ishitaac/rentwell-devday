# RentCast Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace RentWell's fictional fair-rent comparison with calculations from a sanitized, dated snapshot of up to 20 active Salt Lake City RentCast listings.

**Architecture:** A local Node ingestion script calls RentCast once using a secret stored in `.env.local`, sanitizes the response, and writes a committed JSON snapshot. A small TypeScript market module calculates bedroom-matched comparison statistics for the React interface; the browser never receives the API key.

**Tech Stack:** Node.js 20.19+, TypeScript, React 19, Vite 8, Vitest, RentCast REST API

**Spec:** `docs/superpowers/specs/2026-11-18-rentcast-snapshot-design.md`

## Global Constraints

- Never commit or expose the RentCast API key.
- Query `GET /v1/listings/rental/long-term` with `city=Salt Lake City`, `state=UT`, `status=Active`, and `limit=20`.
- Commit only sanitized market-comparison fields and explicit provenance metadata.
- Use all valid snapshot listings only when fewer than three match the requested bedroom count, and disclose the fallback.
- Leave `feature/figma-make-rentwell` and PR #1 unchanged.
- Implement on `feature/rentcast-data`, created from the verified Figma branch.
- After PR #1 merges, update the RentCast branch against `main`, open a separate PR, and do not merge it.

## Review Focus

- Missing `RENTCAST_API_KEY`: the fetch command exits nonzero with setup guidance and writes no snapshot.
- A successful non-array API response: the fetch command rejects it and preserves the prior snapshot.
- Listings with missing, zero, negative, or nonnumeric prices: sanitization excludes them.
- Fewer than three exact-bedroom comparables: calculations fall back to all valid listings and identify the broader scope.
- Empty snapshot: the UI displays an unavailable comparison state instead of `NaN`, infinity, or a misleading result.

---

### Task 1: Isolate the RentCast feature and add secure, testable ingestion

**Files:**
- Create: `.env.example`
- Create: `scripts/rentcast-data.mjs`
- Create: `scripts/rentcast-data.test.mjs`
- Create: `scripts/fetch-rentcast-listings.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `process.env.RENTCAST_API_KEY` and the RentCast rental-listing response array.
- Produces: `sanitizeRentCastListings(records: unknown): SanitizedListing[]` and a `pnpm data:rentcast` command that writes `src/data/rentcast-slc.json` atomically.

- [ ] **Step 1: Create the isolated feature branch**

Create `feature/rentcast-data` from commit `66d3b36` on `feature/figma-make-rentwell`. Confirm PR #1 still points to `feature/figma-make-rentwell` and that its remote head remains unchanged.

- [ ] **Step 2: Write failing Node tests for ingestion behavior**

Add tests named `keeps only comparison fields from valid rental listings`, `drops records with unusable prices`, and `rejects a non-array API response`. Assert that output contains only `city`, `state`, `zipCode`, `propertyType`, `bedrooms`, `bathrooms`, `squareFootage`, `price`, `listedDate`, and `lastSeenDate`, with no contact or API-key fields.

- [ ] **Step 3: Run the ingestion tests and verify RED**

Run: `node --test scripts/rentcast-data.test.mjs`

Expected: FAIL because `scripts/rentcast-data.mjs` does not exist.

- [ ] **Step 4: Implement the sanitizer and fetch command**

Implement `sanitizeRentCastListings(records)` in `scripts/rentcast-data.mjs`. Implement the fetch command with the fixed query, `X-Api-Key` header, explicit HTTP and response validation, provenance metadata, and write-to-temporary-then-rename behavior so a failed refresh cannot destroy the previous snapshot.

- [ ] **Step 5: Add scripts and secret template**

Add `"test": "vitest run"`, `"test:data": "node --test scripts/rentcast-data.test.mjs"`, and `"data:rentcast": "node --env-file=.env.local scripts/fetch-rentcast-listings.mjs"`. Add `.env.example` containing only `RENTCAST_API_KEY=replace_with_your_key`, and add Vitest as a development dependency.

- [ ] **Step 6: Run ingestion tests and verify GREEN**

Run: `pnpm test:data`

Expected: all ingestion tests pass.

- [ ] **Step 7: Commit the ingestion foundation**

```bash
git add .env.example package.json pnpm-lock.yaml scripts
git commit -m "Add secure RentCast snapshot ingestion"
```

### Task 2: Market comparison calculations

**Files:**
- Create: `src/rentMarket.ts`
- Create: `src/rentMarket.test.ts`
- Create after authorized fetch: `src/data/rentcast-slc.json`

**Interfaces:**
- Consumes: the generated snapshot and a requested bedroom count.
- Produces: `calculateRentComparison(snapshot: RentSnapshot, bedrooms: number): RentComparison | null` containing `count`, `lower`, `median`, `upper`, `differenceScope`, `observedStart`, and `observedEnd`.

- [ ] **Step 1: Write failing Vitest cases for comparison behavior**

Test exact-bedroom filtering, median for odd and even counts, deterministic lower/upper range selection, the fewer-than-three fallback disclosure, invalid-price exclusion, and the empty-snapshot `null` result.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm test -- src/rentMarket.test.ts`

Expected: FAIL because `calculateRentComparison` does not exist.

- [ ] **Step 3: Implement the comparison module**

Define `RentListing`, `RentSnapshot`, and `RentComparison`. Calculate the median as the middle value or mean of the two middle values. Select the lower and upper displayed range values at indices `floor((n - 1) * 0.25)` and `ceil((n - 1) * 0.75)` from sorted prices.

- [ ] **Step 4: Run the focused and complete test suites**

Run: `pnpm test -- src/rentMarket.test.ts`

Expected: focused tests pass.

Run: `pnpm test`

Expected: all tests pass.

- [ ] **Step 5: Retrieve and inspect the authorized snapshot**

After `.env.local` contains the user's key, run `pnpm data:rentcast` once. Confirm the JSON contains no `listingAgent`, `listingOffice`, owner, contact, email, phone, or API-key fields and contains no more than 20 listings.

- [ ] **Step 6: Commit the calculation and sanitized snapshot**

```bash
git add src/rentMarket.ts src/rentMarket.test.ts src/data/rentcast-slc.json
git commit -m "Add Salt Lake City rental snapshot"
```

### Task 3: Connect RentWell to the snapshot

**Files:**
- Modify: `src/App.tsx:225-500`
- Modify: `src/App.tsx:509-622`
- Modify: `src/App.tsx:1187`
- Modify: `README.md`

**Interfaces:**
- Consumes: `calculateRentComparison`, `RentSnapshot`, and `src/data/rentcast-slc.json` from Task 2.
- Produces: the existing RentWell rental-analysis flow populated and labeled from the cached RentCast snapshot.

- [ ] **Step 1: Add failing UI-facing tests to the comparison module**

Add assertions for above-median, below-median, equal-median, and unavailable results through `describeRentDifference(askingRent: number, comparison: RentComparison | null)` so the interface never hardcodes a positive sign or above-market wording.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test -- src/rentMarket.test.ts`

Expected: FAIL because `describeRentDifference` does not exist.

- [ ] **Step 3: Implement the result-description helper**

Return a signed percentage, direction label, and heading for above, below, equal, and unavailable states without claiming appraisal accuracy.

- [ ] **Step 4: Replace fictional comparison constants and copy**

Import the snapshot and helpers in `src/App.tsx`. Replace `$1,725`, `$1,950`, `$2,325`, `24 sample listings`, fixed 2025 dates, positive-only difference copy, and fictional-market labels with snapshot-derived values and dated-source disclosures. Keep listing extraction, roommate profiles, and advisor content explicitly marked simulated or fictional.

- [ ] **Step 5: Document refresh and provenance**

Update `README.md` with RentCast attribution, snapshot limitations, `.env.local` setup, the one-request refresh command, and the warning that the key must never enter frontend or committed code.

- [ ] **Step 6: Run full verification**

Run: `pnpm test`

Expected: all tests pass.

Run: `pnpm exec tsc --noEmit`

Expected: exit 0.

Run: `pnpm build`

Expected: production build succeeds.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 7: Commit the interface integration**

```bash
git add README.md src/App.tsx src/rentMarket.ts src/rentMarket.test.ts
git commit -m "Use RentCast snapshot for rent comparisons"
```

### Task 4: Separate PR handoff

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: the verified commits from Tasks 1-3.
- Produces: `feature/rentcast-data` on GitHub, with PR #1 unchanged and a separate unmerged RentCast PR created after the Figma foundation reaches `main`.

- [ ] **Step 1: Audit the final diff and secret boundary**

Run repository searches for `RENTCAST_API_KEY`, `X-Api-Key`, `listingAgent`, `listingOffice`, email, and phone fields. Confirm the placeholder and server-side header name are expected, no secret value is committed, and the generated data contains none of the excluded fields.

- [ ] **Step 2: Re-run full verification on the final tree**

Run: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`, and `git diff --check`.

Expected: all commands exit 0.

- [ ] **Step 3: Push the isolated branch without changing PR #1**

Push `feature/rentcast-data` to `origin`. Verify PR #1 still points to `feature/figma-make-rentwell` at its pre-RentCast head and confirm `merged=false`.

- [ ] **Step 4: Open the separate RentCast PR after PR #1 merges**

Once PR #1 is merged, fetch the updated `main`, update `feature/rentcast-data` against it, rerun full verification, and open a separate PR targeting `main`. Do not merge it.
