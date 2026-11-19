import type { DemoListing, MandatoryRecurringFee } from "./demoListings";

export type ExternalRentalEntry = {
  label: string;
  neighborhood: string;
  askingRent: number;
  bedrooms: number;
  squareFootage: number | null;
  mandatoryRecurringFeeTotal: number;
  noMandatoryRecurringFees: boolean;
  moveInDate: string;
};

export type RentalDecisionRecord = {
  decisionId: string;
  source: "synthetic-demo-listing" | "user-entered-demo-analysis";
  title: string;
  neighborhood: string;
  city: string;
  askingRent: number;
  bedrooms: number;
  bathrooms: number | null;
  squareFootage: number | null;
  propertyType: string | null;
  recurringFees: MandatoryRecurringFee[];
  noMandatoryRecurringFees: boolean;
  securityDeposit: number | null;
  availableDate: string | null;
  description: string | null;
  images: string[];
  amenities: string[];
  updatedAt: string;
  capabilities: { canCompare: boolean; canRequestTour: boolean };
};

function normalizeIdPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

export function createDemoRentalDecision(listing: DemoListing): RentalDecisionRecord {
  const { market, synthetic } = listing;

  return {
    decisionId: synthetic.listingId,
    source: "synthetic-demo-listing",
    title: synthetic.title,
    neighborhood: synthetic.neighborhood,
    city: market.city ?? "Salt Lake City",
    askingRent: synthetic.askingRent,
    bedrooms: synthetic.bedrooms,
    bathrooms: synthetic.bathrooms,
    squareFootage: synthetic.squareFootage,
    propertyType: synthetic.propertyType,
    recurringFees: synthetic.mandatoryRecurringFees.map((fee) => ({ ...fee })),
    noMandatoryRecurringFees: synthetic.noMandatoryRecurringFees,
    securityDeposit: synthetic.securityDeposit,
    availableDate: synthetic.availableDate,
    description: synthetic.description,
    images: [...synthetic.images],
    amenities: [...synthetic.amenities],
    updatedAt: synthetic.updatedAt,
    capabilities: { canCompare: true, canRequestTour: true },
  };
}

export function createExternalRentalDecision(
  entry: ExternalRentalEntry,
): RentalDecisionRecord {
  const title = entry.label.trim();
  const neighborhood = entry.neighborhood.trim();
  const squareFootageId = entry.squareFootage ?? "unknown";
  const feeDisclosureId = entry.noMandatoryRecurringFees
    ? "no-fees"
    : `${entry.mandatoryRecurringFeeTotal}-fees`;
  const decisionId = [
    "external-demo",
    normalizeIdPart(title),
    normalizeIdPart(neighborhood),
    entry.askingRent,
    entry.bedrooms,
    squareFootageId,
    feeDisclosureId,
    normalizeIdPart(entry.moveInDate),
  ].join("-");

  return {
    decisionId,
    source: "user-entered-demo-analysis",
    title,
    neighborhood,
    city: "Salt Lake City",
    askingRent: entry.askingRent,
    bedrooms: entry.bedrooms,
    bathrooms: null,
    squareFootage: entry.squareFootage,
    propertyType: null,
    recurringFees: entry.noMandatoryRecurringFees
      ? []
      : [
          {
            id: "mandatory-recurring-fees",
            label: "Mandatory recurring fees",
            amount: entry.mandatoryRecurringFeeTotal,
          },
        ],
    noMandatoryRecurringFees: entry.noMandatoryRecurringFees,
    securityDeposit: null,
    availableDate: entry.moveInDate || null,
    description: null,
    images: [],
    amenities: [],
    updatedAt: "Not provided",
    capabilities: { canCompare: false, canRequestTour: false },
  };
}
