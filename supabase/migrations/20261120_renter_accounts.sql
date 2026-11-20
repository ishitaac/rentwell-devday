-- RentWell renter accounts: saved rental plans + saved walkthroughs.
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Sign-in itself uses Supabase Auth (auth.users). Passwords live there, hashed by Supabase;
-- none of the tables below ever store a password.

-- 1. Profile (display name), one row per auth user -----------------------------------------
create table if not exists public.renter_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2. Saved rental plan, one per user (the "My Plan" snapshot) -------------------------------
create table if not exists public.rental_plans (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  plan       jsonb not null,
  saved_at   timestamptz not null default now()
);

-- 3. Saved walkthroughs: metadata row + ZIP in the private "walkthroughs" Storage bucket ------
create table if not exists public.walkthroughs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text not null unique,
  rental_name  text check (char_length(rental_name) <= 120),
  unit_type    text not null check (unit_type in ('apartment', 'townhome', 'single_family')),
  photo_count  int  not null default 0 check (photo_count between 0 and 100),
  byte_size    int  not null check (byte_size > 0 and byte_size <= 41943040),
  is_sample    boolean not null default false,
  recorded_at  timestamptz not null,
  created_at   timestamptz not null default now(),
  -- The file must sit in the owner's own folder: <user_id>/<file>.zip
  constraint walkthroughs_path_owner check (storage_path like user_id::text || '/%')
);
create index if not exists walkthroughs_user_created_idx
  on public.walkthroughs (user_id, created_at desc);

-- Row Level Security: each signed-in user sees and changes only their own rows ---------------
alter table public.renter_profiles enable row level security;
alter table public.rental_plans    enable row level security;
alter table public.walkthroughs    enable row level security;

drop policy if exists "own profile" on public.renter_profiles;
create policy "own profile" on public.renter_profiles
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own plan" on public.rental_plans;
create policy "own plan" on public.rental_plans
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own walkthroughs" on public.walkthroughs;
create policy "own walkthroughs" on public.walkthroughs
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Storage: private bucket, ZIPs only, 40 MB cap (matches the app's record limit) -------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('walkthroughs', 'walkthroughs', false, 41943040, array['application/zip'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Files live at walkthroughs/<user_id>/<uuid>.zip; only the owner can read, add or delete.
drop policy if exists "walkthroughs: owner read" on storage.objects;
create policy "walkthroughs: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'walkthroughs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "walkthroughs: owner insert" on storage.objects;
create policy "walkthroughs: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'walkthroughs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "walkthroughs: owner delete" on storage.objects;
create policy "walkthroughs: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'walkthroughs' and (storage.foldername(name))[1] = auth.uid()::text);
