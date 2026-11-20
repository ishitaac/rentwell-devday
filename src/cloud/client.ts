import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for renter accounts. Uses only the public anon key; every table is protected
 * by Row Level Security (see supabase/migrations). When the two VITE_ values are missing the
 * app keeps the browser-only demo accounts, so local dev and tests need no backend.
 */

export function isCloudAccountsEnabled(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

let clientPromise: Promise<SupabaseClient> | null = null;

/** Lazily loads the SDK so the renter bundle only carries it when accounts are configured. */
export function getCloudClient(): Promise<SupabaseClient> {
  if (!isCloudAccountsEnabled()) {
    return Promise.reject(new Error("Supabase accounts are not configured."));
  }
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "rentwell.auth",
      },
    }),
  );
  return clientPromise;
}

/** Optional one-click presenter login. Both values are public (baked into the page). */
export function getQuickDemoCredentials(): { email: string; password: string } | null {
  const email = import.meta.env.VITE_DEMO_RENTER_EMAIL;
  const password = import.meta.env.VITE_DEMO_RENTER_PASSWORD;
  return email && password ? { email, password } : null;
}
