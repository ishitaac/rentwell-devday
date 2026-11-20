import { describe, expect, it } from "vitest";

import {
  calculateRentComparison,
  describeComparisonMethod,
  describeRentDifference,
  type RentComparison,
  type RentListing,
  type RentSnapshot,
} from "./rentMarket";

const listing = (
  price: number,
  bedrooms: number | null,
  lastSeenDate = "2026-11-18T00:00:00.000Z",
): RentListing => ({
  city: "Salt Lake City",
  state: "UT",
  zipCode: "84101",
  propertyType: "Apartment",
  bedrooms,
  bathrooms: 1,
  squareFootage: 800,
  price,
  listedDate: "2026-11-01T00:00:00.000Z",
  lastSeenDate,
});

const snapshot = (listings: RentListing[]): RentSnapshot => ({
  source: {
    provider: "RentCast",
    endpoint: "https://api.rentcast.io/v1/listings/rental/long-term",
    documentation: "https://developers.rentcast.io/reference/rental-listings-long-term",
  },
  generatedAt: "2026-11-18T12:00:00.000Z",
  query: { city: "Salt Lake City", state: "UT", status: "Active", limit: 20 },
  listingCount: listings.length,
  limitations: ["Cached snapshot; not live market coverage."],
  listings,
});

describe("calculateRentComparison", () => {
  it("uses exact-bedroom listings when at least three are available", () => {
    const result = calculateRentComparison(
      snapshot([
        listing(1500, 2, "2026-11-14T00:00:00.000Z"),
        listing(1800, 2, "2026-11-16T00:00:00.000Z"),
        listing(2100, 2, "2026-11-18T00:00:00.000Z"),
        listing(3200, 3),
      ]),
      2,
    );

    expect(result).toEqual({
      count: 3,
      lower: 1500,
      median: 1800,
      upper: 2100,
      differenceScope: "exact-bedrooms",
      observedStart: "2026-11-14T00:00:00.000Z",
      observedEnd: "2026-11-18T00:00:00.000Z",
    });
  });

  it("averages the two middle prices for an even listing count", () => {
    const result = calculateRentComparison(
      snapshot([listing(2200, 1), listing(1400, 1), listing(1800, 1), listing(1600, 1)]),
      1,
    );

    expect(result).toMatchObject({ lower: 1400, median: 1700, upper: 2200 });
  });

  it("falls back to all valid listings when fewer than three match the bedroom count", () => {
    const result = calculateRentComparison(
      snapshot([listing(1600, 2), listing(1800, 2), listing(2000, 1), listing(2400, 3)]),
      2,
    );

    expect(result).toMatchObject({
      count: 4,
      lower: 1600,
      median: 1900,
      upper: 2400,
      differenceScope: "all-bedrooms-fallback",
    });
  });

  it("excludes listings with invalid prices", () => {
    const records = [
      listing(1500, 2),
      listing(1800, 2),
      listing(2100, 2),
      { ...listing(1900, 2), price: Number.NaN },
      { ...listing(1900, 2), price: 0 },
    ];

    expect(calculateRentComparison(snapshot(records), 2)).toMatchObject({
      count: 3,
      median: 1800,
    });
  });

  it("returns null for an empty snapshot", () => {
    expect(calculateRentComparison(snapshot([]), 2)).toBeNull();
  });
});

describe("describeRentDifference", () => {
  const comparison: RentComparison = {
    count: 3,
    lower: 1500,
    median: 1800,
    upper: 2100,
    differenceScope: "exact-bedrooms",
    observedStart: "2026-11-14T00:00:00.000Z",
    observedEnd: "2026-11-18T00:00:00.000Z",
  };

  it("describes an above-median asking rent", () => {
    expect(describeRentDifference(2100, comparison)).toEqual({
      percentage: 16.666666666666664,
      percentageLabel: "+16.7%",
      directionLabel: "above median",
      heading: "This rent is above the snapshot median.",
    });
  });

  it("describes a below-median asking rent", () => {
    expect(describeRentDifference(1600, comparison)).toEqual({
      percentage: -11.11111111111111,
      percentageLabel: "-11.1%",
      directionLabel: "below median",
      heading: "This rent is below the snapshot median.",
    });
  });

  it("describes an asking rent equal to the median", () => {
    expect(describeRentDifference(1800, comparison)).toEqual({
      percentage: 0,
      percentageLabel: "0.0%",
      directionLabel: "at median",
      heading: "This rent matches the snapshot median.",
    });
  });

  it("describes an unavailable comparison without numeric claims", () => {
    expect(describeRentDifference(1800, null)).toEqual({
      percentage: null,
      percentageLabel: "—",
      directionLabel: "comparison unavailable",
      heading: "Market comparison is unavailable.",
    });
  });

  it.each([0, -100, Number.NaN])(
    "does not compare an invalid asking rent of %s",
    (askingRent) => {
      expect(describeRentDifference(askingRent, comparison)).toEqual({
        percentage: null,
        percentageLabel: "—",
        directionLabel: "comparison unavailable",
        heading: "Market comparison is unavailable.",
      });
    },
  );
});

describe("describeComparisonMethod", () => {
  it("does not claim that a comparison was performed when no valid listings are available", () => {
    expect(describeComparisonMethod(null, 2)).toBe(
      "No valid listing prices were available in the dated RentCast snapshot, so no market comparison could be calculated.",
    );
  });
});
