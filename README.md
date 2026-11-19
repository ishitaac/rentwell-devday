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

- The rental comparison data is fictional demo data, not live market data.
- AI rental advisor responses are simulated.
- The project runs as a standalone Vite application and does not require Figma Make files or plugins.
