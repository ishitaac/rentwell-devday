# RentWell

RentWell is a React and Vite prototype for exploring rental affordability and roommate decisions. It includes a fair-rent comparison, roommate cost planning, preference-based roommate matching, and a simulated AI rental advisor.

## Requirements

- Node.js 20.19 or newer
- pnpm 11 or newer

## Run locally

Install the locked dependencies:

```bash
pnpm install --frozen-lockfile
```

Start the development server:

```bash
pnpm dev
```

Open the local URL printed by Vite.

No RentCast key or `.env.local` file is needed for the competition demo. The repository includes the cached market snapshot, 20 enriched synthetic demo listings, and four local illustrative images, so every teammate sees the same data.

## Production build

Create and preview a production build:

```bash
pnpm build
pnpm preview
```

The compiled site is written to `dist/`.

## Project notes

- Fair-rent comparisons use a dated, cached snapshot of active Salt Lake City rentals retrieved from the [RentCast API](https://developers.rentcast.io/reference/rental-listings-long-term). They are not live market coverage, appraisals, or guarantees.
- The planned renter and property-manager screens will use 20 synthetic **Demo listings** generated from the cached snapshot. They are not active properties available to rent.
- Listing-link extraction remains simulated; users can edit the extracted fields.
- AI rental advisor responses are simulated.
- The project runs as a standalone Vite application and does not require Figma Make files or plugins.

## Demo listing data

The demo keeps source facts and fictional presentation content separate:

- `src/data/rentcast-slc.json` contains the sanitized RentCast market fields: city, state, zip code, property type, bedrooms, bathrooms, optional square footage, price, and snapshot dates.
- `src/data/demo-listing-enrichment.json` contains synthetic renter-facing content: fictional IDs, titles, neighborhoods, descriptions, recurring fees, deposits, availability, amenities, and local image references.
- `src/data/demo-listings.json` is the generated dataset prepared for the planned listing screens. Each record contains separate `market`, `synthetic`, and `provenance` sections; `src/demoListings.ts` provides the typed selector and edit helper.
- `public/listings/ASSETS.md` records image creators, source pages, and license information. The images are illustrative and are not photographs of the listed properties.

Rebuild the committed demo dataset for free, without making a RentCast request:

```bash
pnpm data:demo
```

The generator matches every enrichment record to a stable combination of market fields, validates the full fixture and local images, and replaces the generated file only after every check succeeds.

## Optional: refresh the RentCast snapshot

This refresh is not required for the competition demo. It makes a RentCast API request and may use paid quota depending on the account plan.

The committed snapshot contains only the fields needed for market comparison. It excludes listing agents, offices, owners, contact details, and the API key.

1. Copy the secret template:

   ```bash
   cp .env.example .env.local
   ```

2. Add your RentCast key to `.env.local`:

   ```text
   RENTCAST_API_KEY=your_key_here
   ```

3. Retrieve up to 20 active Salt Lake City rentals:

   ```bash
   pnpm data:rentcast
   ```

The command makes one API request and replaces `src/data/rentcast-slc.json` only after receiving and sanitizing a valid response. RentCast keys are secrets: never commit `.env.local`, place a key in frontend code, or paste it into a pull request.

A refreshed snapshot may contain a different set or order of records. After refreshing, update `src/data/demo-listing-enrichment.json` so each source key still matches exactly once, then run `pnpm data:demo` and `pnpm test:data`. A mismatch fails without replacing the last valid generated dataset.
