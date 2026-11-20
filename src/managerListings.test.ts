import { describe, expect, it } from "vitest";

import { demoListingsDataset, getDemoListings } from "./demoListings";
import {
  createManagerListingDraft,
  saveManagerListingDraft,
  validateManagerListingDraft,
} from "./managerListings";

describe("manager listing drafts", () => {
  it("copies every renter-visible section into an independent draft", () => {
    const listing = getDemoListings(demoListingsDataset)[1];

    const draft = createManagerListingDraft(listing);

    expect(draft).toMatchObject({
      listingId: "demo-slc-002",
      title: "Avenues Garden Apartment",
      neighborhood: "The Avenues",
      askingRent: 1299,
      propertyType: "Apartment",
      bedrooms: 1,
      bathrooms: 1,
      squareFootage: 550,
      securityDeposit: 700,
      availableDate: "2026-12-01",
    });
    expect(draft.mandatoryRecurringFees).toEqual([
      { id: "technology", label: "Technology fee", amount: 45 },
      { id: "trash", label: "Trash service", amount: 20 },
    ]);
    expect(draft.images).toEqual(["/listings/interior-blue.jpg"]);
    expect(draft.amenities).toEqual(["Bike storage", "Shared courtyard", "On-site laundry"]);
    expect(draft.mandatoryRecurringFees).not.toBe(listing.synthetic.mandatoryRecurringFees);
    expect(draft.images).not.toBe(listing.synthetic.images);
  });

  it("saves valid edits and recomputes recurring and true monthly costs", () => {
    const listings = getDemoListings(demoListingsDataset);
    const original = listings[1];
    const draft = {
      ...createManagerListingDraft(original),
      askingRent: 1500,
      mandatoryRecurringFees: [
        { id: "technology", label: "Technology fee", amount: 50 },
        { id: "trash", label: "Trash service", amount: 25 },
      ],
      updatedAt: "2026-11-19T08:00:00.000Z",
    };

    const result = saveManagerListingDraft(listings, draft);
    const saved = result.listings[1];

    expect(result.errors).toEqual({});
    expect(saved.synthetic.askingRent).toBe(1500);
    expect(saved.synthetic.mandatoryRecurringFeeTotal).toBe(75);
    expect(saved.synthetic.trueMonthlyCost).toBe(1575);
    expect(saved.synthetic.updatedAt).toBe("2026-11-19T08:00:00.000Z");
    expect(original.synthetic.askingRent).toBe(1299);
  });

  it("returns field errors and preserves the source list when a draft is invalid", () => {
    const listings = getDemoListings(demoListingsDataset);
    const draft = {
      ...createManagerListingDraft(listings[1]),
      title: " ",
      neighborhood: "",
      description: " ",
      propertyType: "",
      askingRent: -1,
      securityDeposit: -20,
      bedrooms: -1,
      bathrooms: 0,
      squareFootage: -5,
      availableDate: "2026-02-30",
      mandatoryRecurringFees: [{ id: "", label: "", amount: -4 }],
      noMandatoryRecurringFees: true,
      images: [],
      amenities: [],
    };

    const errors = validateManagerListingDraft(draft);
    const result = saveManagerListingDraft(listings, draft);

    expect(errors).toMatchObject({
      title: expect.any(String),
      neighborhood: expect.any(String),
      description: expect.any(String),
      propertyType: expect.any(String),
      askingRent: expect.any(String),
      securityDeposit: expect.any(String),
      bedrooms: expect.any(String),
      bathrooms: expect.any(String),
      squareFootage: expect.any(String),
      availableDate: expect.any(String),
      mandatoryRecurringFees: expect.any(String),
      images: expect.any(String),
      amenities: expect.any(String),
    });
    expect(result.listings).toBe(listings);
    expect(result.errors).toEqual(errors);
    expect(listings[1].synthetic.title).toBe("Avenues Garden Apartment");
  });

  it("allows explicit no-fee listings without confusing missing fees with zero", () => {
    const listings = getDemoListings(demoListingsDataset);
    const source = listings.find((listing) => listing.synthetic.noMandatoryRecurringFees);
    expect(source).toBeDefined();
    const draft = {
      ...createManagerListingDraft(source!),
      askingRent: 1125,
      mandatoryRecurringFees: [],
      noMandatoryRecurringFees: true,
    };

    const result = saveManagerListingDraft(listings, draft);
    const saved = result.listings.find(
      (listing) => listing.synthetic.listingId === draft.listingId,
    );

    expect(result.errors).toEqual({});
    expect(saved?.synthetic.mandatoryRecurringFeeTotal).toBe(0);
    expect(saved?.synthetic.trueMonthlyCost).toBe(1125);
  });
});
