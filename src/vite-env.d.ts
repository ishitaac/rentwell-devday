/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Address of the separate property-manager app (set on the renter project). */
  readonly VITE_MANAGER_URL?: string;
  /** Address of the renter app (set on the manager project, for the "Back to RentWell" link). */
  readonly VITE_RENTER_URL?: string;
  /** Supabase project URL and public anon key (read-only listings). Safe to expose; never the service key. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Optional one-click presenter login for a throwaway demo renter account. Public values. */
  readonly VITE_DEMO_RENTER_EMAIL?: string;
  readonly VITE_DEMO_RENTER_PASSWORD?: string;
}
