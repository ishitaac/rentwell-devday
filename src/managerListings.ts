import { updateDemoListing, type DemoListing, type MandatoryRecurringFee } from "./demoListings";

export type ManagerListingDraft = {
  listingId: string;
  title: string;
  neighborhood: string;
  description: string;
  askingRent: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number | null;
  mandatoryRecurringFees: MandatoryRecurringFee[];
  noMandatoryRecurringFees: boolean;
  securityDeposit: number;
  availableDate: string;
  images: string[];
  amenities: string[];
  updatedAt: string;
};

export type ManagerListingErrors = Record<string, string>;

export type SaveManagerListingResult = {
  listings: DemoListing[];
  errors: ManagerListingErrors;
};

export function createManagerListingDraft(listing: DemoListing): ManagerListingDraft {
  const { synthetic } = listing;
  return {
    listingId: synthetic.listingId,
    title: synthetic.title,
    neighborhood: synthetic.neighborhood,
    description: synthetic.description,
    askingRent: synthetic.askingRent,
    propertyType: synthetic.propertyType,
    bedrooms: synthetic.bedrooms,
    bathrooms: synthetic.bathrooms,
    squareFootage: synthetic.squareFootage,
    mandatoryRecurringFees: synthetic.mandatoryRecurringFees.map((fee) => ({ ...fee })),
    noMandatoryRecurringFees: synthetic.noMandatoryRecurringFees,
    securityDeposit: synthetic.securityDeposit,
    availableDate: synthetic.availableDate,
    images: [...synthetic.images],
    amenities: [...synthetic.amenities],
    updatedAt: synthetic.updatedAt,
  };
}

function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function validateManagerListingDraft(draft: ManagerListingDraft): ManagerListingErrors {
  const errors: ManagerListingErrors = {};

  if (!draft.title.trim()) errors.title = "Enter a listing title.";
  if (!draft.neighborhood.trim()) errors.neighborhood = "Enter a neighborhood.";
  if (!draft.description.trim()) errors.description = "Enter a short description.";
  if (!draft.propertyType.trim()) errors.propertyType = "Enter a property type.";
  if (!Number.isFinite(draft.askingRent) || draft.askingRent <= 0) {
    errors.askingRent = "Base rent must be greater than zero.";
  }
  if (!Number.isFinite(draft.securityDeposit) || draft.securityDeposit < 0) {
    errors.securityDeposit = "Security deposit cannot be negative.";
  }
  if (!Number.isFinite(draft.bedrooms) || draft.bedrooms < 0) {
    errors.bedrooms = "Bedrooms cannot be negative.";
  }
  if (!Number.isFinite(draft.bathrooms) || draft.bathrooms <= 0) {
    errors.bathrooms = "Bathrooms must be greater than zero.";
  }
  if (
    draft.squareFootage !== null &&
    (!Number.isFinite(draft.squareFootage) || draft.squareFootage < 0)
  ) {
    errors.squareFootage = "Square footage cannot be negative.";
  }
  if (!isValidCalendarDate(draft.availableDate)) {
    errors.availableDate = "Enter a valid availability date.";
  }
  if (draft.images.length === 0 || draft.images.some((image) => !image.trim())) {
    errors.images = "Add at least one image path.";
  }
  if (draft.amenities.length === 0 || draft.amenities.some((amenity) => !amenity.trim())) {
    errors.amenities = "Add at least one amenity.";
  }

  const invalidFee = draft.mandatoryRecurringFees.some(
    (fee) => !fee.id.trim() || !fee.label.trim() || !Number.isFinite(fee.amount) || fee.amount < 0,
  );
  const contradictoryNoFeeState =
    (draft.mandatoryRecurringFees.length > 0 && draft.noMandatoryRecurringFees) ||
    (draft.mandatoryRecurringFees.length === 0 && !draft.noMandatoryRecurringFees);
  if (invalidFee || contradictoryNoFeeState) {
    errors.mandatoryRecurringFees =
      "Provide complete non-negative fees or explicitly mark the listing as having no mandatory recurring fees.";
  }

  return errors;
}

export function saveManagerListingDraft(
  listings: DemoListing[],
  draft: ManagerListingDraft,
): SaveManagerListingResult {
  const errors = validateManagerListingDraft(draft);
  if (Object.keys(errors).length > 0) return { listings, errors };

  return {
    listings: updateDemoListing(listings, draft.listingId, {
      title: draft.title,
      neighborhood: draft.neighborhood,
      description: draft.description,
      askingRent: draft.askingRent,
      propertyType: draft.propertyType,
      bedrooms: draft.bedrooms,
      bathrooms: draft.bathrooms,
      squareFootage: draft.squareFootage,
      mandatoryRecurringFees: draft.mandatoryRecurringFees,
      noMandatoryRecurringFees: draft.noMandatoryRecurringFees,
      securityDeposit: draft.securityDeposit,
      availableDate: draft.availableDate,
      images: draft.images,
      amenities: draft.amenities,
      updatedAt: draft.updatedAt,
    }),
    errors: {},
  };
}
