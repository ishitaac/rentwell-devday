/**
 * Where the renter app lives. Set VITE_RENTER_URL on the manager project in
 * Vercel. Locally the renter dev server runs on port 5173.
 */
export function getRenterUrl(): string {
  return import.meta.env.VITE_RENTER_URL || (import.meta.env.DEV ? "http://localhost:5173" : "");
}
