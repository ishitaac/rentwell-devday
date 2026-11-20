import assert from "node:assert/strict";
import test from "node:test";

import {
  createRentCastHttpError,
  requireRentCastApiKey,
  sanitizeRentCastListings,
} from "./rentcast-data.mjs";

test("keeps only comparison fields from valid rental listings", () => {
  const records = [
    {
      id: "hidden-address-id",
      formattedAddress: "123 Main St, Salt Lake City, UT 84101",
      city: "Salt Lake City",
      state: "UT",
      zipCode: "84101",
      propertyType: "Apartment",
      bedrooms: 2,
      bathrooms: 1,
      squareFootage: 900,
      price: 1950,
      listedDate: "2026-11-01T00:00:00.000Z",
      lastSeenDate: "2026-11-18T00:00:00.000Z",
      listingAgent: { name: "Private Agent", phone: "555-0100" },
      listingOffice: { name: "Private Office", email: "office@example.com" },
      history: { "2026-11-01": { price: 1950 } },
      apiKey: "must-not-survive",
    },
  ];

  assert.deepEqual(sanitizeRentCastListings(records), [
    {
      city: "Salt Lake City",
      state: "UT",
      zipCode: "84101",
      propertyType: "Apartment",
      bedrooms: 2,
      bathrooms: 1,
      squareFootage: 900,
      price: 1950,
      listedDate: "2026-11-01T00:00:00.000Z",
      lastSeenDate: "2026-11-18T00:00:00.000Z",
    },
  ]);
});

test("drops records with unusable prices", () => {
  const record = (price) => ({
    city: "Salt Lake City",
    state: "UT",
    zipCode: "84101",
    propertyType: "Apartment",
    bedrooms: 1,
    bathrooms: 1,
    squareFootage: 600,
    price,
    listedDate: "2026-11-01T00:00:00.000Z",
    lastSeenDate: "2026-11-18T00:00:00.000Z",
  });

  assert.deepEqual(
    sanitizeRentCastListings([
      record(undefined),
      record("1900"),
      record(0),
      record(-50),
      record(1850),
    ]),
    [record(1850)],
  );
});

test("rejects a non-array API response", () => {
  assert.throws(
    () => sanitizeRentCastListings({ error: "unexpected response" }),
    /RentCast response must be an array/,
  );
});

test("rejects a missing API key with setup guidance", () => {
  assert.throws(
    () => requireRentCastApiKey({ RENTCAST_API_KEY: "  " }),
    /Copy \.env\.example to \.env\.local/,
  );
});

test("does not include an upstream response body in request errors", () => {
  const reflectedSecret = "rentcast-secret-that-must-not-be-logged";
  const error = createRentCastHttpError(401, reflectedSecret);

  assert.match(error.message, /401/);
  assert.doesNotMatch(error.message, new RegExp(reflectedSecret));
});
