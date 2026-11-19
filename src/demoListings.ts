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
  askingRent: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number | null;
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
    | "askingRent"
    | "propertyType"
    | "bedrooms"
    | "bathrooms"
    | "squareFootage"
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
  const listingLabel = current.synthetic.listingId;
  const mandatoryRecurringFees = (
    updates.mandatoryRecurringFees ?? current.synthetic.mandatoryRecurringFees
  ).map((fee) => ({ ...fee }));
  const mandatoryRecurringFeeTotal = mandatoryRecurringFees.reduce(
    (total, fee) => total + fee.amount,
    0,
  );
  if (
    updates.mandatoryRecurringFees?.length === 0 &&
    updates.noMandatoryRecurringFees === undefined
  ) {
    throw new Error(`${listingLabel} must explicitly state whether it has no mandatory recurring fees.`);
  }
  const noMandatoryRecurringFees =
    updates.noMandatoryRecurringFees ??
    current.synthetic.noMandatoryRecurringFees;

  for (const fee of mandatoryRecurringFees) {
    if (!fee.id.trim() || !fee.label.trim()) {
      throw new Error(`${listingLabel} requires non-empty fee IDs and labels.`);
    }
    if (!Number.isFinite(fee.amount) || fee.amount < 0) {
      throw new Error(`${listingLabel} requires every fee amount to be finite non-negative.`);
    }
  }
  if (mandatoryRecurringFees.length === 0 && !noMandatoryRecurringFees) {
    throw new Error(`${listingLabel} must explicitly state whether it has no mandatory recurring fees.`);
  }
  if (mandatoryRecurringFees.length > 0 && noMandatoryRecurringFees) {
    throw new Error(`${listingLabel} cannot declare no mandatory recurring fees while fee items exist.`);
  }

  const askingRent = updates.askingRent ?? current.synthetic.askingRent;
  if (!Number.isFinite(askingRent) || askingRent <= 0) {
    throw new Error(`${listingLabel} requires askingRent to be a positive number.`);
  }
  const propertyType = updates.propertyType ?? current.synthetic.propertyType;
  if (!propertyType.trim()) throw new Error(`${listingLabel} requires a propertyType.`);
  const bedrooms = updates.bedrooms ?? current.synthetic.bedrooms;
  const bathrooms = updates.bathrooms ?? current.synthetic.bathrooms;
  const squareFootage =
    updates.squareFootage === undefined
      ? current.synthetic.squareFootage
      : updates.squareFootage;
  if (!Number.isFinite(bedrooms) || bedrooms < 0) {
    throw new Error(`${listingLabel} requires non-negative bedrooms.`);
  }
  if (!Number.isFinite(bathrooms) || bathrooms <= 0) {
    throw new Error(`${listingLabel} requires positive bathrooms.`);
  }
  if (
    squareFootage !== null &&
    (!Number.isFinite(squareFootage) || squareFootage < 0)
  ) {
    throw new Error(`${listingLabel} requires non-negative squareFootage or null.`);
  }

  const title = updates.title ?? current.synthetic.title;
  const neighborhood = updates.neighborhood ?? current.synthetic.neighborhood;
  const description = updates.description ?? current.synthetic.description;
  for (const [field, value] of [
    ["title", title],
    ["neighborhood", neighborhood],
    ["description", description],
  ] as const) {
    if (!value.trim()) throw new Error(`${listingLabel} requires a non-empty ${field}.`);
  }
  const images = updates.images ? [...updates.images] : current.synthetic.images;
  const amenities = updates.amenities ? [...updates.amenities] : current.synthetic.amenities;
  if (images.length === 0 || images.some((image) => !image.trim())) {
    throw new Error(`${listingLabel} requires at least one image.`);
  }
  if (amenities.length === 0 || amenities.some((amenity) => !amenity.trim())) {
    throw new Error(`${listingLabel} requires at least one amenity.`);
  }

  const updatedListing: DemoListing = {
    market: current.market,
    synthetic: {
      ...current.synthetic,
      ...updates,
      title,
      neighborhood,
      description,
      askingRent,
      propertyType,
      bedrooms,
      bathrooms,
      squareFootage,
      mandatoryRecurringFees,
      mandatoryRecurringFeeTotal,
      noMandatoryRecurringFees,
      trueMonthlyCost: askingRent + mandatoryRecurringFeeTotal,
      images,
      amenities,
    },
    provenance: current.provenance,
  };

  return listings.map((listing, listingIndex) =>
    listingIndex === index ? updatedListing : listing,
  );
}
