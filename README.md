# RentWell

RentWell is a React and Vite prototype for exploring rental affordability and roommate decisions. It includes a fair-rent comparison, roommate cost planning, preference-based roommate matching, and **Fine Print**, a lease reader that finds every charge, shows the real monthly cost, and lists what the lease doesn't say.

## Requirements

- Node.js 20.19 or newer
- pnpm 11 or newer

## Run locally

Install the locked dependencies:

```bash
pnpm install --frozen-lockfile
```

For live lease analysis, create `.env.local` (gitignored) from `.env.example` and set `ANTHROPIC_API_KEY`. It is read only by the server functions in `api/`; never give it a `VITE_` prefix. Without a key, the sample lease still works from its saved analysis.

Start the development server (it also serves the `/api` functions locally):

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
- Fine Print uses Claude (`claude-sonnet-5-5` for extraction and answers, `claude-haiku-5-5` for routing; override with `FINE_PRINT_MODEL` / `FINE_PRINT_ROUTER_MODEL`). All money math is in `src/finePrint/lib/costs.ts`, and every quote is verified against the lease in code (`verify.ts`). AI-generated, not legal advice.
- The sample lease in `fixtures/` and its answer key in `eval/` are fictional.
- The project runs as a standalone Vite application and does not require Figma Make files or plugins.

## Checks

```bash
pnpm check        # typecheck + unit tests + build + bundle secret check
pnpm test:e2e     # Playwright demo path on the production build, /api blocked (1280 and 375 px)
pnpm eval         # live: scores /api/analyze against eval/answer-key.md (needs ANTHROPIC_API_KEY)
pnpm cache:sample # live: refreshes the saved sample analysis used by the offline demo
```

## Deploying on Vercel

Set `ANTHROPIC_API_KEY` in the Vercel project's environment variables (Preview and Production). The `api/*.ts` files deploy as Vercel Functions automatically.
