# RentCast Demo Listings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich all 20 committed RentCast comparison records with traceable synthetic listing details and local images so any teammate can run and present the same demo without an API key or external image host.

**Architecture:** Preserve `src/data/rentcast-slc.json` as the sanitized source snapshot. Store synthetic presentation fields separately in `src/data/demo-listing-enrichment.json`, then deterministically build `src/data/demo-listings.json` with field-level provenance and validation. Commit four local illustrative images and expose typed selectors for the future renter and manager screens.

**Tech Stack:** Node.js 20+, React 19, TypeScript, Vitest, Node test runner, JSON fixtures, local JPEG assets

**Spec:** `docs/superpowers/specs/2026-11-18-listings-and-manager-screens-design.md`

## Global Constraints

- Update the existing `feature/rentcast-data` branch and preserve its committed RentCast snapshot.
- Do not make another RentCast API request.
- Keep API-derived fields separate from synthetic fields and label every generated record `synthetic` / **Demo listing**.
- Enrich all 20 source records with complete renter-visible data; all 20 are available to the renter and manager demo screens.
- Do not store real street addresses, unit numbers, property-manager names, emails, or phone numbers.
- Bundle all images locally and document their sources and Unsplash license.
- Normal clone, install, test, build, and presentation must not require `RENTCAST_API_KEY`.
- A failed enrichment build must not overwrite the last valid generated dataset.
- Do not merge the GitHub pull request.

## Review Focus

- A refreshed or reordered snapshot must match enrichment records by a stable source key or fail without overwriting output; Task 1 tests source reordering and an unmatched key.
- A listing with no mandatory fees must state that explicitly rather than treating missing data as `$0`; Tasks 1 and 2 test this distinction.
- Every record must have complete presentation and cost data; Task 1 rejects an incomplete enrichment record and Task 2 validates the full fixture.
- Team presentation must work without network images or an API key; Task 2 verifies every referenced local asset exists and Task 4 verifies a clean build without `.env.local`.
- Synthetic fields must never be mistaken for RentCast facts; Task 1 tests provenance and Task 3 tests typed consumer output.

---

## Execution preflight

The planning worktree is on `design/listings-manager-screens`, while the existing dataset branch is checked out elsewhere. Preserve both histories without rewriting the remote branch:

1. Commit this spec and plan on the design branch.
2. Create a temporary execution branch from the current `feature/rentcast-data` commit.
3. Merge `origin/main` into the temporary branch so the already-merged Figma foundation is an ancestor.
4. Cherry-pick the design-doc commit.
5. Run `pnpm install --frozen-lockfile`, `pnpm test:data`, `pnpm test`, and `pnpm build` before Task 1.
6. At handoff, push the temporary branch head to `origin/feature/rentcast-data` as a normal fast-forward; never force-push.

If the baseline fails, stop and report the failure before changing implementation files.

---

### Task 1: Deterministic enrichment pipeline

**Files:**
- Create: `scripts/demo-listings.mjs`
- Create: `scripts/demo-listings.test.mjs`
- Create: `scripts/build-demo-listings.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: sanitized records with `zipCode`, `propertyType`, `bedrooms`, `bathrooms`, `squareFootage`, and `price`.
- Produces: `createSourceKey(record) -> string`, `buildDemoListings(snapshot, enrichment) -> DemoListingsDataset`, and the `pnpm data:demo` command.

- [ ] **Step 1: Write failing Node tests for source matching and provenance**

Add tests named:

- `creates the same source key when only snapshot dates change`;
- `matches enrichment after source records are reordered`;
- `keeps RentCast market fields separate from synthetic presentation fields`;
- `calculates true monthly cost from complete mandatory fees`;
- `distinguishes explicit no-fee listings from missing fee data`;
- `rejects unmatched, duplicate, or incomplete enrichment records`; and
- `does not replace an existing output when fixture validation fails`.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `node --test scripts/demo-listings.test.mjs`

Expected: FAIL because the module and functions do not exist.

- [ ] **Step 3: Implement the pure enrichment functions**

In `scripts/demo-listings.mjs`, implement:

- `createSourceKey(record)` using the stable tuple `zipCode`, `propertyType`, `bedrooms`, `bathrooms`, `squareFootage`, and `price`;
- `buildDemoListings(snapshot, enrichment)` with unique-key matching, exact source coverage, completeness validation, calculated cost, and `market` / `synthetic` / `provenance` sections; and
- `validateDemoListingAssets(dataset, projectRoot)` for local `/listings/...` asset paths.

- [ ] **Step 4: Implement atomic dataset generation**

In `scripts/build-demo-listings.mjs`, read the committed snapshot and enrichment fixture, build and validate the dataset, write a temporary file, and rename it to `src/data/demo-listings.json` only after every check succeeds.

Add `"data:demo": "node scripts/build-demo-listings.mjs"` and expand `test:data` so both Node test files run.

- [ ] **Step 5: Run the focused tests and confirm GREEN**

Run: `node --test scripts/demo-listings.test.mjs`

Expected: all enrichment-pipeline tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/demo-listings.mjs scripts/demo-listings.test.mjs scripts/build-demo-listings.mjs
git commit -m "Add deterministic demo listing pipeline"
```

### Task 2: Complete synthetic fixture and local assets

**Files:**
- Create: `src/data/demo-listing-enrichment.json`
- Create: `src/data/demo-listings.json`
- Create: `public/listings/interior-blue.jpg`
- Create: `public/listings/interior-warm.jpg`
- Create: `public/listings/townhouse-exterior.jpg`
- Create: `public/listings/interior-gray.jpg`
- Create: `public/listings/ASSETS.md`
- Modify: `scripts/demo-listings.test.mjs`

**Interfaces:**
- Consumes: `createSourceKey` and `buildDemoListings` from Task 1 plus all 20 source records.
- Produces: the committed dataset and four repository-local image paths used by later UI work.

- [ ] **Step 1: Add failing fixture-level tests**

Assert that the real fixtures:

- contain exactly 20 matched records;
- contain exactly 20 complete records available to both demo screens;
- use all 20 unique source keys exactly once;
- include studios through four-bedroom records and all source property types;
- have complete presentation, fee-disclosure, image, and availability fields on every record;
- include at least two records explicitly marked as having no mandatory recurring fees;
- reference only `/listings/*.jpg` paths that exist under `public/listings`;
- contain no street-address, person-name, email, phone, API-key, agent, or office fields; and
- label market and synthetic provenance separately.

- [ ] **Step 2: Run fixture tests and confirm RED**

Run: `node --test scripts/demo-listings.test.mjs`

Expected: FAIL because the fixture and local assets do not exist.

- [ ] **Step 3: Add four fixed local illustrative images and manifest**

Download and store these Unsplash License images at a practical card resolution, then document creator, source page, license, download date, and the **Illustrative image—not the actual property** disclosure in `public/listings/ASSETS.md`:

- Nha Chill, `https://unsplash.com/photos/ZuHIek5xn_I` → `interior-blue.jpg`;
- Francesca Tosolini, `https://unsplash.com/photos/XyGvEj587Mc` → `interior-warm.jpg`;
- Puscas Adryan, `https://unsplash.com/photos/rq_E0Rm5QQQ` → `townhouse-exterior.jpg`; and
- Riyas Mohammed, `https://unsplash.com/photos/_BBps6MAJ2w` → `interior-gray.jpg`.

Use these fixed download URLs so the checked-in binaries are reproducible:

- `https://images.unsplash.com/photo-1751945965597-71171ec7a458?auto=format&fit=crop&fm=jpg&q=75&w=1200`
- `https://images.unsplash.com/photo-1560185009-5bf9f2849488?auto=format&fit=crop&fm=jpg&q=75&w=1200`
- `https://images.unsplash.com/photo-1769805446592-35a4ed882bc4?auto=format&fit=crop&fm=jpg&q=75&w=1200`
- `https://images.unsplash.com/photo-1701092868263-2ed67ac8dfa0?auto=format&fit=crop&fm=jpg&q=75&w=1200`

- [ ] **Step 4: Author all 20 synthetic enrichment records**

Use stable IDs `demo-slc-001` through `demo-slc-020`. Reuse real neighborhood and zip labels without street addresses. Assign deterministic titles, descriptions, amenities, explicit fee disclosure, deposits, availability, fixed dates, and one of the four local images. Keep the source rent and property attributes unchanged.

- [ ] **Step 5: Generate and validate the committed dataset**

Run: `pnpm data:demo`

Expected: `src/data/demo-listings.json` is generated with 20 records and no API request.

- [ ] **Step 6: Run fixture tests and confirm GREEN**

Run: `pnpm test:data`

Expected: sanitizer and enrichment tests pass.

- [ ] **Step 7: Commit**

```bash
git add public/listings src/data/demo-listing-enrichment.json src/data/demo-listings.json scripts/demo-listings.test.mjs
git commit -m "Add self-contained demo rental listings"
```

### Task 3: Typed dataset contract for both screens

**Files:**
- Create: `src/demoListings.ts`
- Create: `src/demoListings.test.ts`
- Modify: `package.json` only if the existing `vitest run src` command needs no change.

**Interfaces:**
- Consumes: `src/data/demo-listings.json` from Task 2.
- Produces: `DemoListing`, `DemoListingsDataset`, `getDemoListings(dataset)`, and `updateDemoListing(listings, listingId, updates)`.

- [ ] **Step 1: Write failing Vitest contract tests**

Test that:

- the selector returns all 20 records;
- every listing exposes a numeric true monthly cost;
- explicit no-fee listings calculate true monthly cost equal to base rent;
- editing a title or renter-visible field returns an updated copy without mutating the original list;
- editing recurring fees recalculates true monthly cost;
- an unknown listing ID returns the original list unchanged; and
- synthetic and market provenance remain distinct after an edit.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `pnpm exec vitest run src/demoListings.test.ts`

Expected: FAIL because `src/demoListings.ts` does not exist.

- [ ] **Step 3: Implement types and pure selectors**

Import the JSON fixture, define the exact dataset types, and implement the two pure selectors without mutating the dataset.

- [ ] **Step 4: Run focused and full tests**

Run: `pnpm exec vitest run src/demoListings.test.ts && pnpm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/demoListings.ts src/demoListings.test.ts
git commit -m "Expose typed demo listing data"
```

### Task 4: Team-ready documentation, verification, and branch handoff

**Files:**
- Modify: `README.md`
- Include: `docs/superpowers/specs/2026-11-18-listings-and-manager-screens-design.md`
- Include: `docs/superpowers/plans/2026-11-18-rentcast-demo-listings.md`

**Interfaces:**
- Consumes: the committed dataset, local assets, scripts, and typed selectors from Tasks 1–3.
- Produces: a self-contained teammate workflow on the updated `feature/rentcast-data` branch.

- [ ] **Step 1: Document the no-secret presentation path**

Explain that teammates only need `pnpm install --frozen-lockfile` and `pnpm dev`; the committed snapshot, enriched dataset, and local images work without `.env.local`. Document `pnpm data:demo` as a free local rebuild and `pnpm data:rentcast` as an optional paid/API-key refresh that is not needed for the competition demo.

- [ ] **Step 2: Document provenance and limitations**

List which fields come from RentCast, which are synthetic, how image attribution is stored, why the records are demo listings rather than live inventory, and how a snapshot refresh can require enrichment remapping.

- [ ] **Step 3: Run the final no-secret verification**

Temporarily verify with no `.env.local` dependency:

```bash
pnpm data:demo
pnpm test:data
pnpm test
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

Expected: all commands exit 0 without calling RentCast.

- [ ] **Step 4: Audit repository boundaries**

Confirm no tracked file contains the local RentCast key, real contact fields, real street addresses, or remote runtime image URLs. Confirm all four image files are tracked and every generated image path resolves locally.

- [ ] **Step 5: Commit and push the existing feature branch**

```bash
git add README.md docs/superpowers/specs/2026-11-18-listings-and-manager-screens-design.md docs/superpowers/plans/2026-11-18-rentcast-demo-listings.md
git commit -m "Document self-contained demo listing data"
git push origin HEAD:feature/rentcast-data
```

Verify the remote branch points to the new head. If no RentCast PR exists, open one targeting `main` for teammate review and do not merge it.
