import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createRentCastHttpError,
  requireRentCastApiKey,
  sanitizeRentCastListings,
} from "./rentcast-data.mjs";

const apiKey = requireRentCastApiKey();

const endpoint = new URL("https://api.rentcast.io/v1/listings/rental/long-term");
const query = {
  city: "Salt Lake City",
  state: "UT",
  status: "Active",
  limit: "20",
};

for (const [key, value] of Object.entries(query)) {
  endpoint.searchParams.set(key, value);
}

const response = await fetch(endpoint, {
  headers: {
    Accept: "application/json",
    "X-Api-Key": apiKey,
  },
});

if (!response.ok) {
  throw createRentCastHttpError(response.status);
}

const listings = sanitizeRentCastListings(await response.json());
const generatedAt = new Date().toISOString();
const snapshot = {
  source: {
    provider: "RentCast",
    endpoint: "https://api.rentcast.io/v1/listings/rental/long-term",
    documentation: "https://developers.rentcast.io/reference/rental-listings-long-term",
  },
  generatedAt,
  query: {
    city: query.city,
    state: query.state,
    status: query.status,
    limit: Number(query.limit),
  },
  listingCount: listings.length,
  limitations: [
    "Cached snapshot; not live market coverage.",
    "Listings may change or become unavailable after the retrieval time.",
    "Market comparisons are informational and are not appraisals or guarantees.",
  ],
  listings,
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "src", "data");
const outputPath = path.join(outputDirectory, "rentcast-slc.json");
const temporaryPath = `${outputPath}.${process.pid}.tmp`;

await mkdir(outputDirectory, { recursive: true });

try {
  await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, outputPath);
  console.log(`Saved ${listings.length} sanitized RentCast listings to ${outputPath}`);
} finally {
  await rm(temporaryPath, { force: true });
}
