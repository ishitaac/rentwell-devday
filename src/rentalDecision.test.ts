import { describe, expect, it } from "vitest";

import { demoListingsDataset, getDemoListings } from "./demoListings";
import {
  createDemoRentalDecision,
  createExternalRentalDecision,
  type ExternalRentalEntry,
} from "./rentalDecision";

describe("rental decision adapters", () => {
  it("preserves demo listing facts without sharing mutable arrays", () => {
    const listing = getDemoListings(demoListingsDataset)[1];

    const decision = createDemoRentalDecision(listing);

    expect(decision).toMatchObject({
      decisionId: listing.synthetic.listingId,
      source: "synthetic-demo-listing",
      title: listing.synthetic.title,
      neighborhood: listing.synthetic.neighborhood,
      askingRent: listing.synthetic.askingRent,
      bedrooms: listing.synthetic.bedrooms,
      squareFootage: listing.synthetic.squareFootage,
      recurringFees: listing.synthetic.mandatoryRecurringFees,
      securityDeposit: listing.synthetic.securityDeposit,
      images: listing.synthetic.images,
      amenities: listing.synthetic.amenities,
      capabilities: { canCompare: true, canRequestTour: true },
    });

    decision.recurringFees[0].amount = 999;
    decision.images.push("/mutated.jpg");

    expect(listing.synthetic.mandatoryRecurringFees[0].amount).toBe(45);
    expect(listing.synthetic.images).not.toContain("/mutated.jpg");
  });

  it("creates an honest external-rental record from disclosed fields", () => {
    const entry: ExternalRentalEntry = {
      label: "  Student apartment near campus  ",
      neighborhood: "  Central City  ",
      askingRent: 2100,
      bedrooms: 2,
      squareFootage: 940,
      mandatoryRecurringFeeTotal: 200,
      noMandatoryRecurringFees: false,
      moveInDate: "2027-01-05",
    };

    const decision = createExternalRentalDecision(entry);

    expect(decision).toMatchObject({
      source: "user-entered-demo-analysis",
      title: "Student apartment near campus",
      neighborhood: "Central City",
      askingRent: 2100,
      bedrooms: 2,
      squareFootage: 940,
      recurringFees: [
        { id: "mandatory-recurring-fees", label: "Mandatory recurring fees", amount: 200 },
      ],
      noMandatoryRecurringFees: false,
      securityDeposit: null,
      images: [],
      amenities: [],
      capabilities: { canCompare: false, canRequestTour: false },
    });
    expect(createExternalRentalDecision(entry).decisionId).toBe(decision.decisionId);
  });
});
