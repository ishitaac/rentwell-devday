import datasetJson from "./data/demo-listings.json";

export type MandatoryRecurringFee = {
  id: string;
  label: string;
  amount: number;
};

export type DemoListingMarket = {
  sourceKey: string;
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

export type DemoListingSynthetic = {
  listingId: string;
  managerId: string;
  title: string;
  neighborhood: string;
  description: string;
  mandatoryRecurringFees: MandatoryRecurringFee[];
  mandatoryRecurringFeeTotal: number;
  noMandatoryRecurringFees: boolean;
  feeDisclosureState: "complete";
  trueMonthlyCost: number;
  securityDeposit: number;
  availableDate: string;
  images: string[];
  amenities: string[];
  inventorySource: "synthetic";
  createdAt: string;
  updatedAt: string;
};

export type DemoListing = {
  market: DemoListingMarket;
  synthetic: DemoListingSynthetic;
  provenance: {
    market: "RentCast sanitized snapshot";
    synthetic: "RentWell synthetic demo fixture";
  };
};

export type DemoListingsDataset = {
  version: number;
  generatedFrom: string;
  source: {
    provider: string;
    endpoint: string;
    documentation: string;
  };
  query: {
    city: string;
    state: string;
    status: string;
    limit: number;
  };
  limitations: string[];
  listingCount: number;
  listings: DemoListing[];
};

export type DemoListingUpdates = Partial<
  Pick<
    DemoListingSynthetic,
    | "title"
    | "neighborhood"
    | "description"
    | "mandatoryRecurringFees"
    | "noMandatoryRecurringFees"
    | "feeDisclosureState"
    | "securityDeposit"
    | "availableDate"
    | "images"
    | "amenities"
    | "updatedAt"
  >
>;

export const demoListingsDataset = datasetJson as DemoListingsDataset;

export function getDemoListings(dataset: DemoListingsDataset): DemoListing[] {
  return dataset.listings;
}

export function updateDemoListing(
  listings: DemoListing[],
  listingId: string,
  updates: DemoListingUpdates,
): DemoListing[] {
  const index = listings.findIndex((listing) => listing.synthetic.listingId === listingId);
  if (index === -1) return listings;

  const current = listings[index];
  const mandatoryRecurringFees = (
    updates.mandatoryRecurringFees ?? current.synthetic.mandatoryRecurringFees
  ).map((fee) => ({ ...fee }));
  const mandatoryRecurringFeeTotal = mandatoryRecurringFees.reduce(
    (total, fee) => total + fee.amount,
    0,
  );
  const noMandatoryRecurringFees =
    updates.noMandatoryRecurringFees ??
    (updates.mandatoryRecurringFees
      ? mandatoryRecurringFees.length === 0
      : current.synthetic.noMandatoryRecurringFees);

  const updatedListing: DemoListing = {
    market: current.market,
    synthetic: {
      ...current.synthetic,
      ...updates,
      mandatoryRecurringFees,
      mandatoryRecurringFeeTotal,
      noMandatoryRecurringFees,
      trueMonthlyCost: current.market.price + mandatoryRecurringFeeTotal,
      images: updates.images ? [...updates.images] : current.synthetic.images,
      amenities: updates.amenities ? [...updates.amenities] : current.synthetic.amenities,
    },
    provenance: current.provenance,
  };

  return listings.map((listing, listingIndex) =>
    listingIndex === index ? updatedListing : listing,
  );
}
