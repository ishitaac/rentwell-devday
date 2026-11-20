# RentWell Property Manager Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a demo property-manager listings dashboard and edit-listing workspace that update the same synthetic listing records used by the renter experience.

**Architecture:** Add a focused manager data/draft module and a focused manager React module. `App.tsx` owns the mutable demo-listing collection so manager saves immediately feed the existing renter cards and listing details; the manager module owns dashboard search, editor state, preview, and the explicitly simulated property-software import modal.

**Tech Stack:** React 19, TypeScript 5.7, Vite 8, Vitest, existing CSS design tokens and synthetic listing fixtures.

**Spec:** `docs/superpowers/specs/2026-11-18-listings-and-manager-screens-design.md`

## Global Constraints

- Preserve PR #5's renter Browse Listings and Decision Receipt behavior.
- Reuse `DemoListing` and `updateDemoListing`; do not create a duplicate manager listing type.
- Keep all edits in local React state; do not add a production backend or browser persistence.
- Label listings, metrics, and import behavior as demo data.
- Use the exact action label **Import from property software** and explain that no live property data is transferred.
- Do not call RentCast, Entrata, or another property system at runtime.
- Do not add applications, screening, billing, leases, payments, or maintenance features.
- Keep the manager implementation on `feature/property-manager-dashboard`, stacked on PR #5 until the renter branch merges.

## Review Focus

- Saving edited rent or fee items must recompute true monthly cost everywhere, including renter preview.
- An explicitly fee-free listing must remain distinct from a listing whose fees are missing.
- Invalid empty titles, negative money values, and impossible numeric fields must not save.
- Searching to zero results must show a clear empty state and a way to clear the search.
- Mobile must replace the desktop table/drawer arrangement with cards and a full-width editor without horizontal overflow.

---

### Task 1: Manager listing draft contract

**Files:**
- Create: `src/managerListings.ts`
- Test: `src/managerListings.test.ts`

**Interfaces:**
- Consumes: `DemoListing`, `MandatoryRecurringFee`, and `updateDemoListing` from `src/demoListings.ts`.
- Produces: `ManagerListingDraft`, `createManagerListingDraft(listing)`, `validateManagerListingDraft(draft)`, and `saveManagerListingDraft(listings, draft)`.

- [ ] **Step 1: Write failing tests for draft creation and valid saves**

  Assert that a draft contains property, cost, availability, and presentation fields; editing rent and two fee items recomputes `mandatoryRecurringFeeTotal` and `trueMonthlyCost` through `saveManagerListingDraft`.

- [ ] **Step 2: Run the focused test and confirm the module is missing**

  Run: `CI=true pnpm test src/managerListings.test.ts`

  Expected: FAIL because `src/managerListings.ts` does not exist.

- [ ] **Step 3: Write validation tests**

  Assert that empty title/neighborhood/description, negative rent/deposit/fee values, non-positive bathrooms, negative bedrooms/square footage, empty images/amenities, and contradictory no-fee state return field-specific errors and do not mutate the source list.

- [ ] **Step 4: Implement the typed draft helpers**

  `ManagerListingDraft` carries `listingId` plus editable title, neighborhood, description, asking rent, property facts, recurring fee items, explicit no-fee flag, deposit, availability, images, amenities, and updated timestamp. `saveManagerListingDraft` validates first, then delegates derived-cost calculation to `updateDemoListing`.

- [ ] **Step 5: Run focused and full tests**

  Run: `CI=true pnpm test src/managerListings.test.ts && CI=true pnpm test`

  Expected: all tests pass.

- [ ] **Step 6: Commit Task 1**

  Commit message: `feat: add manager listing draft model`

### Task 2: Manager listings dashboard

**Files:**
- Create: `src/ManagerWorkspace.tsx`
- Create: `src/ManagerWorkspace.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `DemoListing[]` and the shared cost fields already derived by the fixture/model.
- Produces: `ManagerDashboard({ listings, query, onQueryChange, onEdit, onPreview, onOpenImport })`.

- [ ] **Step 1: Write failing server-render tests for the dashboard**

  Assert that the dashboard shows the total count, **Demo data**, search control, property title/neighborhood, base rent, mandatory-fee total, true monthly cost, availability, fee disclosure, **Edit**, **Preview as renter**, and **Import from property software**.

- [ ] **Step 2: Run the focused test and confirm the component is missing**

  Run: `CI=true pnpm test src/ManagerWorkspace.test.tsx`

  Expected: FAIL because `ManagerWorkspace.tsx` does not exist.

- [ ] **Step 3: Add tests for filtered and empty dashboard states**

  Render a filtered listing collection and then an empty collection. Assert accurate counts, a no-matches message, and **Clear search**; never hard-code a count of 20 inside the component.

- [ ] **Step 4: Implement the dashboard component**

  Use the existing RentWell header language, a manager-workspace label, compact derived summary metrics, a desktop table, and mobile cards. Keep import in the page header and expose row/card callbacks rather than owning application navigation.

- [ ] **Step 5: Add responsive dashboard styles**

  At desktop width show the operational table; below 760 px hide the table and show manager listing cards. Use the existing DM Sans/Manrope fonts, CSS variables, buttons, borders, and focus treatments.

- [ ] **Step 6: Run focused and full tests**

  Run: `CI=true pnpm test src/ManagerWorkspace.test.tsx && CI=true pnpm test`

  Expected: all tests pass.

- [ ] **Step 7: Commit Task 2**

  Commit message: `feat: add property manager listings dashboard`

### Task 3: Edit listing workspace and renter preview

**Files:**
- Modify: `src/ManagerWorkspace.tsx`
- Modify: `src/ManagerWorkspace.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `ManagerListingDraft`, validation helpers from Task 1, and the existing `ListingCard` renter component.
- Produces: `ManagerEditor({ draft, errors, saveState, onChange, onSave, onCancel, onPreview })` and `ManagerRenterPreview({ listing })`.

- [ ] **Step 1: Write failing render tests for editor sections and totals**

  Assert visible **Property**, **Costs**, **Availability**, and **Presentation** sections; editable rent and fee rows; calculated true monthly cost; unsaved indicator; **Save changes**; **Cancel**; and **Preview as renter**.

- [ ] **Step 2: Add tests for validation and saved states**

  Render field errors beside invalid inputs, a saved confirmation after a valid save, `$0` mandatory fees only for explicit no-fee listings, and a renter preview using the same cost/title/photo values.

- [ ] **Step 3: Implement the controlled editor**

  Use labeled inputs for all draft fields. Support adding/removing recurring fee rows and editing amenities/images as newline-separated lists. Keep all save logic outside the form via callbacks, and preserve the original listing when validation fails or the user cancels.

- [ ] **Step 4: Implement the live renter preview**

  Build an in-memory preview listing from the valid draft and render it using the existing renter card visual language. On desktop place preview beside the editor; on mobile expose it after the form with a jump-to-preview action.

- [ ] **Step 5: Add drawer/full-screen responsive styles**

  Desktop uses an overlay drawer with form and preview columns. Mobile uses a full-width, normal-flow editor with sticky save/cancel actions and no horizontal overflow.

- [ ] **Step 6: Run focused tests, full tests, and TypeScript**

  Run: `CI=true pnpm test src/ManagerWorkspace.test.tsx && CI=true pnpm test && CI=true pnpm exec tsc --noEmit`

  Expected: all commands pass.

- [ ] **Step 7: Commit Task 3**

  Commit message: `feat: add manager listing editor and preview`

### Task 4: App integration and demo import flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/ManagerWorkspace.tsx`
- Modify: `src/ManagerWorkspace.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: the first 20 `DemoListing` records, `ManagerDashboard`, `ManagerEditor`, `saveManagerListingDraft`, and existing `ListingDetails` navigation.
- Produces: the `manager` screen, App-owned mutable demo listings, save/cancel/preview transitions, and a non-live import modal.

- [ ] **Step 1: Add failing integration-oriented render tests**

  Assert the import modal contains **Entrata**, **Demo connection—no live property data is transferred**, **Load demo listing**, and **Cancel**. Assert editor saved state can render a renter preview with the updated cost.

- [ ] **Step 2: Move demo listings into App state and add manager navigation**

  Initialize App state from `getDemoListings(demoListingsDataset)`. Continue showing the first six on renter Browse Listings, pass all records to manager dashboard, and add a **Manager Workspace** navigation entry without changing existing routes.

- [ ] **Step 3: Wire edit, save, cancel, and preview transitions**

  Opening **Edit** creates a draft; saving validates and replaces one listing in App state; cancel discards the draft; **Preview as renter** opens the existing listing-details screen using the current saved record.

- [ ] **Step 4: Implement the import demonstration modal**

  Keep it explicitly simulated. **Load demo listing** closes the modal and opens an existing synthetic listing in the editor; it must not authenticate, fetch, create a production record, or claim synchronization.

- [ ] **Step 5: Run full verification**

  Run: `CI=true pnpm test && CI=true pnpm test:data && CI=true pnpm exec tsc --noEmit && CI=true pnpm build`

  Expected: 0 failures and a successful production build.

- [ ] **Step 6: Manually verify the competition path**

  Exercise: Manager Workspace → search → Edit → change rent/fee → observe preview → Save → Preview as renter → return; then open import modal → load demo listing → cancel without saving. Verify desktop and compact/mobile layouts.

- [ ] **Step 7: Commit Task 4**

  Commit message: `feat: integrate property manager demo workflow`

### Task 5: Whole-branch review and handoff

**Files:**
- Review all files changed after PR #5's head.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: a review-ready stacked feature branch; no merge or push without explicit approval.

- [ ] **Step 1: Review against the specification and Review Focus risks**

  Confirm shared data, truthful demo language, derived costs, cancel safety, empty search, and mobile behavior. Add RED→GREEN coverage for any Important or Critical finding.

- [ ] **Step 2: Run fresh final verification**

  Run: `CI=true pnpm test && CI=true pnpm test:data && CI=true pnpm exec tsc --noEmit && CI=true pnpm build && git diff --check feature/listing-details-decision-receipt...HEAD`

  Expected: all tests pass, build succeeds, diff check is clean, and the worktree has no uncommitted product changes.

- [ ] **Step 3: Prepare the stacked-branch handoff**

  Summarize the two manager screens, demo limitations, verification evidence, branch dependency, and how to retarget the future PR after PR #5 merges.
