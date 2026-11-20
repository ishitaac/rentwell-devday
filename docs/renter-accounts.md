# Renter accounts (Supabase)

Renters can create a real account, stay signed in, and keep their **My Plan** snapshot and their
**Walkthrough** records (photos, dates, notes, checks) in their account.

When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are **not** set, nothing changes: the app keeps
the browser-only demo accounts, and Walkthrough stays download-only. Tests run in that mode.

## What is stored where

| Thing | Where | Who can read it |
| --- | --- | --- |
| Email + password | Supabase Auth (`auth.users`), password hashed by Supabase | Nobody in RentWell; we never see or store the password |
| Display name | `public.renter_profiles` | The owner only (RLS) |
| Saved rental plan | `public.rental_plans` (one row per user, `plan` jsonb) | The owner only (RLS) |
| Saved walkthrough | ZIP in private Storage bucket `walkthroughs` at `<user_id>/<uuid>.zip`, plus a row in `public.walkthroughs` | The owner only (RLS + Storage policies) |

The browser uses only the public anon key. Every table has Row Level Security, so a signed-in user can
only read and write rows where `user_id = auth.uid()`, and only files inside their own folder.
The saved ZIP is the exact same format as **Save walkthrough (.zip)**, so it reopens with the existing
viewer and can still be downloaded.

## One-time setup (about 5 minutes)

1. **Create the tables, bucket and policies.** Supabase dashboard → **SQL Editor** → paste
   `supabase/migrations/20261120_renter_accounts.sql` → **Run**. Safe to re-run.
2. **Decide on email confirmation.** Authentication → Sign In / Providers → Email.
   - For DevDay, turning **Confirm email** off lets new accounts sign in immediately.
   - With it on, sign-up shows "Check your email for the confirmation link". Add your site URL
     (Authentication → URL Configuration → Site URL / Redirect URLs) so the link comes back to RentWell.
3. **Set the env vars** (both Vercel renter project and `.env.local`):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Redeploy.
4. **Optional quick login for presenting:** create a throwaway account (e.g. `demo@rentwell.demo`) in
   Authentication → Users → Add user, then set `VITE_DEMO_RENTER_EMAIL` and `VITE_DEMO_RENTER_PASSWORD`.
   These are **public** (baked into the page), so anyone can use that account. Never use a real password.

## Using it

- **Sign in** in the header (or **My Plan** when signed out) opens the sign-in page. The password field
  uses standard `autocomplete`, so the browser offers to remember it. The session persists across
  reloads until **Sign out**.
- **Save my plan** writes to `rental_plans`. Signing in later on any device reopens it.
- **Walkthrough → results → Save to my account** uploads the record. **Your saved walkthroughs** on the
  Walkthrough start page lists them, with **Open** and **Delete**. **Download (.zip)** still works.

## Not included yet

- The property-manager app still uses its demo gate (`src/manager/auth.ts`).
- Saving a plan keeps one plan per renter (the newest replaces the previous one).
- No password-reset screen yet; reset from the Supabase dashboard (Authentication → Users).

## Saving a walkthrough as a guest

On the results screen, **Save walkthrough** works whether or not the renter is signed in:

1. Guest taps **Save walkthrough** → sent to sign-in; the tour stays in memory.
2. After sign-in, the findings and questions are saved to My Plan and, for a Supabase account, the ZIP (photos, dates, notes) uploads to the private `walkthroughs` bucket automatically.
3. Already signed in: the same button saves to the account right away.

Without Supabase configured, the button reads **Save to my profile** and saves the findings and questions to the browser-only demo profile.
