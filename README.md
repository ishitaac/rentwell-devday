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

## Production build

Create and preview a production build:

```bash
pnpm build
pnpm preview
```

The compiled site is written to `dist/`.

## Project notes

- Fair-rent comparisons use a dated, cached snapshot of active Salt Lake City rentals retrieved from the [RentCast API](https://developers.rentcast.io/reference/rental-listings-long-term). They are not live market coverage, appraisals, or guarantees.
- Listing-link extraction remains simulated; users can edit the extracted fields.
- AI rental advisor responses are simulated.
- The project runs as a standalone Vite application and does not require Figma Make files or plugins.

## Refresh the RentCast snapshot

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
