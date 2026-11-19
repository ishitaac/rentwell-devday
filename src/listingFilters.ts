import type { DemoListing } from "./demoListings";

export type ListingPriceFilter = "any" | "under-1200" | "1200-1600" | "over-1600";

export type ListingBedroomFilter = "any" | "studio" | "1" | "2" | "3-plus";

export type ListingFilters = {
  price: ListingPriceFilter;
  bedrooms: ListingBedroomFilter;
  moveInBy: string;
  noMandatoryFees: boolean;
};

export const DEFAULT_LISTING_FILTERS: ListingFilters = {
  price: "any",
  bedrooms: "any",
  moveInBy: "",
  noMandatoryFees: false,
};

function matchesPrice(listing: DemoListing, price: ListingPriceFilter): boolean {
  const monthlyCost = listing.synthetic.trueMonthlyCost;

  switch (price) {
    case "under-1200":
      return monthlyCost < 1200;
    case "1200-1600":
      return monthlyCost >= 1200 && monthlyCost <= 1600;
    case "over-1600":
      return monthlyCost > 1600;
    default:
      return true;
  }
}

function matchesBedrooms(listing: DemoListing, bedrooms: ListingBedroomFilter): boolean {
  const bedroomCount = listing.market.bedrooms;

  if (bedrooms === "any") return true;
  if (bedroomCount === null) return false;

  switch (bedrooms) {
    case "studio":
      return bedroomCount === 0;
    case "1":
      return bedroomCount === 1;
    case "2":
      return bedroomCount === 2;
    case "3-plus":
      return bedroomCount >= 3;
    default:
      return false;
  }
}

export function filterListings(
  listings: DemoListing[],
  query: string,
  filters: ListingFilters,
): DemoListing[] {
  const normalizedQuery = query.trim().toLowerCase();

  return listings.filter((listing) => {
    const searchableText = [
      listing.synthetic.title,
      listing.synthetic.neighborhood,
      listing.market.propertyType,
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!normalizedQuery || searchableText.includes(normalizedQuery)) &&
      matchesPrice(listing, filters.price) &&
      matchesBedrooms(listing, filters.bedrooms) &&
      (!filters.moveInBy || listing.synthetic.availableDate <= filters.moveInBy) &&
      (!filters.noMandatoryFees || listing.synthetic.noMandatoryRecurringFees)
    );
  });
}

export function hasActiveListingFilters(query: string, filters: ListingFilters): boolean {
  return (
    query.trim().length > 0 ||
    filters.price !== DEFAULT_LISTING_FILTERS.price ||
    filters.bedrooms !== DEFAULT_LISTING_FILTERS.bedrooms ||
    filters.moveInBy !== DEFAULT_LISTING_FILTERS.moveInBy ||
    filters.noMandatoryFees !== DEFAULT_LISTING_FILTERS.noMandatoryFees
  );
}
