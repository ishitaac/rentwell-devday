# RentWell Listing Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every visible Browse Rentals filter functional, composable, and clearable while preserving selections across listing-detail navigation.

**Architecture:** Add a pure `filterListings` module that owns filter types, defaults, and AND-combination rules. `App.tsx` owns the filter state alongside the existing search query; `ListingsBrowser` renders controlled native inputs with local fallbacks for reusable tests.

**Tech Stack:** React 19, TypeScript 5.9, Vitest, existing RentWell CSS and demo fixtures.

**Spec:** `docs/superpowers/specs/2026-11-19-listing-filters-design.md`

## Follow-up: Default results heading

- Add a server-rendered regression assertion that the untouched browser says `Available rentals` and not `6 rentals match`.
- Reuse active-filter detection so numeric match copy appears only after search or a filter is active.
- Run the focused test, full suite, TypeScript check, build, and data tests; commit separately.

## Follow-up: Full dataset with progressive disclosure

- Add failing render tests proving all 20 records reach `ListingsBrowser`, only six cards appear initially, a beyond-six listing can be found by search, and Show more appears only when results remain hidden.
- Pass the complete `demoListings` collection from `App` instead of slicing it.
- In `ListingsBrowser`, filter the complete collection first, render a six-item visible slice, and reveal six more per Show more click.
- Reset the visible limit to six when search or filter values change.
- Run the focused test, full suite, TypeScript check, build, and data tests; commit separately.

## Follow-up: Move-in calendar

- Replace `moveInMonth` with a blank-or-ISO-date `moveInBy` filter value.
- Add failing filter tests proving the selected date is inclusive and later listings are excluded.
- Replace the fixed month select with a native `type="date"` input labeled `Move in by`.
- Keep Clear all, active-filter detection, App-owned persistence, and visible-result reset behavior.
- Run focused tests, the full suite, TypeScript, build, and data verification; commit separately.

## Global Constraints

- Do not change committed listing fixtures or add dependencies.
- Filter price by `synthetic.trueMonthlyCost`, not advertised rent.
- Combine search and every active filter with AND logic.
- Preserve search and filters only through App-owned state.

## Review Focus

- A $1,200 or $1,600 listing must appear in exactly one price band.
- Studio means `bedrooms === 0`; 3+ means `bedrooms >= 3`.
- Search must still match title, neighborhood, or property type.
- Clear all must reset both search and filters.
- No-match combinations must render an empty state rather than a blank grid.

---

### Task 1: Pure listing filter engine

**Files:**

- Create: `src/listingFilters.ts`
- Create: `src/listingFilters.test.ts`

**Interfaces:**

- Produces: `ListingFilters`, `DEFAULT_LISTING_FILTERS`, `filterListings(listings, query, filters)`, and `hasActiveListingFilters(query, filters)`.

- [ ] Write failing tests for the initial six results, each individual filter, combined AND behavior, search, and price boundaries.
- [ ] Run `CI=true pnpm test src/listingFilters.test.ts`; expect failure because the module is missing.
- [ ] Implement the typed pure filter functions without mutating fixtures.
- [ ] Run the focused test and full app suite; expect all tests to pass.
- [ ] Commit with `feat: add listing filter engine`.

### Task 2: Functional Browse Rentals controls

**Files:**

- Modify: `src/Listings.tsx`
- Modify: `src/Listings.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Interfaces:**

- Consumes: Task 1 filter types and helpers.
- Produces: controlled select/checkbox filters, Clear all behavior, accurate result count, and empty-results state.

- [ ] Write failing render tests for labeled selects, the no-fee checkbox, informational disclosure badge, Clear all when active, and the empty state.
- [ ] Run `CI=true pnpm test src/Listings.test.tsx`; expect the new controls to be absent.
- [ ] Add App-owned `listingFilters` state and pass it to `ListingsBrowser` with search state.
- [ ] Implement controls and responsive styles; keep local fallback state for standalone rendering.
- [ ] Run `CI=true pnpm test && CI=true pnpm test:data && CI=true pnpm exec tsc --noEmit && CI=true pnpm build && git diff --check`.
- [ ] Commit with `fix: make rental filters functional`.
