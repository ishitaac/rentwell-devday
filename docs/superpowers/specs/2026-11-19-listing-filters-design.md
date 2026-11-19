# RentWell Listing Filters

**Date:** November 19, 2026
**Status:** Approved for implementation

## Intent

Replace the decorative listing filter pills with controls that visibly and accurately filter the six renter-facing demo listings. A renter must be able to tell why results changed and return from listing details without losing the search and filter context.

## Root cause

`ListingsBrowser` currently filters only its search query. The labels **Any price**, **Any beds**, **Any move-in date**, and **Complete fee disclosure** are static `<span>` elements with no state, events, or filtering logic. They look interactive but cannot change results.

## Selected design

- Use native select controls for true monthly cost, bedrooms, and move-in month.
- Use a checkbox for listings with no mandatory recurring fees.
- Price ranges use true monthly cost: under $1,200; $1,200–$1,600 inclusive; and over $1,600.
- Bedroom choices are Any, Studio, 1, 2, and 3+.
- Move-in choices are Any, December 2026, and January 2027, matching committed fixtures.
- Keep **Complete fee disclosure** as an informational badge, not a fake control, because every demo listing already has complete disclosure.
- Show **Clear all** only when search or a filter is active; it resets both.
- Show a clear empty-results state when no listing matches.
- Keep search and filter state App-owned so returning from details preserves it.
- Label the untouched results section **Available rentals** without a number; show a numeric match count only after search or a filter is active.
- Search and filter all 20 committed demo listings, while initially rendering six cards.
- Show a **Show more rentals** button whenever additional matching listings remain; each click reveals up to six more.
- Reset the visible-card limit to six whenever search or filters change so results begin at the top of the new set.

## Acceptance criteria

- The initial Browse Rentals page shows all six listings.
- The initial results heading says **Available rentals** and does not imply the six demo cards are the full market.
- The hero accurately says **20 synthetic demo listings**.
- A search can find a listing beyond the first six records.
- Show more is hidden once every matching listing is visible.
- Every visible filter changes the result set and count.
- Multiple filters combine with search using AND logic.
- Boundary values fall into exactly one price range.
- Clear all restores all six listings and blank/default controls.
- Returning from a listing preserves the visible search and filter selections.
- Compact and desktop layouts remain readable.

## Alternatives considered

- Quick-filter chips: visually compact, but ambiguous for ranges and selected values.
- Zillow-style filter drawer: powerful, but excessive for six hackathon fixtures.
- Native selects plus one checkbox: selected because the current value is always visible and the implementation remains small and accessible.
