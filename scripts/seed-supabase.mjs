// Loads src/data/demo-listings.json into Supabase. Run on your computer:
//   pnpm data:seed
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (gitignored, never VITE_).
import { readFile } from "node:fs/promises";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const dataset = JSON.parse(await readFile(new URL("../src/data/demo-listings.json", import.meta.url), "utf8"));
const rows = dataset.listings.map((l) => ({
  listing_id: l.synthetic.listingId,
  manager_id: l.synthetic.managerId,
  market: l.market,
  synthetic: l.synthetic,
  provenance: l.provenance,
  updated_at: new Date().toISOString(),
}));
const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/listings?on_conflict=listing_id`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal",
  },
  body: JSON.stringify(rows),
});
if (!res.ok) {
  console.error(`Seed failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log(`Seeded ${rows.length} listings.`);
