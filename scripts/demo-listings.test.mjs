import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { generateDemoListingsFile } from "./build-demo-listings.mjs";
import { buildDemoListings, createSourceKey } from "./demo-listings.mjs";

const sourceListing = (overrides = {}) => ({
  city: "Salt Lake City",
  state: "UT",
  zipCode: "84102",
  propertyType: "Apartment",
  bedrooms: 1,
  bathrooms: 1,
  squareFootage: 550,
  price: 1299,
  listedDate: "2026-11-17T00:00:00.000Z",
  lastSeenDate: "2026-11-18T03:01:55.205Z",
  ...overrides,
});

const enrichmentListing = (source, overrides = {}) => ({
  sourceKey: createSourceKey(source),
  listingId: "demo-slc-001",
  managerId: "demo-manager-001",
  title: "Avenues Garden Apartment",
  neighborhood: "The Avenues",
  description: "A bright fictional apartment prepared for the RentWell competition demo.",
  mandatoryRecurringFees: [{ id: "technology", label: "Technology fee", amount: 45 }],
  noMandatoryRecurringFees: false,
  feeDisclosureState: "complete",
  securityDeposit: 700,
  availableDate: "2026-12-01",
  images: ["/listings/interior-blue.jpg"],
  amenities: ["In-unit laundry", "Bike storage"],
  createdAt: "2026-11-18T18:00:00.000Z",
  updatedAt: "2026-11-18T18:00:00.000Z",
  ...overrides,
});

const snapshot = (listings) => ({
  source: { provider: "RentCast", endpoint: "https://api.rentcast.io/v1/listings/rental/long-term" },
  generatedAt: "2026-11-18T23:05:30.917Z",
  query: { city: "Salt Lake City", state: "UT", status: "Active", limit: 20 },
  listingCount: listings.length,
  limitations: ["Cached snapshot; not live market coverage."],
  listings,
});

const enrichment = (listings) => ({ version: 1, listings });

test("creates the same source key when only snapshot dates change", () => {
  const listing = sourceListing();
  const changedDates = sourceListing({
    listedDate: "2026-12-01T00:00:00.000Z",
    lastSeenDate: "2026-12-02T00:00:00.000Z",
  });

  assert.equal(createSourceKey(listing), createSourceKey(changedDates));
});

test("matches enrichment after source records are reordered", () => {
  const first = sourceListing();
  const second = sourceListing({ zipCode: "84111", bedrooms: 2, squareFootage: 900, price: 1595 });
  const records = buildDemoListings(
    snapshot([second, first]),
    enrichment([
      enrichmentListing(first),
      enrichmentListing(second, { listingId: "demo-slc-002", title: "Central City Two Bedroom" }),
    ]),
  ).listings;

  assert.deepEqual(
    records.map((record) => [record.synthetic.listingId, record.market.price]),
    [
      ["demo-slc-002", 1595],
      ["demo-slc-001", 1299],
    ],
  );
});

test("keeps RentCast market fields separate from synthetic presentation fields", () => {
  const source = sourceListing();
  const record = buildDemoListings(snapshot([source]), enrichment([enrichmentListing(source)])).listings[0];

  assert.equal(record.market.price, 1299);
  assert.equal(record.market.zipCode, "84102");
  assert.equal(record.synthetic.title, "Avenues Garden Apartment");
  assert.equal(record.provenance.market, "RentCast sanitized snapshot");
  assert.equal(record.provenance.synthetic, "RentWell synthetic demo fixture");
  assert.equal("title" in record.market, false);
  assert.equal("price" in record.synthetic, false);
});

test("calculates true monthly cost from complete mandatory fees", () => {
  const source = sourceListing();
  const record = buildDemoListings(
    snapshot([source]),
    enrichment([
      enrichmentListing(source, {
        mandatoryRecurringFees: [
          { id: "technology", label: "Technology fee", amount: 45 },
          { id: "parking", label: "Required parking", amount: 80 },
        ],
      }),
    ]),
  ).listings[0];

  assert.equal(record.synthetic.mandatoryRecurringFeeTotal, 125);
  assert.equal(record.synthetic.trueMonthlyCost, 1424);
});

test("distinguishes explicit no-fee listings from missing fee data", () => {
  const source = sourceListing();
  const noFee = enrichmentListing(source, {
    mandatoryRecurringFees: [],
    noMandatoryRecurringFees: true,
  });

  const record = buildDemoListings(snapshot([source]), enrichment([noFee])).listings[0];
  assert.equal(record.synthetic.noMandatoryRecurringFees, true);
  assert.equal(record.synthetic.trueMonthlyCost, 1299);

  assert.throws(
    () =>
      buildDemoListings(
        snapshot([source]),
        enrichment([enrichmentListing(source, { mandatoryRecurringFees: [] })]),
      ),
    /explicitly state whether it has no mandatory recurring fees/,
  );
});

test("rejects unmatched, duplicate, or incomplete enrichment records", async (t) => {
  const source = sourceListing();

  await t.test("unmatched source key", () => {
    assert.throws(
      () =>
        buildDemoListings(
          snapshot([source]),
          enrichment([enrichmentListing(source, { sourceKey: "does-not-match" })]),
        ),
      /source coverage/,
    );
  });

  await t.test("duplicate source key", () => {
    assert.throws(
      () =>
        buildDemoListings(
          snapshot([source]),
          enrichment([
            enrichmentListing(source),
            enrichmentListing(source, { listingId: "demo-slc-002" }),
          ]),
        ),
      /duplicate source key/,
    );
  });

  await t.test("incomplete presentation fields", () => {
    assert.throws(
      () =>
        buildDemoListings(
          snapshot([source]),
          enrichment([enrichmentListing(source, { title: "" })]),
        ),
      /title/,
    );
  });
});

test("does not replace an existing output when fixture validation fails", async () => {
  const projectRoot = await mkdtemp(path.join(tmpdir(), "rentwell-demo-"));
  const snapshotPath = path.join(projectRoot, "snapshot.json");
  const enrichmentPath = path.join(projectRoot, "enrichment.json");
  const outputPath = path.join(projectRoot, "demo-listings.json");
  const originalOutput = "{\"stable\":true}\n";

  await writeFile(snapshotPath, JSON.stringify(snapshot([sourceListing()])), "utf8");
  await writeFile(enrichmentPath, JSON.stringify(enrichment([])), "utf8");
  await writeFile(outputPath, originalOutput, "utf8");

  await assert.rejects(
    generateDemoListingsFile({ snapshotPath, enrichmentPath, outputPath, projectRoot }),
    /source coverage/,
  );
  assert.equal(await readFile(outputPath, "utf8"), originalOutput);
});
