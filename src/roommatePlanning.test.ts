import { describe, expect, it } from "vitest";

import {
  demoListingsDataset,
  getDemoListings,
  updateDemoListing,
} from "./demoListings";
import {
  createDemoRentalDecision,
  createExternalRentalDecision,
} from "./rentalDecision";
import {
  createRentalFirstRoommateContext,
  createRoommateFirstContext,
} from "./roommatePlanning";

describe("roommate planning context", () => {
  it("copies the active rental decision and derives the true monthly cost", () => {
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

    expect(createRentalFirstRoommateContext(decision)).toEqual({
      entryPerspective: "rental-first",
      rental: {
        decisionId: decision.decisionId,
        title: "Campus apartment",
        neighborhood: "Central City",
        advertisedRent: 2100,
        recurringFeeTotal: 200,
        trueMonthlyCost: 2300,
        bedrooms: 2,
      },
    });
  });

  it("creates a roommate-first context without a sample apartment", () => {
    expect(createRoommateFirstContext()).toEqual({
      entryPerspective: "roommate-first",
      rental: null,
    });
  });

  it("uses manager-edited rent and fees instead of the original fixture totals", () => {
    const listings = getDemoListings(demoListingsDataset);
    const source = listings[1];
    const edited = updateDemoListing(listings, source.synthetic.listingId, {
      askingRent: 1500,
      mandatoryRecurringFees: [
        { id: "technology", label: "Technology fee", amount: 50 },
        { id: "trash", label: "Trash service", amount: 25 },
      ],
      updatedAt: "2026-11-19T08:00:00.000Z",
    })[1];

    const context = createRentalFirstRoommateContext(
      createDemoRentalDecision(edited),
    );

    expect(context.rental).toMatchObject({
      advertisedRent: 1500,
      recurringFeeTotal: 75,
      trueMonthlyCost: 1575,
    });
    expect(source.synthetic.askingRent).toBe(1299);
  });
});
