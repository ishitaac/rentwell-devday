# Saved Rental Plan and Demo Accounts Design

## Intent

RentWell currently helps a renter evaluate an apartment, explore roommate matches, and review a fictional lease, but those branches do not end in one durable decision view. The property-manager workspace also appears without an account or business onboarding story.

This feature completes both journeys for the hackathon. It adds a renter-facing **My Rental Plan** summary, a meaningful roommate selection, role-aware demo account screens, browser-local saving, and a property-manager free-pilot entrance. The experience must be fully clickable while remaining honest that no real authentication, cloud persistence, document processing, subscription charge, or payment occurs.

## Goals

- Give the renter journey a clear destination that combines the active apartment, roommate choice, cost split, and Advisor status.
- Let a renter save and reopen the plan during the same browser session or a later visit on the same device.
- Give **Save my plan** a meaningful account-creation/sign-in path.
- Give property managers a role-specific sign-in/create-account path and a free-pilot onboarding screen before the existing workspace.
- Demonstrate the renter acquisition and property-manager revenue story without inventing validated subscription pricing.
- Preserve the existing Decision Receipt as the source of truth for rental calculations.

## Non-goals

- Real authentication, authorization, password recovery, email verification, or account security.
- Storing passwords, payment information, uploaded documents, or sensitive identity information.
- Cloud persistence, cross-device synchronization, or multi-user collaboration.
- Stripe or another payment processor.
- A real paid subscription or a committed price.
- Rebuilding the colleague-owned roommate matching algorithm.
- Live AI, legal advice, or real lease-document processing.

## Anti-goals

- Do not imply that a prototype account is secure or that a payment occurred.
- Do not create a second rent, fee, Fair Rent, or roommate split calculation.
- Do not require roommate matching or Advisor review before a renter can see or save a plan.
- Do not fabricate a selected roommate before the renter explicitly chooses one.
- Do not make the manager experience look like the next mandatory renter step.

## Approaches considered

### 1. Hackathon account simulation — selected

Use React state plus namespaced `localStorage` records for non-sensitive demo sessions and saved plans. Provide honest account and free-pilot screens, with no password storage and no external requests. This creates a complete technical story at hackathon scope.

### 2. Real authentication and subscription infrastructure

Use a hosted identity provider, database, and Stripe. This would provide genuine accounts and persistence, but it introduces secrets, security decisions, schema work, deployment configuration, and payment risk that are disproportionate to the competition timeline.

### 3. UI-only account screens

Show account and pricing pages without preserving any state. This is faster, but buttons would not create a meaningful technical demonstration and the user would still lose their plan.

## Product structure

### Renter journey

```text
Browse rental or enter rental
              |
       Decision Receipt
        /      |       \
 Roommates   Advisor   My Rental Plan
     |          |            |
Choose one   Findings     Save my plan
     \          /            |
        My Rental Plan -> Sign in / Create demo account
                                |
                         Saved on this device
```

The summary remains available before every optional branch is complete. Missing optional steps appear as useful next actions, not errors.

### Property-manager journey

```text
For property managers
          |
Manager sign in / Create demo account
          |
 Start free pilot / Request demo
          |
 Existing Manager Workspace
```

The free-pilot screen explains the proposed value—clear listing fees, renter-ready Decision Receipts, and property-software import—but does not show a price or collect payment information.

## My Rental Plan screen

The page uses the current RentWell visual system and contains:

1. **Plan heading**
   - `My Rental Plan`
   - active rental title and neighborhood
   - status: `In progress` or `Saved on this device`

2. **Apartment decision card**
   - advertised rent
   - mandatory recurring fees
   - true monthly cost
   - Fair Rent result with the existing advertised-rent-before-fees disclosure
   - buttons: `View Decision Receipt` and `Change rental`

3. **Roommate plan card**
   - when none is selected: `No roommate selected` and `Explore roommate matches`
   - when selected: fictional profile name, compatibility score, estimated equal monthly share, and `Change roommate`
   - the equal split is derived from the active rental decision; it is not copied from profile fixtures

4. **Advisor card**
   - before review: `Lease review not completed` and `Review fictional sample lease`
   - after review: `Fictional sample reviewed`, the number of supported evidence topics, and the existing landlord-question summary
   - button: `View Advisor summary`

5. **Decision checklist**
   - rental evaluated
   - recurring fees reviewed
   - deposit confirmed or still missing
   - roommate selected or intentionally skipped
   - fictional lease review completed or skipped

6. **Primary actions**
   - `Save my plan`
   - `Continue without saving`

`Continue without saving` keeps the in-memory plan and returns home without claiming persistence. `Save my plan` opens renter account access when no renter demo session exists; otherwise it saves immediately.

## Roommate selection behavior

- Matches remain explicitly fictional.
- Each match has a real `Choose this roommate` action.
- Choosing a profile stores a small selection containing profile ID, display name, compatibility score, and the active rental decision ID.
- Selection opens **My Rental Plan**.
- If the active rental changes, the old roommate selection is cleared because its cost split belongs to the previous decision.
- Roommate-first users may still inspect matches without a rental. Choosing a roommate in that mode stores the profile as a pending roommate choice, returns home with a prompt to choose a rental, and must not fabricate apartment costs.
- When the renter subsequently selects or enters a rental, the pending roommate choice binds to that decision and My Rental Plan opens with a newly derived split. The renter does not need to select the same roommate twice.

## Advisor completion behavior

- Opening the Advisor continues to require an active rental.
- Reaching the Advisor Decision Summary sets `advisorReviewed` for the active decision.
- The Advisor summary gains `Add to My Rental Plan` / `Back to My Rental Plan` rather than ending only in roommate planning.
- Changing the active rental clears the prior Advisor-reviewed status.
- The summary stores no lease text or uploaded file data; it stores only the reviewed flag and decision ID.

## Demo account access

Use one reusable, role-aware account component with different copy for renters and managers.

### Renter account

- Entry: `Save my plan` or an `Account` navigation action.
- Tabs: `Sign in` and `Create account`.
- Fields: email and password-shaped input for demonstration.
- The password value is used only for required-field validation and is never persisted.
- Successful submission creates a demo session with role `renter`, a display label derived from the email, and a visible notice: `Prototype account—saved only in this browser.`
- After access, the pending plan is saved and the user returns to **My Rental Plan**.

### Property-manager account

- Entry: `For property managers`.
- Tabs: `Sign in` and `Create account`.
- Fields: work email, password-shaped input, and company name on create-account.
- No password is persisted.
- Successful submission creates a demo session with role `property-manager` and opens the free-pilot onboarding screen.

### Session controls

- Header shows `My Plan` for renter context and `Manager account` for manager context.
- A small account menu provides `Sign out of demo` and `Reset saved demo data`.
- Signing out removes the role session but does not silently delete a saved renter plan.
- Reset requires explicit confirmation and removes only RentWell’s namespaced local demo data.

## Free-pilot onboarding

The manager onboarding screen contains:

- `Start a free property-manager pilot`
- three value points: fee transparency, renter-ready Decision Receipts, and property-software import readiness
- `No payment collected in this prototype`
- primary action: `Start free pilot`
- secondary action: `Request a demo` that records a local confirmation only
- a clear line: `Subscription pricing is proposed for the business model and has not been finalized.`

Both actions may open the existing Manager Workspace. The chosen action is stored locally only so the screen can show a confirmation when revisited.

## State and persistence

Introduce focused state types outside `App.tsx`:

```ts
type DemoRole = "renter" | "property-manager";

type DemoSession = {
  role: DemoRole;
  email: string;
  displayName: string;
};

type RoommateSelection = {
  profileId: string;
  displayName: string;
  compatibilityScore: number;
  decisionId: string | null;
};

type SavedRentalPlan = {
  version: 1;
  ownerEmail: string;
  decision: RentalDecisionRecord;
  decisionOrigin: DecisionOrigin;
  roommate: RoommateSelection | null;
  roommateStatus: "not-started" | "selected" | "skipped";
  advisorReviewedDecisionId: string | null;
  advisorStatus: "not-started" | "reviewed" | "skipped";
  savedAt: string;
};
```

Use namespaced keys:

- `rentwell.demo.session.renter`
- `rentwell.demo.session.manager`
- `rentwell.demo.saved-plans.v1`
- `rentwell.demo.manager-pilot`

Persistence helpers must:

- accept an injected `Storage` object so they are testable
- validate parsed values before returning them
- ignore malformed or older incompatible values safely
- never persist password fields
- work when storage is unavailable by preserving the current in-memory journey and showing that saving failed

The saved-plans key stores a small map keyed by normalized renter email. A signed-out visitor can see only that a saved demo plan exists on the device, not its rental or roommate details. Signing in with the matching demo email reopens that plan. A different demo email gets a separate plan and cannot silently replace or inspect the first email's plan.

## Navigation and integration

Add screens to the existing App state machine rather than introducing a router during the hackathon:

- `plan-summary`
- `renter-account`
- `manager-account`
- `manager-pilot`

Existing screens remain the source of their specialist details. The new summary links back to them rather than duplicating their full UI.

When a saved plan is loaded, restore its exact `RentalDecisionRecord`, origin, roommate choice, and Advisor-reviewed status. The saved decision is a snapshot of what the renter approved and must not be silently replaced by the original committed fixture after a refresh. Manager edits continue to refresh an active decision during the same session; persisting manager inventory edits across a browser refresh remains outside this feature.

The plan checklist distinguishes `not-started`, `selected/reviewed`, and `skipped`. Each optional card includes an explicit `Skip for now` or `Include in plan` action. A skipped item remains visible as skipped and can be reopened later; it is not presented as completed.

## Honest prototype language

Every account and pilot screen includes one of these visible labels:

- `Prototype account—saved only in this browser`
- `Demo sign-in—no secure account is created`
- `No payment collected in this prototype`
- `Request recorded locally for demonstration`

Do not use `Account created`, `Subscription active`, or `Payment successful` without the word `demo` or `prototype`.

## Error and empty states

- My Rental Plan with no active rental redirects to Browse Rentals with a plain explanation.
- A missing deposit remains `Confirm with manager`; it is never assumed.
- Saving without storage support leaves the plan visible and displays `Could not save on this device`.
- Corrupt saved data is ignored and does not break application startup.
- Manager access without a completed demo session returns to the manager account screen.
- Renter access does not unlock the manager workspace, and a manager demo session does not represent a renter account.

## Testing and acceptance criteria

- Choosing a fictional roommate from a rental-first flow opens My Rental Plan with the correct rental title, profile, and split.
- My Rental Plan works when roommate and Advisor steps are skipped.
- Advisor completion is associated with the active decision ID and clears when the rental changes.
- Saving while signed out opens renter account access; successful demo access saves and returns to the plan.
- A saved plan reloads from valid local storage and rejects malformed storage.
- Signed-out and differently signed-in demo users cannot see another demo email's saved plan details.
- Password values are never written to storage.
- Property-manager navigation requires the manager demo access screen before the workspace.
- Starting a free pilot records only a local demo state and opens the Manager Workspace.
- Renter and manager sessions remain role-separated.
- A roommate-first choice carries into the next selected rental and binds to that decision without fabricating earlier costs.
- Checklist state distinguishes optional steps that are not started from steps intentionally skipped.
- All account, saved-plan, subscription, AI, data, and document limitations are visible.
- Existing Browse, external rental, Decision Receipt, Advisor, roommate-first, and manager editing tests continue to pass.
- TypeScript validation, data validation, and the production Vite build pass.

## Delivery boundary

Implement on `feature/unified-renter-journey` so PR #7 updates automatically. Do not merge the pull request. Do not add external dependencies, secrets, hosted services, or payment configuration. Keep the local HTTP preview usable for the team.
