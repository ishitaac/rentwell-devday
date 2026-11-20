# RentWell Unified Renter Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Browse Rentals and Check Your Rental converge on one explainable Decision Receipt, then hand off an optional, consistent rental context to the colleague-owned roommate-planning journey.

**Architecture:** Normalize committed demo listings and user-entered rentals into a shared `RentalDecisionRecord`, and calculate both through one receipt function. `App.tsx` owns the active decision and navigation source; focused renter-entry and decision-detail components render source-specific content and actions. A small typed `RoommatePlanningContext` forms the integration boundary, while the existing roommate screens receive only the minimum contextual changes needed to stop presenting rental evaluation as one mandatory five-step flow.

**Tech Stack:** React 19, TypeScript 5.7, Vite 8, Vitest, existing RentWell CSS and synthetic demo fixtures.

**Spec:** `docs/superpowers/specs/2026-11-19-unified-renter-journey-design.md`

## Global Constraints

- Preserve PR #5 renter listing behavior and PR #6 manager edit/preview behavior.
- Keep all data in local React state; add no backend, authentication, persistence, or runtime third-party calls.
- Preserve source truth as `synthetic-demo-listing` or `user-entered-demo-analysis`; never fabricate missing external-rental facts.
- Use one Decision Receipt calculation contract and the terms **advertised rent**, **mandatory recurring fees**, **true monthly cost**, and **Fair Rent** throughout.
- Keep Roommate Planning directly discoverable, but do not redesign the colleague-owned preferences or matching logic.
- Replace the global five-step rental-check framing with source-aware rental evaluation and contextual roommate stages.
- Keep Manager Workspace behind a distinct **For property managers** role entry.
- Work on `feature/unified-renter-journey`, stacked on `feature/property-manager-dashboard`; do not merge or push without explicit approval.

## Review Focus

- An external rental without a deposit must show move-in cost as unavailable and request confirmation, never treat the deposit as `$0`.
- Zero fees are valid only when the user explicitly selects **No mandatory recurring fees**; an unconfirmed blank/zero must not become a complete disclosure.
- A roommate-first entrance must not inherit the default `$2,100` sample rental or expose apartment-specific actions.
- Returning from a browsed Decision Receipt must preserve the listing search, while returning from an external receipt must return to the external-entry form.
- Rent and fee values handed to roommate planning must exactly match the active Decision Receipt after manager edits or external-entry changes.

---

### Task 0: Isolate and record the approved design

**Files:**
- Add: `docs/superpowers/specs/2026-11-19-unified-renter-journey-design.md`
- Add: `docs/superpowers/plans/2026-11-19-rentwell-unified-renter-journey.md`

**Interfaces:**
- Consumes: `feature/property-manager-dashboard` at verified commit `2d01e8c`.
- Produces: local branch `feature/unified-renter-journey` containing the approved design and implementation plan.

- [ ] **Step 1: Create the isolated feature branch**

Run: `git switch -c feature/unified-renter-journey`

Expected: the new branch points at `2d01e8c` and the approved spec/plan remain present.

- [ ] **Step 2: Mark the design approved and commit the planning documents**

Change the spec status to **Approved for implementation**, then commit both documents with message: `docs: plan unified renter journey`.

- [ ] **Step 3: Verify the branch boundary**

Run: `git merge-base --is-ancestor feature/property-manager-dashboard HEAD && git status --short`

Expected: the ancestry check exits 0 and the worktree is clean.

### Task 1: Shared rental decision record and receipt

**Files:**
- Create: `src/rentalDecision.ts`
- Create: `src/rentalDecision.test.ts`
- Modify: `src/listingDecision.ts`
- Modify: `src/listingDecision.test.ts`

**Interfaces:**
- Consumes: `DemoListing`, `MandatoryRecurringFee`, `RentSnapshot`, and existing rent-comparison helpers.
- Produces: `ExternalRentalEntry`, `RentalDecisionRecord`, `createDemoRentalDecision(listing)`, `createExternalRentalDecision(entry)`, `buildRentalDecisionReceipt(record, snapshot)`, and the compatibility wrapper `buildListingDecisionReceipt(listing, snapshot)`.

- [ ] **Step 1: Write failing adapter tests**

Add tests asserting that `createDemoRentalDecision` preserves listing ID, title, neighborhood, rent, bedrooms, square footage, itemized fees, deposit, images, amenities, and source `synthetic-demo-listing`; mutations to the returned fee/image arrays must not mutate the fixture.

Add tests asserting that `createExternalRentalDecision` produces source `user-entered-demo-analysis`, one aggregated **Mandatory recurring fees** line when fees are disclosed, `securityDeposit: null`, no images or amenities, and source capabilities `{ canCompare: false, canRequestTour: false }`.

- [ ] **Step 2: Run the adapter tests and confirm the module is missing**

Run: `CI=true pnpm test src/rentalDecision.test.ts`

Expected: FAIL because `src/rentalDecision.ts` does not exist.

- [ ] **Step 3: Define the normalized types and adapters**

In `src/rentalDecision.ts`, define:

```ts
export type ExternalRentalEntry = {
  label: string;
  neighborhood: string;
  askingRent: number;
  bedrooms: number;
  squareFootage: number | null;
  mandatoryRecurringFeeTotal: number;
  noMandatoryRecurringFees: boolean;
  moveInDate: string;
};

export type RentalDecisionRecord = {
  decisionId: string;
  source: "synthetic-demo-listing" | "user-entered-demo-analysis";
  title: string;
  neighborhood: string;
  city: string;
  askingRent: number;
  bedrooms: number;
  bathrooms: number | null;
  squareFootage: number | null;
  propertyType: string | null;
  recurringFees: MandatoryRecurringFee[];
  noMandatoryRecurringFees: boolean;
  securityDeposit: number | null;
  availableDate: string | null;
  description: string | null;
  images: string[];
  amenities: string[];
  updatedAt: string;
  capabilities: { canCompare: boolean; canRequestTour: boolean };
};
```

Use `external-demo-${normalized fields}` as a deterministic decision ID; do not use randomness or current time.

- [ ] **Step 4: Write failing shared-receipt tests**

Update `src/listingDecision.test.ts` so `buildRentalDecisionReceipt(record, snapshot)` proves:

- a demo record retains the existing `$1,299 + $65 = $1,364` and `$2,064` move-in result;
- an external `$2,100 + $200` record produces `$2,300` true monthly cost;
- the external record returns `estimatedMoveInCost: null` and includes **Security deposit has not been provided.**;
- unavailable market evidence remains unavailable;
- explicit no-fee records keep true monthly cost equal to rent.

- [ ] **Step 5: Implement the shared receipt and compatibility wrapper**

Change `ListingDecisionReceipt.estimatedMoveInCost` to `number | null`. Implement:

```ts
export function buildRentalDecisionReceipt(
  record: RentalDecisionRecord,
  snapshot: RentSnapshot,
): ListingDecisionReceipt;
```

Keep `buildListingDecisionReceipt(listing, snapshot)` as a delegating wrapper through `createDemoRentalDecision` so existing listing cards remain compatible during the transition.

- [ ] **Step 6: Run focused and full tests**

Run: `CI=true pnpm test src/rentalDecision.test.ts src/listingDecision.test.ts && CI=true pnpm test`

Expected: all tests pass.

- [ ] **Step 7: Commit Task 1**

Commit message: `feat: unify rental decision records`

### Task 2: Typed roommate-planning handoff

**Files:**
- Create: `src/roommatePlanning.ts`
- Create: `src/roommatePlanning.test.ts`

**Interfaces:**
- Consumes: `RentalDecisionRecord` from Task 1.
- Produces: `RoommatePlanningContext`, `createRentalFirstRoommateContext(record)`, and `createRoommateFirstContext()`.

- [ ] **Step 1: Write failing context tests**

Test that a rental-first context copies the active decision ID, title, neighborhood, advertised rent, recurring-fee total, true monthly cost, and bedrooms. Test that a roommate-first context has `entryPerspective: "roommate-first"` and `rental: null`, with no default sample values.

Add a rental-first test using a manager-edited demo decision and assert its updated rent and fee total—not the original fixture values—reach the context unchanged.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `CI=true pnpm test src/roommatePlanning.test.ts`

Expected: FAIL because `src/roommatePlanning.ts` does not exist.

- [ ] **Step 3: Implement the integration contract**

Define:

```ts
export type RoommatePlanningContext =
  | { entryPerspective: "roommate-first"; rental: null }
  | {
      entryPerspective: "rental-first";
      rental: {
        decisionId: string;
        title: string;
        neighborhood: string;
        advertisedRent: number;
        recurringFeeTotal: number;
        trueMonthlyCost: number;
        bedrooms: number;
      };
    };
```

Derive all totals from the supplied `RentalDecisionRecord`; do not accept duplicate numeric arguments.

- [ ] **Step 4: Run focused and full tests**

Run: `CI=true pnpm test src/roommatePlanning.test.ts && CI=true pnpm test`

Expected: all tests pass.

- [ ] **Step 5: Commit Task 2**

Commit message: `feat: add roommate planning handoff`

### Task 3: Source-aware Decision Receipt screen

**Files:**
- Modify: `src/Listings.tsx`
- Modify: `src/Listings.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `RentalDecisionRecord` and `buildRentalDecisionReceipt` from Task 1.
- Produces: `RentalDecisionDetails({ decision, saved, compared, tourRequested, showCalculation, backLabel, onBack, onToggleSaved, onToggleCompared, onRequestTour, onPlanWithRoommates, onToggleCalculation })`.

- [ ] **Step 1: Write failing demo and external render tests**

For a demo decision, assert the existing image, facts, amenities, itemized fees, Fair Rent result, save, compare, tour, and new **Plan costs with roommates** action.

For an external decision, assert **Rental you entered · Demo analysis**, its label and entered facts, `$2,300` true monthly cost, **Move-in cost unavailable**, deposit/missing-information guidance, **Save evaluation**, and **Plan costs with roommates**. Assert that **Request a tour**, **Add to compare**, fabricated image, amenities, and availability are absent.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `CI=true pnpm test src/Listings.test.tsx`

Expected: FAIL because `RentalDecisionDetails` and source-aware behavior do not exist.

- [ ] **Step 3: Implement `RentalDecisionDetails`**

Refactor the current `ListingDetails` content around `RentalDecisionRecord`. Render the gallery/property extras only when present; render a neutral entered-rental summary instead of an image placeholder for external records. Gate compare and tour actions using `decision.capabilities`, and render the nullable move-in cost honestly.

Keep `ListingCard` and `ListingsBrowser` APIs unchanged.

- [ ] **Step 4: Add consistent responsive styles**

Reuse the existing listing-details layout and receipt styles. Add only the external-summary and roommate-action states needed at desktop and compact/mobile widths; no new visual system.

- [ ] **Step 5: Run focused tests, full tests, and TypeScript**

Run: `CI=true pnpm test src/Listings.test.tsx && CI=true pnpm test && CI=true pnpm exec tsc --noEmit`

Expected: all commands pass.

- [ ] **Step 6: Commit Task 3**

Commit message: `feat: add unified rental decision screen`

### Task 4: External rental entry and unified App navigation

**Files:**
- Create: `src/RentalEntry.tsx`
- Create: `src/RentalEntry.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: Task 1 adapters and `RentalDecisionDetails`; Task 2 roommate context factories.
- Produces: `RentalEntry({ initialEntry, onEntryChange, onSubmit })`, App-owned `activeDecision`, source-aware return navigation, and roommate-context routing.

- [ ] **Step 1: Write failing external-entry render and validation tests**

Assert the form uses **Check a rental you found**, **Rental name or short label**, neighborhood, rent, bedrooms, optional square footage, mandatory recurring fees, explicit **No mandatory recurring fees**, and move-in date. Assert contradictory empty-fee/no-fee states and non-positive rent do not produce a valid entry.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `CI=true pnpm test src/RentalEntry.test.tsx`

Expected: FAIL because `src/RentalEntry.tsx` does not exist.

- [ ] **Step 3: Implement the controlled entry component**

Export `validateExternalRentalEntry(entry): Record<string, string>` beside `RentalEntry`. Keep mock extraction explicitly labeled and deterministic. `onSubmit` receives a valid `ExternalRentalEntry`; the component does not own navigation or receipt calculation.

- [ ] **Step 4: Add failing App-level render tests**

Create or extend a server-render test that asserts the home/App navigation exposes **Browse Rentals**, **Check Your Rental**, **Roommate Planning**, **AI Advisor**, **How It Works**, and a distinct **For property managers** entry. Assert the old global labels **Rental check · Step 1 of 5** and **Fair rent analysis · Step 2 of 5** are absent from exported unified components.

- [ ] **Step 5: Wire one active decision through App**

In `App.tsx`:

- replace the old `RentalData` evaluation state with `activeDecision: RentalDecisionRecord | null`;
- adapt browsed/manager-preview listings through `createDemoRentalDecision`;
- adapt valid external entries through `createExternalRentalDecision`;
- replace the standalone `analysis` destination with `RentalDecisionDetails`;
- preserve return targets `listings`, `manager`, and `rental-entry`;
- call `createRentalFirstRoommateContext(activeDecision)` before routing to roommate math;
- call `createRoommateFirstContext()` for direct **Roommate Planning** navigation.

Keep saved/compared/tour state keyed by decision ID. Preserve a temporary `RentalData` compatibility adapter derived from the active rental-first context so the existing roommate components continue to compile until Task 5; do not keep the disconnected default sample as a second source of truth. Remove the unused old Fair Rent analysis screen only after all entry paths use the shared receipt.

Export and test `getDecisionBackScreen(origin: "listings" | "rental-entry" | "manager")` so each entrance returns to its own screen. Keep `listingQuery` App-owned and unchanged when opening or closing a decision.

- [ ] **Step 6: Run focused and full verification**

Run: `CI=true pnpm test src/RentalEntry.test.tsx && CI=true pnpm test && CI=true pnpm exec tsc --noEmit`

Expected: all commands pass.

- [ ] **Step 7: Commit Task 4**

Commit message: `feat: connect both rental entry paths`

### Task 5: Separate roommate stages without redesigning roommate planning

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Test: `src/roommatePlanning.test.ts`

**Interfaces:**
- Consumes: `RoommatePlanningContext` from Task 2.
- Produces: contextual progress labels and rental-first versus roommate-first rendering inputs for the existing `RoommateMath`, `Preferences`, and `Matches` components.

- [ ] **Step 1: Add tests for contextual roommate stages**

Add a pure helper in `src/roommatePlanning.ts`:

```ts
export function getRoommateStages(
  context: RoommatePlanningContext,
): Array<{ screen: "math" | "preferences" | "matches"; label: string }>;
```

Test that rental-first returns **Cost split**, **Living preferences**, **Matches**, while roommate-first returns **Living preferences**, **Matches** and contains no apartment or dollar defaults.

Export the existing `Matches` component for server rendering. With a roommate-first context, assert it shows a context-neutral heading and does not show **View apartment**, **See apartment split**, `$2,300`, or `$1,150 each`. With a rental-first context, assert the match context uses the exact title and true monthly cost supplied by the handoff.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `CI=true pnpm test src/roommatePlanning.test.ts`

Expected: FAIL because `getRoommateStages` does not exist.

- [ ] **Step 3: Implement contextual progress and minimum screen adaptations**

Replace the old global `Progress` with a roommate-only progress indicator driven by `getRoommateStages`. For rental-first, populate cost split and the match context from `context.rental`. For roommate-first, begin at preferences and hide apartment-specific match actions/context instead of attaching the former `$2,100` sample.

Add **Back to Decision Receipt** for rental-first cost split. Do not change preference fields, fair-housing copy, compatibility logic, or colleague-owned visual composition.

- [ ] **Step 4: Run focused and full tests**

Run: `CI=true pnpm test src/roommatePlanning.test.ts && CI=true pnpm test && CI=true pnpm exec tsc --noEmit`

Expected: all commands pass.

- [ ] **Step 5: Commit Task 5**

Commit message: `fix: separate rental and roommate stages`

### Task 6: Home-page information architecture and role separation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Create: `src/Home.test.tsx`

**Interfaces:**
- Consumes: the unified App routes from Task 4.
- Produces: the revised hero, three-stage explanation, renter navigation, and visually separate manager role entry.

- [ ] **Step 1: Write failing home render tests**

Assert the hero contains primary **Browse rentals** and secondary **Check a rental you found** actions. Assert the explanatory stages are **Find or bring a rental**, **Understand the real cost**, and **Decide solo or shared**. Assert the hero sample uses a committed synthetic listing title/cost rather than `$2,100 / mo` and **Fair-ish**.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `CI=true pnpm test src/Home.test.tsx`

Expected: FAIL because the current home page uses the old two-path copy and disconnected sample.

- [ ] **Step 3: Implement the revised home and navigation**

Export `Home` for focused rendering. Use one committed demo listing for the hero sample, retain the main headline, and replace the two-card section with three connected stages. Keep **Roommate Planning** visible, and render **For property managers** as a role entry rather than a peer renter task.

- [ ] **Step 4: Align visual hierarchy**

Reuse existing tokens and components. Preserve left-aligned editorial hierarchy for discovery/details and centered focus only for forms; verify the mobile menu remains readable with the role entry.

- [ ] **Step 5: Run focused and full verification**

Run: `CI=true pnpm test src/Home.test.tsx && CI=true pnpm test && CI=true pnpm exec tsc --noEmit && CI=true pnpm build`

Expected: all commands pass and the production build succeeds.

- [ ] **Step 6: Commit Task 6**

Commit message: `feat: clarify the RentWell renter journey`

### Task 7: Whole-flow review and handoff

**Files:**
- Review all files changed after `feature/property-manager-dashboard`.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: a review-ready local feature branch; no push or merge without explicit approval.

- [ ] **Step 1: Review against the approved specification**

Confirm both rental entrances converge on the shared receipt, nullable move-in cost is truthful, search/back behavior is preserved, manager edits still appear to renters, both roommate perspectives are distinguishable, and colleague-owned roommate logic was not redesigned. Add RED→GREEN coverage for any Important or Critical finding.

- [ ] **Step 2: Run fresh final verification**

Run: `CI=true pnpm test && CI=true pnpm test:data && CI=true pnpm exec tsc --noEmit && CI=true pnpm build && git diff --check feature/property-manager-dashboard...HEAD`

Expected: all tests pass, data validation passes, TypeScript and build succeed, the diff is clean, and the worktree has no uncommitted product changes.

- [ ] **Step 3: Manually verify the compact and desktop paths**

Exercise:

- Home → Browse rentals → search → listing → Decision Receipt → cost split → back to receipt → back to preserved search.
- Home → Check a rental you found → mock extraction/manual edits → Decision Receipt → save evaluation → cost split.
- Roommate Planning → preferences → matches with no fabricated apartment.
- For property managers → edit → save → renter preview → back to manager.

Expected: no dead ends, duplicated Fair Rent destinations, stale rent/fee totals, mandatory roommate steps, or unsupported source actions.

- [ ] **Step 4: Prepare the branch handoff**

Summarize the unified journey, roommate integration contract, intentionally untouched colleague-owned behavior, verification evidence, stacked branch dependency, and retargeting order after PRs #4–#6 merge.
