# RentWell Unified Renter Journey

**Date:** November 19, 2026
**Status:** Approved for implementation
**Audience:** RentWell hackathon team, designers, and implementers

## Intent

Make RentWell feel like one decision product rather than several adjacent prototypes. A renter may begin with a RentWell demo listing or a rental found elsewhere, but both entrances must converge on the same explainable Decision Receipt. Cost sharing and roommate matching remain available as an optional continuation rather than mandatory steps in rental evaluation.

The pitchable product promise is:

> RentWell can evaluate a rental whether you find it through RentWell or somewhere else.

## Goals

- Give renters two clear starting choices: browse available rentals or check a rental they already found.
- Converge both choices on one consistent rental record and Decision Receipt language.
- Present Fair Rent, mandatory fees, true monthly cost, move-in cost, confidence, evidence freshness, and missing information in one place.
- Let renters finish after evaluating a rental or optionally continue into cost sharing and roommate matching.
- Preserve roommate planning as both an independent roommate-first journey and an optional rental-first continuation.
- Preserve search, saved, compared, tour-requested, and manager-edit behavior.
- Keep the competition demo understandable when presented by any team member.

## Non-goals

- Live listing extraction, live RentCast calls, or live property-management-system synchronization.
- Production persistence, authentication, payments, applications, screening, or lease signing.
- Rebuilding every visual component or replacing the existing RentWell design system.
- Turning roommate matching into a required step for renters who plan to live alone.

## Anti-goals

- Do not show a five-step progress bar that implies all renters must complete roommate matching.
- Do not maintain separate Fair Rent calculations or labels for browsed and manually entered rentals.
- Do not silently convert incomplete external-rental information into fabricated listing details.
- Do not place the property-manager workspace in the primary renter navigation.

## Current problem

The app currently contains two disconnected renter journeys:

1. **Browse Rentals** → listing details → Decision Receipt → save, compare, or tour.
2. **Check a Rental** → Fair Rent analysis → roommate math → roommate preferences → matches.

The second journey is labeled as one five-step rental check even though steps 3–5 are a separate roommate journey. It also uses a `RentalData` sample that differs from the shared `DemoListing` records used by Browse Rentals and the manager workspace. The duplicate models and parallel navigation create duplicate terminology, different example properties, and no handoff between discovery, evaluation, and sharing.

## Selected approach: one journey with two entrances

The selected approach is a unified decision journey. The home page offers:

- **Browse rentals** — for renters who are still searching.
- **Check a rental you found** — for renters bringing a listing from another source.

Both entrances create or select a common decision record and open the same Decision Receipt experience.

```text
                           RENTWELL
                              |
              +---------------+----------------+
              |                                |
      Browse available rentals       Check a rental you found
              |                       elsewhere
              +---------------+----------------+
                              |
                    Selected rental record
                              |
                    RentWell Decision Receipt
                Fair Rent + fees + move-in cost
                              |
              +---------------+----------------+
              |                                |
       Save / compare / tour          Explore sharing this home
                                               |
                                      Cost split -> Preferences
                                               |
                                             Matches
```

### Alternatives considered

1. **Keep separate tools.** This requires fewer changes, but RentWell continues to feel like unrelated utilities and duplicates the Fair Rent explanation.
2. **Add a decision-dashboard hub.** This is flexible, but introduces another screen and too many competing choices for the hackathon story.
3. **Unified journey with two entrances.** Selected because it reuses the existing screens, produces the clearest pitch, and lets users bring rentals from outside RentWell without forcing roommate matching.

## Information architecture

### Renter navigation

Primary renter navigation becomes:

- **Browse Rentals**
- **Check Your Rental**
- **Roommate Planning**
- **AI Advisor**
- **How It Works**

**Manager Workspace** moves out of the renter navigation and becomes a visually distinct **For property managers** role entry. It may remain in the same prototype but must not look like the next renter task.

Roommate planning supports two valid perspectives:

- **Rental-first:** a renter evaluates a specific rental, then selects **Plan costs with roommates**. The selected rental and costs are handed to the roommate journey.
- **Roommate-first:** a renter enters **Roommate Planning** directly to define preferences before choosing a specific rental. This remains a separate colleague-owned feature path.

These paths may converge later, but this feature does not redesign or replace the colleague-owned roommate-planning experience.

### Home page

The hero keeps the promise **Find the right place. At the right price. With the right people.**

Actions change to:

- Primary: **Browse rentals**
- Secondary: **Check a rental you found**

The explanatory section becomes three stages rather than two unrelated cards:

1. **Find or bring a rental**
2. **Understand the real cost**
3. **Decide solo or shared**

The home-page sample should use a committed synthetic listing rather than the disconnected `$2,100` sample.

## Unified screen behavior

### Entrance A: Browse Rentals

The renter searches the six demo listings and selects **View details**. The selected `DemoListing` becomes the decision record and opens the existing listing-details page with the Decision Receipt.

### Entrance B: Check Your Rental

The renter pastes a listing description or enters fields manually. Extraction remains explicitly simulated. The form collects only supported decision inputs:

- title or short label
- neighborhood
- monthly rent
- bedrooms
- square footage when known
- mandatory recurring fees
- move-in date

Submitting the form creates an in-memory external decision record with honest placeholders for unknown images, amenities, parking, pets, utilities, and manager actions. It opens the same Decision Receipt layout used by a browsed listing.

External rentals must be labeled **Rental you entered · Demo analysis**. Unsupported actions such as requesting a tour are hidden. The renter may save the evaluation locally or continue to sharing.

### Decision Receipt

All rentals use the same labels and formulas:

- advertised rent
- known mandatory recurring fees
- true monthly cost
- estimated move-in cost
- Fair Rent result
- snapshot comparison range and comparable count
- confidence and freshness
- information to confirm

The separate full-page **Fair rent analysis** screen is removed as a competing destination. Its useful comparison explanation is incorporated into the expandable Decision Receipt calculation.

Actions are context-aware:

- **Save listing** or **Save evaluation**
- **Add to compare** when a comparable shared record exists
- **Request a tour** only for browsed demo listings
- **Plan costs with roommates** for any rental
- **Back to listings** or **Back to rental entry**, matching the entrance

### Optional roommate branch

Selecting **Plan costs with roommates** opens the existing cost-split screen using the current decision record. The roommate sub-flow is:

1. **Cost split**
2. **Living preferences**
3. **Matches**

This branch gets its own three-stage progress indicator. It must not describe itself as steps 3–5 of checking a rental.

The renter can exit back to the Decision Receipt at any point. Matches remain fictional and preference-based, with the existing fair-housing guardrails.

Direct **Roommate Planning** navigation may continue to open the roommate-first experience without a selected rental. The roommate feature must distinguish the two entry contexts rather than silently attaching the disconnected `$2,100` sample to every user.

### Roommate handoff boundary

The current renter-flow work owns only the handoff into roommate planning. It supplies a stable context containing:

- entry perspective: `rental-first` or `roommate-first`
- listing ID when available
- listing title or user-entered label
- neighborhood
- advertised rent
- known mandatory recurring fees
- true monthly cost
- bedrooms

The colleague-owned roommate feature owns its landing experience, preferences, matching logic, and final UI. This branch must avoid broad visual or behavioral rewrites inside those screens so the colleague's work can merge with minimal conflict.

## Data and state design

- `DemoListing` remains the shared persisted-in-memory record used by renter and manager screens.
- Introduce a small decision-record adapter that normalizes either a `DemoListing` or external form data for Decision Receipt calculations.
- Reuse one receipt calculation function for both sources.
- Preserve original provenance: `synthetic-demo-listing` or `user-entered-demo-analysis`.
- Do not add fabricated amenities, images, contacts, fees, or availability to external records.
- The active decision record feeds roommate math so rent and fees cannot diverge between screens.
- The roommate handoff context remains small and typed so the colleague-owned implementation can consume it without depending on the full listing UI.
- Returning to Browse Rentals preserves the existing query.

## Visual consistency

- Keep the existing RentWell header, colors, DM Sans/Manrope typography, card radii, and controls.
- Use the cream editorial surface for discovery and details; use the focused form surface for data entry.
- Replace the global numbered five-step bar with contextual stage indicators.
- Limit roommate-screen edits to separating their progress language from the rental check; the colleague-owned redesign remains out of scope.
- Keep page headings left-aligned on discovery/details screens and centered only where a focused form benefits from it.
- Use the same terms—Decision Receipt, true monthly cost, mandatory fees, and Fair Rent—throughout.

## Required interaction paths

### Browse path

Home → Browse rentals → Select listing → Decision Receipt → Plan costs with roommates → Preferences → Matches → Return to Decision Receipt.

### External-rental path

Home → Check a rental you found → Enter/extract details → Decision Receipt → Save evaluation or plan costs with roommates.

### Roommate-first path

Home or navigation → Roommate Planning → colleague-owned roommate journey, with no fabricated selected rental.

### Manager path

For property managers → Edit listing → Save → Preview renter view → Decision Receipt → Back to manager workspace.

## Validation and acceptance criteria

- Both renter entrances reach the same Decision Receipt component and calculation contract.
- No screen calls roommate matching a required part of rental checking.
- No global five-step progress bar remains.
- Roommate Planning remains directly discoverable and supports a roommate-first entrance.
- Rent and recurring fees shown in the receipt, cost split, and matches context agree.
- A browsed listing preserves save, compare, tour, calculation disclosure, and back behavior.
- An external rental clearly marks missing information and does not show unsupported tour or manager controls.
- Browse search is preserved after returning from details.
- Manager edits still change the same renter-facing record.
- Desktop and compact/mobile layouts have no horizontal overflow or dead-end actions.
- Automated tests cover both entry paths, receipt parity, source-specific actions, roommate handoff, and back destinations.
- Tests verify both `rental-first` and `roommate-first` handoff contexts without asserting the colleague-owned roommate UI details.

## Implementation boundary

Implement this as a new reviewable feature branch stacked on the current combined property-manager branch. Keep the existing draft pull requests unmerged. Treat roommate planning as an integration boundary: establish the typed handoff and correct the misleading five-step coupling, but avoid redesigning the colleague-owned roommate screens. Do not push or open another pull request until the full flow is verified and the user explicitly approves the branch handoff.
