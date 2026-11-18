# RentCast Snapshot Design

## Intent

Replace RentWell's fictional fair-rent comparison with a reviewable, dated snapshot of active Salt Lake City rental listings retrieved through the authorized RentCast API.

## Goals

- Retrieve up to 20 active long-term rental listings for Salt Lake City, Utah.
- Keep the RentCast API key local and out of Git and browser code.
- Commit only fields needed for rent comparison; exclude agent, office, owner, and contact details.
- Calculate bedroom-matched listing count, median, lower range, upper range, and observation dates from the cached snapshot.
- Label the experience as a dated RentCast snapshot rather than live market coverage.
- Leave `feature/figma-make-rentwell` and PR #1 unchanged.
- Create `feature/rentcast-data` from the verified Figma branch so development can continue before PR #1 merges.
- After PR #1 merges, update the RentCast branch against `main` and open a separate PR for colleague review.

## Non-goals

- Live client-side RentCast requests.
- A production backend or scheduled refresh service.
- Listing-link extraction, appraisal, or guaranteed market coverage.
- Changes to the fictional roommate profiles or simulated AI advisor.

## Constraints

- Never commit or expose the RentCast API key.
- Use RentCast's `GET /v1/listings/rental/long-term` endpoint with `city=Salt Lake City`, `state=UT`, `status=Active`, and `limit=20`.
- Use one API request for the initial snapshot and cache its sanitized result.
- Preserve explicit source, retrieval date, query, and limitation metadata.
- If fewer than three listings match the requested bedroom count, use all valid snapshot listings and disclose that fallback.
- Keep RentCast commits and review history separate from PR #1.

## Approaches

### Selected: one-time sanitized snapshot

A local Node script reads `RENTCAST_API_KEY` from an ignored `.env.local` file, requests the listings once, strips unnecessary fields, and writes a versioned JSON snapshot used by the React app. This protects the secret, controls free-tier usage, and makes the PR reproducible and reviewable.

### Rejected: direct browser API requests

This would expose the API key in public frontend code and consume requests whenever users open the app.

### Deferred: live backend proxy

A backend would protect the key and support fresh data, but it adds hosting, authentication, caching, monitoring, and cost-control work beyond the static hackathon prototype.

## Verification

- Unit tests cover sanitization, invalid records, bedroom matching, fallback behavior, and range calculations.
- The data-fetch command fails clearly when the key is missing or the API response is invalid.
- TypeScript checking and the production Vite build pass.
- The committed snapshot contains no API key or listing contact fields.
