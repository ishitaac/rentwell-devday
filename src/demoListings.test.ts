import { describe, expect, it } from "vitest";

import {
  demoListingsDataset,
  getDemoListings,
  updateDemoListing,
  type MandatoryRecurringFee,
} from "./demoListings";

describe("getDemoListings", () => {
  it("returns all 20 committed demo records", () => {
    expect(getDemoListings(demoListingsDataset)).toHaveLength(20);
  });

  it("exposes a numeric true monthly cost for every listing", () => {
    expect(
      getDemoListings(demoListingsDataset).every((listing) =>
        Number.isFinite(listing.synthetic.trueMonthlyCost),
      ),
    ).toBe(true);
  });

  it("keeps explicit no-fee listings at the base rent", () => {
    const noFeeListings = getDemoListings(demoListingsDataset).filter(
      (listing) => listing.synthetic.noMandatoryRecurringFees,
    );

    expect(noFeeListings.length).toBeGreaterThanOrEqual(2);
    expect(
      noFeeListings.every(
        (listing) => listing.synthetic.trueMonthlyCost === listing.market.price,
      ),
    ).toBe(true);
  });
});

describe("updateDemoListing", () => {
  it("returns an updated copy without mutating the original list", () => {
    const original = getDemoListings(demoListingsDataset);
    const listingId = original[0].synthetic.listingId;
    const originalTitle = original[0].synthetic.title;

    const updated = updateDemoListing(original, listingId, {
      title: "Updated renter-facing title",
      description: "Updated renter-facing description.",
    });

    expect(updated).not.toBe(original);
    expect(updated[0]).not.toBe(original[0]);
    expect(updated[0].synthetic.title).toBe("Updated renter-facing title");
    expect(updated[0].synthetic.description).toBe("Updated renter-facing description.");
    expect(original[0].synthetic.title).toBe(originalTitle);
  });

  it("recalculates the true monthly cost when recurring fees change", () => {
    const original = getDemoListings(demoListingsDataset);
    const target = original[0];
    const fees: MandatoryRecurringFee[] = [
      { id: "water-sewer", label: "Water and sewer", amount: 40 },
      { id: "technology", label: "Technology fee", amount: 30 },
    ];

    const updated = updateDemoListing(original, target.synthetic.listingId, {
      mandatoryRecurringFees: fees,
      noMandatoryRecurringFees: false,
    });

    expect(updated[0].synthetic.mandatoryRecurringFeeTotal).toBe(70);
    expect(updated[0].synthetic.trueMonthlyCost).toBe(target.market.price + 70);
    expect(target.synthetic.mandatoryRecurringFeeTotal).not.toBe(70);
  });

  it("returns the original list unchanged for an unknown listing ID", () => {
    const original = getDemoListings(demoListingsDataset);

    expect(updateDemoListing(original, "missing-listing", { title: "Not applied" })).toBe(
      original,
    );
  });

  it("keeps market and synthetic provenance distinct after an edit", () => {
    const original = getDemoListings(demoListingsDataset);
    const target = original[0];
    const updated = updateDemoListing(original, target.synthetic.listingId, {
      title: "Edited title",
    })[0];

    expect(updated.market).toEqual(target.market);
    expect(updated.provenance).toEqual({
      market: "RentCast sanitized snapshot",
      synthetic: "RentWell synthetic demo fixture",
    });
    expect(updated.synthetic).not.toHaveProperty("price");
  });
});
