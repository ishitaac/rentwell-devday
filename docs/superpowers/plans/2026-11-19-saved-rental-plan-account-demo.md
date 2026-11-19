# Saved Rental Plan and Demo Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete RentWell’s renter and property-manager journeys with a unified My Rental Plan destination, browser-local demo accounts, meaningful roommate and Advisor handoffs, and a no-payment manager pilot.

**Architecture:** Keep `RentalDecisionRecord` and `buildRentalDecisionReceipt` authoritative for all rental values. Add a small tested persistence module for non-sensitive demo sessions and email-scoped saved-plan snapshots, then integrate focused React components into the existing App screen state machine without a router or external dependencies.

**Tech Stack:** React 19, TypeScript 5.7, Vite 8, Vitest, browser `localStorage` through an injected storage interface.

**Spec:** `docs/superpowers/specs/2026-11-19-saved-rental-plan-account-demo-design.md`

## Global Constraints

- No external dependencies, hosted services, secrets, database, real authentication, document processing, or payment configuration.
- Never persist password values or uploaded file contents.
- Every account and pilot screen must visibly identify itself as a prototype stored only in the browser.
- Preserve `RentalDecisionRecord` and `buildRentalDecisionReceipt` as the only rental calculation contract.
- Roommate and Advisor steps remain optional and distinguish `not-started`, completed, and `skipped`.
- Saved plan details are visible only after a matching renter demo email session is active.
- Saved plans preserve the exact decision snapshot the renter approved.
- Property-manager pilot uses `Start free pilot` / `Request a demo` and shows no price or payment success.
- Implement on `feature/unified-renter-journey`; update PR #7 but do not merge it.

## Review Focus

- Browser storage may throw or contain malformed JSON; the in-memory journey must remain usable and display a save failure rather than crash.
- A signed-out visitor or differently signed-in demo email must not see another email’s saved plan details.
- Changing rentals must clear rental-bound roommate and Advisor state while preserving a roommate-first pending choice until it binds once.
- An external rental with an unknown deposit must remain unknown in My Rental Plan and after reload.
- Renter and property-manager sessions must not unlock each other’s role-specific screens.

---

### Task 1: Demo account and saved-plan persistence domain

**Files:**

- Create: `src/demoAccount.ts`
- Create: `src/demoAccount.test.ts`

**Interfaces:**

- Consumes: `RentalDecisionRecord` from `src/rentalDecision.ts` and `DecisionOrigin` moved from `src/App.tsx` to `src/demoAccount.ts` or a small shared type export without importing the App component.
- Produces: `DemoRole`, `DemoSession`, `RoommateSelection`, `OptionalPlanStatus`, `SavedRentalPlan`, `ManagerPilotChoice`, `StorageLike`, `createDemoSession(email, role)`, `loadDemoSession(storage, role)`, `saveDemoSession(storage, session)`, `clearDemoSession(storage, role)`, `loadSavedPlan(storage, email)`, `saveSavedPlan(storage, plan)`, `loadManagerPilot(storage)`, `saveManagerPilot(storage, choice)`, and `resetRentwellDemoData(storage)`.

- [ ] **Step 1: Write failing persistence tests** named `keeps renter and manager sessions role-separated`, `stores plans under normalized owner email without a password`, `does not reveal another email's plan`, `ignores malformed and incompatible saved data`, and `returns a failure result when storage throws`. Use a real in-memory `StorageLike` test implementation and literal expected records.
- [ ] **Step 2: Run `CI=true pnpm test src/demoAccount.test.ts`** and verify failure because the module does not exist.
- [ ] **Step 3: Implement the types, validators, key constants, and injected-storage helpers.** `SavedRentalPlan.version` is exactly `1`; password is absent from every persistence interface; helpers catch storage errors and return discriminated success/failure results.
- [ ] **Step 4: Run `CI=true pnpm test` and `CI=true pnpm exec tsc --noEmit`;** expect all tests and type checking to pass.
- [ ] **Step 5: Commit** with `feat: add browser-local demo account state`.

### Task 2: My Rental Plan summary component

**Files:**

- Create: `src/RentalPlan.tsx`
- Create: `src/RentalPlan.test.tsx`
- Modify: `src/index.css`

**Interfaces:**

- Consumes: `RentalDecisionRecord`, `RoommateSelection`, `OptionalPlanStatus`, and `buildRentalDecisionReceipt`.
- Produces: `RentalPlanSummary` with props `decision`, `roommate`, `roommateStatus`, `advisorStatus`, `savedAt`, `saveState`, `onViewReceipt`, `onChangeRental`, `onExploreRoommates`, `onChangeRoommate`, `onReviewAdvisor`, `onViewAdvisor`, `onSkipRoommate`, `onSkipAdvisor`, `onSave`, and `onContinueWithoutSaving`.

- [ ] **Step 1: Write failing server-rendered tests** named `shows one apartment roommate and advisor decision summary`, `derives the roommate share from the active receipt`, `shows useful actions when optional steps are not started`, `distinguishes skipped steps from completed steps`, and `keeps an unknown external deposit unconfirmed`.
- [ ] **Step 2: Run `CI=true pnpm test src/RentalPlan.test.tsx`** and verify failure because the component does not exist.
- [ ] **Step 3: Implement the component** using existing RentWell cards, typography, buttons, and honest prototype labels; never copy cost values from roommate fixtures.
- [ ] **Step 4: Add responsive styles** for desktop card columns and a single-column compact layout without horizontal overflow.
- [ ] **Step 5: Run `CI=true pnpm test` and `CI=true pnpm exec tsc --noEmit`;** expect all tests and type checking to pass.
- [ ] **Step 6: Commit** with `feat: add unified rental plan summary`.

### Task 3: Roommate selection and plan handoff

**Files:**

- Create: `src/roommateProfiles.ts`
- Create: `src/roommateProfiles.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/roommatePlanning.test.ts`
- Modify: `src/index.css`

**Interfaces:**

- Consumes: `RoommateSelection` and `RentalPlanSummary` from Tasks 1–2.
- Produces: exported `RoommateProfile`, `ROOMMATE_PROFILES`, `createRoommateSelection(profile, decisionId)`, `bindPendingRoommate(selection, decisionId)`, and `Matches.onChooseRoommate(selection)`.

- [ ] **Step 1: Write failing pure tests** named `creates a pending roommate-first choice without rental costs`, `binds a pending choice to exactly one selected rental`, and `clears a roommate bound to a different decision`.
- [ ] **Step 2: Write failing component tests** proving every fictional profile has `Choose this roommate`, rental-first selection opens My Rental Plan with the correct title/profile/share, and roommate-first selection returns home with a choose-rental prompt and no fabricated cost.
- [ ] **Step 3: Run `CI=true pnpm test`** and verify the new tests fail for missing selection behavior.
- [ ] **Step 4: Extract the existing profiles** into `roommateProfiles.ts`, add stable IDs, and implement the pure selection helpers.
- [ ] **Step 5: Integrate App-owned roommate selection and `plan-summary` navigation.** A pending choice binds when `openListing` or `openExternalDecision` establishes a rental; opening a different rental clears a previously bound choice.
- [ ] **Step 6: Run `CI=true pnpm test` and `CI=true pnpm exec tsc --noEmit`;** expect all tests and type checking to pass.
- [ ] **Step 7: Commit** with `feat: connect roommate choices to rental plans`.

### Task 4: Advisor completion and plan handoff

**Files:**

- Modify: `src/Advisor.tsx`
- Modify: `src/Advisor.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/RentalPlan.test.tsx`

**Interfaces:**

- Consumes: App-owned `advisorStatus` and active decision ID plus `RentalPlanSummary`.
- Produces: `TrueHousingCost.onCompleteReview`, `DecisionSummary.onAddToPlan`, and App behavior associating review completion with exactly one decision ID.

- [ ] **Step 1: Write failing tests** named `marks Advisor review complete only when the summary is reached`, `adds the reviewed decision to My Rental Plan`, and `clears reviewed status when the active rental changes`.
- [ ] **Step 2: Run `CI=true pnpm test`** and verify failure for missing callbacks/state transitions.
- [ ] **Step 3: Implement the completion callbacks and plan action.** The Advisor remains inaccessible without an active decision; no lease text or uploaded file data enters saved state.
- [ ] **Step 4: Run `CI=true pnpm test` and `CI=true pnpm exec tsc --noEmit`;** expect all tests and type checking to pass.
- [ ] **Step 5: Commit** with `feat: add advisor findings to rental plans`.

### Task 5: Renter demo access and save flow

**Files:**

- Create: `src/DemoAccountAccess.tsx`
- Create: `src/DemoAccountAccess.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/RentalPlan.test.tsx`
- Modify: `src/index.css`

**Interfaces:**

- Consumes: Task 1 persistence helpers and the complete in-memory plan from Tasks 2–4.
- Produces: `DemoAccountAccess` with role-aware `mode`, `onModeChange`, `onSubmit({ email, companyName? })`, and `onCancel`; `DemoAccountMenu`; App screens `renter-account` and `plan-summary`; and save/reload/sign-out/reset behavior.

- [ ] **Step 1: Write failing access-form tests** proving renter and manager copy differ, create-account company name appears only for managers, required fields block submission, password is omitted from the submit payload, and prototype limitations are visible.
- [ ] **Step 2: Write failing App/state tests** named `save while signed out opens renter access`, `matching demo email saves and restores its plan`, `different email cannot view saved details`, `sign out hides plan details without deleting the plan`, `reset removes only RentWell demo keys after confirmation`, and `storage failure keeps the plan visible with an error`.
- [ ] **Step 3: Run `CI=true pnpm test`** and verify the new tests fail for missing access and save behavior.
- [ ] **Step 4: Implement `DemoAccountAccess` and `DemoAccountMenu`** without persisting or returning password values.
- [ ] **Step 5: Integrate renter session initialization, email-scoped plan loading, pending-save return, save status, sign-out, and reset into App.** Header `My Plan` opens details only for the matching active renter session; signed-out state shows only a generic saved-plan availability prompt.
- [ ] **Step 6: Run `CI=true pnpm test` and `CI=true pnpm exec tsc --noEmit`;** expect all tests and type checking to pass.
- [ ] **Step 7: Commit** with `feat: add renter demo accounts and saved plans`.

### Task 6: Property-manager demo access and free pilot

**Files:**

- Create: `src/ManagerPilot.tsx`
- Create: `src/ManagerPilot.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/ManagerWorkspace.test.tsx`
- Modify: `src/index.css`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-11-19-unified-renter-journey-design.md`

**Interfaces:**

- Consumes: `DemoAccountAccess`, manager session/pilot persistence helpers, and existing `ManagerWorkspace`.
- Produces: `ManagerPilot` with `onStartPilot`, `onRequestDemo`, and `onSignOut`; App screens `manager-account` and `manager-pilot`; guarded manager workspace entry.

- [ ] **Step 1: Write failing component tests** named `shows a no-payment free-pilot offer without invented pricing` and `records start-pilot and request-demo as separate local choices`.
- [ ] **Step 2: Write failing App/navigation tests** proving property-manager navigation opens manager access while signed out, renter session does not unlock the workspace, manager access leads to pilot onboarding, and a manager pilot choice opens the workspace.
- [ ] **Step 3: Run `CI=true pnpm test`** and verify the new tests fail for missing manager guards and pilot screen.
- [ ] **Step 4: Implement `ManagerPilot` and role-guarded App navigation.** Keep `For property managers` visually separate; show `No payment collected in this prototype` and `Subscription pricing ... has not been finalized.`
- [ ] **Step 5: Update README and the unified master spec** with the complete renter plan, demo-account limitations, manager pilot flow, and presentation path.
- [ ] **Step 6: Run `CI=true pnpm exec oxfmt` only on files changed by this plan, then run `CI=true pnpm test`, `CI=true pnpm exec tsc --noEmit`, `CI=true pnpm run test:data`, and `CI=true pnpm run build`;** expect 0 failures and a successful production build.
- [ ] **Step 7: Commit** with `feat: complete demo account and manager pilot journeys`.

## Self-review notes

- Spec coverage: all renter summary, roommate handoff, Advisor completion, email-scoped saving, sign-out/reset, manager access, pilot, disclosure, and verification requirements map to Tasks 1–6.
- Type consistency: `RoommateSelection`, `OptionalPlanStatus`, and `SavedRentalPlan` originate only in Task 1; downstream tasks consume those exact exports.
- Review-focus coverage: storage failure/malformed data belongs to Task 1 and Task 5; email isolation to Tasks 1 and 5; rental-change cleanup to Tasks 3–4; unknown deposit to Task 2; role separation to Tasks 1 and 6.
- Deliberate boundary: real authentication, manager-inventory persistence, live AI, payments, and the roommate ranking algorithm remain outside the plan.
