import { describe, expect, it } from "vitest";

import { demoListingsDataset, getDemoListings, updateDemoListing } from "./demoListings";
import {
  DEFAULT_LISTING_FILTERS,
  filterListings,
  hasActiveListingFilters,
  type ListingFilters,
} from "./listingFilters";

const listings = getDemoListings(demoListingsDataset).slice(0, 6);

function titles(filters: Partial<ListingFilters> = {}, query = ""): string[] {
  return filterListings(listings, query, { ...DEFAULT_LISTING_FILTERS, ...filters }).map(
    (listing) => listing.synthetic.title,
  );
}

describe("filterListings", () => {
  it("shows all six listings when search and filters are clear", () => {
    expect(titles()).toHaveLength(6);
  });

  it.each([
    ["under-1200", ["Library Square Studio"]],
    [
      "1200-1600",
      ["Avenues Garden Apartment", "Central City Corner One-Bedroom", "University View Condo"],
    ],
    ["over-1600", ["Foothill Family Home", "Liberty Wells Townhome"]],
  ] as const)("filters true monthly cost with the %s band", (price, expected) => {
    expect(titles({ price })).toEqual(expected);
  });

  it.each([
    ["studio", ["Library Square Studio"]],
    ["1", ["Avenues Garden Apartment", "Central City Corner One-Bedroom"]],
    ["2", ["University View Condo"]],
    ["3-plus", ["Foothill Family Home", "Liberty Wells Townhome"]],
  ] as const)("filters the %s bedroom choice", (bedrooms, expected) => {
    expect(titles({ bedrooms })).toEqual(expected);
  });

  it("includes listings available on or before the move-in deadline", () => {
    expect(titles({ moveInBy: "2026-12-05" })).toEqual([
      "Avenues Garden Apartment",
      "Central City Corner One-Bedroom",
    ]);
    expect(titles({ moveInBy: "2026-12-01" })).toEqual(["Avenues Garden Apartment"]);
  });

  it("filters explicit no-fee disclosure", () => {
    expect(titles({ noMandatoryFees: true })).toEqual(["Library Square Studio"]);
  });

  it("combines search and active filters using AND logic", () => {
    expect(
      titles({ price: "1200-1600", bedrooms: "1", moveInBy: "2026-12-15" }, "Avenues"),
    ).toEqual(["Avenues Garden Apartment"]);
    expect(titles({}, "condo")).toEqual(["University View Condo"]);
  });

  it("includes $1,200 and $1,600 in only the middle price band", () => {
    const at1200 = updateDemoListing(listings, listings[1].synthetic.listingId, {
      askingRent: 1135,
    })[1];
    const at1600 = updateDemoListing(listings, listings[2].synthetic.listingId, {
      askingRent: 1532,
    })[2];
    const boundaryListings = [at1200, at1600];

    expect(
      filterListings(boundaryListings, "", {
        ...DEFAULT_LISTING_FILTERS,
        price: "1200-1600",
      }),
    ).toHaveLength(2);
    expect(
      filterListings(boundaryListings, "", {
        ...DEFAULT_LISTING_FILTERS,
        price: "under-1200",
      }),
    ).toHaveLength(0);
    expect(
      filterListings(boundaryListings, "", {
        ...DEFAULT_LISTING_FILTERS,
        price: "over-1600",
      }),
    ).toHaveLength(0);
  });
});

describe("hasActiveListingFilters", () => {
  it("detects search or filter changes and ignores clear defaults", () => {
    expect(hasActiveListingFilters("", DEFAULT_LISTING_FILTERS)).toBe(false);
    expect(hasActiveListingFilters("  avenues  ", DEFAULT_LISTING_FILTERS)).toBe(true);
    expect(hasActiveListingFilters("", { ...DEFAULT_LISTING_FILTERS, bedrooms: "2" })).toBe(true);
    expect(
      hasActiveListingFilters("", { ...DEFAULT_LISTING_FILTERS, moveInBy: "2026-12-15" }),
    ).toBe(true);
  });
});
