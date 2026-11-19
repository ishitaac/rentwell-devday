import assert from "node:assert/strict";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
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

test("rejects incomplete locations and invalid calendar dates", async (t) => {
  const source = sourceListing();

  await t.test("missing source city", () => {
    assert.throws(
      () =>
        buildDemoListings(
          snapshot([{ ...source, city: null }]),
          enrichment([enrichmentListing(source)]),
        ),
      /city/,
    );
  });

  await t.test("impossible availability date", () => {
    assert.throws(
      () =>
        buildDemoListings(
          snapshot([source]),
          enrichment([enrichmentListing(source, { availableDate: "2026-02-31" })]),
        ),
      /availableDate/,
    );
  });

  await t.test("malformed timestamps", () => {
    assert.throws(
      () =>
        buildDemoListings(
          snapshot([source]),
          enrichment([enrichmentListing(source, { createdAt: "not-a-timestamp" })]),
        ),
      /createdAt/,
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

async function loadCommittedFixtures() {
  const [snapshotText, enrichmentText] = await Promise.all([
    readFile(path.join(process.cwd(), "src/data/rentcast-slc.json"), "utf8"),
    readFile(path.join(process.cwd(), "src/data/demo-listing-enrichment.json"), "utf8"),
  ]);
  const source = JSON.parse(snapshotText);
  const fixture = JSON.parse(enrichmentText);
  return { source, fixture, dataset: buildDemoListings(source, fixture) };
}

test("builds exactly 20 complete demo listings from committed fixtures", async () => {
  const { source, fixture, dataset } = await loadCommittedFixtures();

  assert.equal(source.listings.length, 20);
  assert.equal(fixture.listings.length, 20);
  assert.equal(dataset.listingCount, 20);
  assert.equal(dataset.listings.length, 20);
  assert.equal(dataset.listings.every((listing) => listing.synthetic.inventorySource === "synthetic"), true);
});

test("uses every committed source key exactly once", async () => {
  const { source, fixture } = await loadCommittedFixtures();
  const sourceKeys = source.listings.map(createSourceKey);
  const fixtureKeys = fixture.listings.map((listing) => listing.sourceKey);

  assert.equal(new Set(sourceKeys).size, 20);
  assert.equal(new Set(fixtureKeys).size, 20);
  assert.deepEqual(new Set(fixtureKeys), new Set(sourceKeys));
});

test("covers studios through four bedrooms and all source property types", async () => {
  const { dataset } = await loadCommittedFixtures();
  const bedrooms = new Set(dataset.listings.map((listing) => listing.market.bedrooms));
  const propertyTypes = new Set(dataset.listings.map((listing) => listing.market.propertyType));

  assert.deepEqual([...bedrooms].sort(), [0, 1, 2, 3, 4]);
  assert.deepEqual([...propertyTypes].sort(), ["Apartment", "Condo", "Single Family", "Townhouse"]);
});

test("has complete presentation fees images and availability on every fixture record", async () => {
  const { dataset } = await loadCommittedFixtures();

  for (const { synthetic } of dataset.listings) {
    assert.match(synthetic.listingId, /^demo-slc-\d{3}$/);
    assert.ok(synthetic.title.length > 0);
    assert.ok(synthetic.neighborhood.length > 0);
    assert.ok(synthetic.description.length > 0);
    assert.equal(synthetic.feeDisclosureState, "complete");
    assert.ok(Number.isFinite(synthetic.trueMonthlyCost));
    assert.match(synthetic.availableDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(synthetic.images.length > 0);
    assert.ok(synthetic.amenities.length > 0);
    assert.ok(synthetic.askingRent > 0);
    assert.ok(synthetic.propertyType.length > 0);
    assert.ok(synthetic.bedrooms >= 0);
    assert.ok(synthetic.bathrooms > 0);
  }
});

test("includes at least two listings that explicitly have no mandatory recurring fees", async () => {
  const { dataset } = await loadCommittedFixtures();
  const noFeeListings = dataset.listings.filter(
    (listing) => listing.synthetic.noMandatoryRecurringFees === true,
  );

  assert.ok(noFeeListings.length >= 2);
  assert.equal(
    noFeeListings.every(
      (listing) =>
        listing.synthetic.mandatoryRecurringFees.length === 0 &&
        listing.synthetic.trueMonthlyCost === listing.market.price,
    ),
    true,
  );
});

test("references only committed local listing JPGs", async () => {
  const { dataset } = await loadCommittedFixtures();
  const imagePaths = new Set(dataset.listings.flatMap((listing) => listing.synthetic.images));

  assert.equal(imagePaths.size, 4);
  for (const imagePath of imagePaths) {
    assert.match(imagePath, /^\/listings\/[a-z-]+\.jpg$/);
    await access(path.join(process.cwd(), "public", imagePath.slice(1)));
  }
});

test("contains no address contact credential agent or office fields", async () => {
  const { fixture } = await loadCommittedFixtures();
  const forbiddenKeys = new Set([
    "address",
    "formattedAddress",
    "streetAddress",
    "unit",
    "personName",
    "email",
    "phone",
    "apiKey",
    "agent",
    "listingAgent",
    "office",
    "listingOffice",
  ]);
  const found = [];
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) found.push(key);
      visit(child);
    }
  };
  visit(fixture);

  assert.deepEqual(found, []);
});

test("labels market and synthetic provenance separately in every generated record", async () => {
  const { dataset } = await loadCommittedFixtures();

  assert.equal(
    dataset.listings.every(
      (listing) =>
        listing.provenance.market === "RentCast sanitized snapshot" &&
        listing.provenance.synthetic === "RentWell synthetic demo fixture",
    ),
    true,
  );
});
