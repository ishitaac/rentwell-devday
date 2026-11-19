import { describe, expect, it } from "vitest";

import { demoListingsDataset, getDemoListings } from "./demoListings";
import { buildListingDecisionReceipt } from "./listingDecision";
import type { RentSnapshot } from "./rentMarket";

const snapshot: RentSnapshot = {
  source: {
    provider: "RentCast",
    endpoint: "/v1/listings/rental/long-term",
    documentation: "https://developers.rentcast.io/",
  },
  generatedAt: "2026-11-18T03:01:55.206Z",
  query: { city: "Salt Lake City", state: "UT", status: "Active", limit: 20 },
  listingCount: 6,
  limitations: ["Dated snapshot"],
  listings: [1200, 1275, 1325, 1375, 1425, 1500].map((price, index) => ({
    city: "Salt Lake City",
    state: "UT",
    zipCode: "84102",
    propertyType: "Apartment",
    bedrooms: 1,
    bathrooms: 1,
    squareFootage: 550 + index * 10,
    price,
    listedDate: "2026-11-17T00:00:00.000Z",
    lastSeenDate: `2026-11-18T03:01:5${index}.000Z`,
  })),
};

describe("buildListingDecisionReceipt", () => {
  it("derives monthly and move-in costs from the committed listing facts", () => {
    const listing = getDemoListings(demoListingsDataset)[1];

    const receipt = buildListingDecisionReceipt(listing, snapshot);

    expect(receipt.advertisedRent).toBe(1299);
    expect(receipt.recurringFeeTotal).toBe(65);
    expect(receipt.trueMonthlyCost).toBe(1364);
    expect(receipt.estimatedMoveInCost).toBe(2064);
  });

  it("explains a rent inside the dated comparable range without a black-box score", () => {
    const listing = getDemoListings(demoListingsDataset)[1];

    const receipt = buildListingDecisionReceipt(listing, snapshot);

    expect(receipt.comparison).toMatchObject({
      count: 6,
      lower: 1275,
      median: 1350,
      upper: 1425,
    });
    expect(receipt.fairRentResult).toBe("Within the expected snapshot range");
    expect(receipt.confidence).toBe("Medium");
    expect(receipt.sourceLabel).toBe("Dated RentCast snapshot");
  });

  it("keeps an explicit no-fee listing at its advertised rent", () => {
    const listing = getDemoListings(demoListingsDataset).find(
      (candidate) => candidate.synthetic.noMandatoryRecurringFees,
    );
    expect(listing).toBeDefined();

    const receipt = buildListingDecisionReceipt(listing!, snapshot);

    expect(receipt.recurringFeeTotal).toBe(0);
    expect(receipt.trueMonthlyCost).toBe(receipt.advertisedRent);
  });

  it("reports unavailable comparison evidence instead of inventing a range", () => {
    const listing = getDemoListings(demoListingsDataset)[1];
    const emptySnapshot: RentSnapshot = { ...snapshot, listingCount: 0, listings: [] };

    const receipt = buildListingDecisionReceipt(listing, emptySnapshot);

    expect(receipt.comparison).toBeNull();
    expect(receipt.fairRentResult).toBe("Market comparison unavailable");
    expect(receipt.confidence).toBe("Unavailable");
    expect(receipt.explanation).toMatch(/no market comparison could be calculated/i);
  });
});
