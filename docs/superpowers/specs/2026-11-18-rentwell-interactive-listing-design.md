# RentWell Interactive Listing Design

## Intent

Turn the renter listings experience from a static gallery into a clear decision journey: browse a rental, open its details, understand the real cost and Fair Rent assessment, and save or compare it. The signature feature is the explainable RentWell Decision Receipt.

## Goals

- Keep listing cards equal in height and visually aligned.
- Give every listing a dedicated, shareable details view.
- Show true monthly cost, move-in cost, neighborhood comparison, missing information, confidence, and data freshness.
- Make one representative listing fully interactive in the Figma prototype.
- Connect manager edits to a renter-facing cost and disclosure preview.

## Non-goals

- Payments, applications, tenant screening, or lease signing.
- Live property-management-system synchronization.
- Twenty individually designed listing-detail pages.
- A general-purpose AI chatbot.

## Approach

Considered approaches were an expanding card, a quick-view drawer, and a dedicated details page. Expanding cards undermine grid alignment. A drawer is useful for quick preview but too constrained for the complete decision experience. The selected approach is a dedicated listing-details page, which is the canonical view on desktop and mobile.

## Renter flow

1. The renter filters or searches the aligned listing grid.
2. Selecting a card or **View details** opens the listing-details page.
3. The page presents property media and facts alongside the Decision Receipt.
4. The renter can expand **How we calculated this**, save the listing, add it to comparison, or request a tour.
5. Returning to listings preserves the previous search and filters.

## Listing-details content

- Photo gallery, property name, address/neighborhood, beds, baths, property type, and availability.
- Amenities, pet policy, parking, utilities, and manager contact.
- Advertised rent, known recurring fees, true monthly cost, and estimated move-in cost.
- Comparable neighborhood range and a plain-language Fair Rent result.
- Explanation of price differences, confidence level, source count, update date, and missing-information warnings.
- Actions: Save, Add to compare, and Request a tour.

## Interaction behavior

- **How we calculated this** expands the comparable-rental explanation.
- **Save rental** toggles to **Saved**.
- Optional costs, when present, recalculate true monthly cost immediately.
- Desktop keeps the Decision Receipt visible in a right-side panel.
- Mobile presents the receipt as a normal section after the core property details.
- The manager edit panel updates its renter preview when rent, fees, availability, or disclosure fields change.

## Constraints and guardrails

- Use the existing RentWell colors, typography, navigation, spacing, buttons, and cards.
- Use synthetic demo content and label uncertain or missing values honestly.
- Explain Fair Rent conclusions; do not present an unsupported black-box score.
- Preserve responsive behavior and accessible focus, labels, contrast, and Back navigation when implemented in code.
