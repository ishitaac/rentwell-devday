# Supabase listings

Listings are read from Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set; otherwise (or if Supabase is unreachable or the table is empty) the apps use the bundled `src/data/demo-listings.json`. The data is still synthetic demo inventory built on a sanitized RentCast snapshot.

- Table `public.listings` keeps `market`, `synthetic` and `provenance` as separate jsonb columns. A check constraint rejects an empty fee list unless `noMandatoryRecurringFees` is true.
- Row Level Security: anyone can read; nobody can write with the public key.
- Seed (run on your computer): put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, then `pnpm data:seed`. Re-run after `pnpm data:demo`.
- Manager edits are still local demo state. Writing them back to Supabase needs a server route with real authentication, which is not built yet.
- Never put the service key in a `VITE_` variable.
