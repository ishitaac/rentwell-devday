export type RentListing = {
  city: string | null;
  state: string | null;
  zipCode: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  price: number;
  listedDate: string | null;
  lastSeenDate: string | null;
};

export type RentSnapshot = {
  source: {
    provider: string;
    endpoint: string;
    documentation: string;
  };
  generatedAt: string;
  query: {
    city: string;
    state: string;
    status: string;
    limit: number;
  };
  listingCount: number;
  limitations: string[];
  listings: RentListing[];
};

export type RentComparison = {
  count: number;
  lower: number;
  median: number;
  upper: number;
  differenceScope: "exact-bedrooms" | "all-bedrooms-fallback";
  observedStart: string | null;
  observedEnd: string | null;
};

export function calculateRentComparison(
  snapshot: RentSnapshot,
  bedrooms: number,
): RentComparison | null {
  const validListings = snapshot.listings.filter(
    (listing) => Number.isFinite(listing.price) && listing.price > 0,
  );

  if (validListings.length === 0) return null;

  const bedroomMatches = validListings.filter((listing) => listing.bedrooms === bedrooms);
  const usesExactBedrooms = bedroomMatches.length >= 3;
  const comparableListings = usesExactBedrooms ? bedroomMatches : validListings;
  const prices = comparableListings.map((listing) => listing.price).sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 0 ? (prices[middle - 1] + prices[middle]) / 2 : prices[middle];
  const observedDates = comparableListings
    .map((listing) => listing.lastSeenDate)
    .filter((date): date is string => typeof date === "string" && !Number.isNaN(Date.parse(date)))
    .sort();

  return {
    count: comparableListings.length,
    lower: prices[Math.floor((prices.length - 1) * 0.25)],
    median,
    upper: prices[Math.ceil((prices.length - 1) * 0.75)],
    differenceScope: usesExactBedrooms ? "exact-bedrooms" : "all-bedrooms-fallback",
    observedStart: observedDates.at(0) ?? null,
    observedEnd: observedDates.at(-1) ?? null,
  };
}
