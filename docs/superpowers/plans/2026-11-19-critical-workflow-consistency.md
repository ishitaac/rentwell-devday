# Critical Workflow Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RentWell demonstrate one connected renter decision journey with one authoritative Decision Receipt, a contextual lease Advisor, current roommate timing, and unambiguous Fair Rent language.

**Architecture:** Keep `RentalDecisionRecord` as the shared renter record and derive Advisor values from the existing receipt builder rather than storing a second fictional rental. Treat the Advisor as an optional extension opened from the Decision Receipt, while leaving the two rental entrances and roommate-first path intact.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, server-rendered component tests.

**Spec:** `docs/superpowers/specs/2026-11-19-unified-renter-journey-design.md`

## Global Constraints

- Both rental entrances converge on the same `RentalDecisionRecord` and Decision Receipt.
- Do not introduce a second Fair Rent or true-monthly-cost calculation.
- Preserve honest synthetic-data and simulated-AI labels.
- Roommate planning remains optional and supports both rental-first and roommate-first entry.
- Property manager preview continues to use the renter Decision Receipt.

## Review Focus

- Opening the Advisor without a rental must not fabricate an active rental decision.
- Advisor costs and market evidence must change when the active rental changes.
- The fictional lease must remain clearly labeled and must not imply uploaded files were processed.
- Roommate-first navigation must not claim it can return to a nonexistent rental Receipt.
- Fair Rent wording must distinguish advertised rent from true monthly cost.

---

### Task 1: Clarify the homepage journey and Fair Rent basis

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/Home.test.tsx`
- Modify: `src/Listings.tsx`
- Modify: `src/Listings.test.tsx`

**Interfaces:**
- Consumes: existing `Home` and `RentalDecisionDetails` props.
- Produces: explanatory stage cards and explicit base-rent comparison wording.

- [ ] **Step 1: Write failing component tests** proving stage cards are explanatory, the hero match preview is labeled fictional, and Fair Rent says it compares advertised rent before fees.
- [ ] **Step 2: Run the focused tests and verify they fail for the missing behavior.**
- [ ] **Step 3: Implement the minimal copy and semantic changes.**
- [ ] **Step 4: Run the focused tests and the complete source test suite.**
- [ ] **Step 5: Commit the task.**

### Task 2: Derive the Advisor from the active rental decision

**Files:**
- Create: `src/advisorDecision.ts`
- Create: `src/advisorDecision.test.ts`
- Modify: `src/Advisor.tsx`
- Create: `src/Advisor.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/Listings.tsx`
- Modify: `src/Listings.test.tsx`

**Interfaces:**
- Consumes: `RentalDecisionRecord`, `buildRentalDecisionReceipt`, and the dated RentCast snapshot.
- Produces: `buildAdvisorDecisionModel(record, snapshot)` and a Receipt-to-Advisor navigation action.

- [ ] **Step 1: Write failing model and component tests** proving Advisor costs, comparable count, rental title, and return actions come from the selected decision.
- [ ] **Step 2: Run focused tests and verify the expected failures.**
- [ ] **Step 3: Implement the shared Advisor model and pass the active decision through Advisor screens.**
- [ ] **Step 4: Route Advisor entry through the Decision Receipt; when no decision exists, route the navigation entry to rental entry rather than fabricating data.**
- [ ] **Step 5: Run focused and complete source test suites.**
- [ ] **Step 6: Commit the task.**

### Task 3: Remove stale roommate timing and stale-context exits

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/roommatePlanning.test.ts`

**Interfaces:**
- Consumes: `RoommatePlanningContext.mode` and existing App-owned context creation functions.
- Produces: current/flexible timing choices and context-appropriate exits from roommate matches.

- [ ] **Step 1: Write failing tests** proving 2025 timing is absent and rental-first matches expose a direct return to the Decision Receipt.
- [ ] **Step 2: Run focused tests and verify the expected failures.**
- [ ] **Step 3: Implement current timing options and context-sensitive match actions.**
- [ ] **Step 4: Run focused and complete source test suites.**
- [ ] **Step 5: Commit the task.**

### Task 4: Synchronize teammate-facing documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-11-19-unified-renter-journey-design.md`

**Interfaces:**
- Consumes: implemented workflow and committed 20-listing dataset.
- Produces: one accurate demo script and data explanation for any presenter.

- [ ] **Step 1: Update the master design from six visible demo listings to 20 searchable listings with progressive display.**
- [ ] **Step 2: Update README workflow, simulation boundaries, and the recommended presentation path.**
- [ ] **Step 3: Run formatting, TypeScript, source tests, data tests, and production build.**
- [ ] **Step 4: Commit the task.**
