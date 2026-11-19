import { describe, expect, it } from "vitest";

import { demoListingsDataset, getDemoListings } from "./demoListings";
import {
  buildListingDecisionReceipt,
  buildRentalDecisionReceipt,
} from "./listingDecision";
import {
  createDemoRentalDecision,
  createExternalRentalDecision,
} from "./rentalDecision";
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

    const receipt = buildRentalDecisionReceipt(
      createDemoRentalDecision(listing),
      emptySnapshot,
    );

    expect(receipt.comparison).toBeNull();
    expect(receipt.fairRentResult).toBe("Market comparison unavailable");
    expect(receipt.confidence).toBe("Unavailable");
    expect(receipt.explanation).toMatch(/no market comparison could be calculated/i);
  });
});

describe("buildRentalDecisionReceipt", () => {
  it("keeps the committed demo listing cost contract", () => {
    const decision = createDemoRentalDecision(
      getDemoListings(demoListingsDataset)[1],
    );

    const receipt = buildRentalDecisionReceipt(decision, snapshot);

    expect(receipt.advertisedRent).toBe(1299);
    expect(receipt.recurringFeeTotal).toBe(65);
    expect(receipt.trueMonthlyCost).toBe(1364);
    expect(receipt.estimatedMoveInCost).toBe(2064);
  });

  it("does not invent a security deposit for an external rental", () => {
    const decision = createExternalRentalDecision({
      label: "Campus apartment",
      neighborhood: "Central City",
      askingRent: 2100,
      bedrooms: 2,
      squareFootage: 940,
      mandatoryRecurringFeeTotal: 200,
      noMandatoryRecurringFees: false,
      moveInDate: "2027-01-05",
    });

    const receipt = buildRentalDecisionReceipt(decision, snapshot);

    expect(receipt.recurringFeeTotal).toBe(200);
    expect(receipt.trueMonthlyCost).toBe(2300);
    expect(receipt.estimatedMoveInCost).toBeNull();
    expect(receipt.missingInformation).toContain(
      "Security deposit has not been provided.",
    );
  });

  it("keeps an explicit external no-fee disclosure at advertised rent", () => {
    const decision = createExternalRentalDecision({
      label: "No-fee studio",
      neighborhood: "Downtown",
      askingRent: 1450,
      bedrooms: 0,
      squareFootage: null,
      mandatoryRecurringFeeTotal: 0,
      noMandatoryRecurringFees: true,
      moveInDate: "2027-01-10",
    });

    const receipt = buildRentalDecisionReceipt(decision, snapshot);

    expect(receipt.recurringFeeTotal).toBe(0);
    expect(receipt.trueMonthlyCost).toBe(1450);
  });
});
