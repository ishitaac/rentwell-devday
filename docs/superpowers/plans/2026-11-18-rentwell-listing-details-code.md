# RentWell Listing Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive renter listings browser and dedicated listing-details Decision Receipt to the existing RentWell React app.

**Architecture:** Reuse the committed synthetic listing dataset and existing RentWell navigation/styles. Keep cost and fairness calculations in a focused pure module, keep reusable listing UI in a focused React module, and let `App.tsx` own screen navigation and selected-listing state.

**Tech Stack:** React 19, TypeScript 5.7, Vite 8, Vitest, existing CSS design tokens.

**Spec:** `docs/superpowers/specs/2026-11-18-rentwell-interactive-listing-design.md`

## Global Constraints

- Preserve the merged original rental-check journey.
- Reuse `src/data/demo-listings.json`; do not call RentCast at runtime.
- Keep the property-manager dashboard out of this branch.
- Use the existing RentWell DM Sans/Manrope typography and CSS variables.
- Clearly label synthetic listings and dated market evidence.
- Do not present an unsupported black-box score.

## Review Focus

- A long listing title must not change card action alignment.
- A listing with no mandatory fees must show `$0` fees and keep true monthly cost equal to rent.
- Missing comparison data must show an unavailable explanation rather than a numeric fairness claim.
- Back navigation from details must return to the listings screen.
- Mobile layouts must not create horizontal overflow.

---

### Task 1: Decision Receipt model

**Files:**
- Create: `src/listingDecision.ts`
- Test: `src/listingDecision.test.ts`

**Interfaces:**
- Consumes: `DemoListing`, `RentSnapshot`, and existing rent comparison helpers.
- Produces: `buildListingDecisionReceipt(listing, snapshot): ListingDecisionReceipt`.

- [ ] Write failing tests for true monthly cost, move-in cost, comparison range/result, no-fee listings, and unavailable comparison evidence.
- [ ] Run `CI=true pnpm test src/listingDecision.test.ts` and confirm failures are caused by the missing module.
- [ ] Implement the typed pure function with source/confidence wording and no unsupported claims.
- [ ] Run `CI=true pnpm test src/listingDecision.test.ts` and the full `CI=true pnpm test` suite.
- [ ] Commit Task 1.

### Task 2: Reusable aligned listing cards and browse screen

**Files:**
- Create: `src/Listings.tsx`
- Create: `src/Listings.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `getDemoListings(demoListingsDataset)` and `buildListingDecisionReceipt` from Task 1.
- Produces: `ListingCard`, `ListingsBrowser`, and the `listings` screen in `App`.

- [ ] Write failing server-render tests proving cards expose distinct images/details, true monthly cost, disclosure status, and `View details` actions.
- [ ] Run `CI=true pnpm test src/Listings.test.tsx` and confirm the component module is missing.
- [ ] Implement a reusable equal-height card and browse screen using the first six demo listings.
- [ ] Add a `Browse Rentals` navigation entry without changing the original `Check a Rental` flow.
- [ ] Add responsive CSS with fixed card content zones and bottom-aligned actions.
- [ ] Run the focused test and full suite.
- [ ] Commit Task 2.

### Task 3: Dedicated listing-details interaction

**Files:**
- Modify: `src/Listings.tsx`
- Modify: `src/Listings.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: selected `DemoListing` and receipt model from Tasks 1–2.
- Produces: `ListingDetails`, `listing-details` navigation, expandable calculation disclosure, and saved state.

- [ ] Write failing render tests for the property facts, Decision Receipt, comparison explanation, missing-information warning, and action controls.
- [ ] Run the focused test and confirm the new details component is missing.
- [ ] Implement the details screen and App state transitions for open, back, save, and calculation disclosure.
- [ ] Add desktop two-column and mobile single-column responsive styling.
- [ ] Run focused tests, full tests, TypeScript, and production build.
- [ ] Manually verify browse → details → explanation → save → back in the running app.
- [ ] Commit Task 3.

### Task 4: Whole-branch verification and review

**Files:**
- Review all changed files.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: a review-ready feature branch; no merge or push without explicit approval.

- [ ] Run `CI=true pnpm test`, `pnpm exec tsc --noEmit`, and `CI=true pnpm build`.
- [ ] Inspect the responsive app at desktop and mobile widths.
- [ ] Review the diff against the spec and Review Focus risks.
- [ ] Address Important/Critical findings with RED→GREEN tests.
- [ ] Record any deferred minor findings and prepare the branch handoff.
