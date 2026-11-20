import type { DemoListing } from "./demoListings";

/**
 * Loads listings from Supabase (public, read-only anon key) over its REST API.
 * Returns null when Supabase is not configured or unreachable, so callers keep the
 * bundled demo-listings.json. No SDK is needed and no secret is used in the browser.
 */
type Row = Pick<DemoListing, "market" | "synthetic" | "provenance"> & { listing_id: string };

export async function fetchRemoteListings(signal?: AbortSignal): Promise<DemoListing[] | null> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/listings?select=listing_id,market,synthetic,provenance&order=listing_id`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Row[];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows.map(({ market, synthetic, provenance }) => ({ market, synthetic, provenance }));
  } catch {
    return null;
  }
}
