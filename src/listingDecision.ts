import type { DemoListing } from "./demoListings";
import {
  createDemoRentalDecision,
  type RentalDecisionRecord,
} from "./rentalDecision";
import {
  calculateRentComparison,
  describeComparisonMethod,
  type RentComparison,
  type RentSnapshot,
} from "./rentMarket";

export type ListingDecisionReceipt = {
  advertisedRent: number;
  recurringFeeTotal: number;
  trueMonthlyCost: number;
  estimatedMoveInCost: number | null;
  comparison: RentComparison | null;
  fairRentResult:
    | "Below the expected snapshot range"
    | "Within the expected snapshot range"
    | "Above the expected snapshot range"
    | "Market comparison unavailable";
  confidence: "High" | "Medium" | "Limited" | "Unavailable";
  explanation: string;
  sourceLabel: "Dated RentCast snapshot";
  updatedAt: string;
  missingInformation: string[];
};

function describeRangeResult(
  askingRent: number,
  comparison: RentComparison | null,
): ListingDecisionReceipt["fairRentResult"] {
  if (!comparison) return "Market comparison unavailable";
  if (askingRent < comparison.lower) return "Below the expected snapshot range";
  if (askingRent > comparison.upper) return "Above the expected snapshot range";
  return "Within the expected snapshot range";
}

function describeConfidence(
  comparison: RentComparison | null,
): ListingDecisionReceipt["confidence"] {
  if (!comparison) return "Unavailable";
  if (comparison.count >= 10) return "High";
  if (comparison.count >= 5) return "Medium";
  return "Limited";
}

export function buildListingDecisionReceipt(
  listing: DemoListing,
  snapshot: RentSnapshot,
): ListingDecisionReceipt {
  return buildRentalDecisionReceipt(createDemoRentalDecision(listing), snapshot);
}

export function buildRentalDecisionReceipt(
  record: RentalDecisionRecord,
  snapshot: RentSnapshot,
): ListingDecisionReceipt {
  const recurringFeeTotal = record.recurringFees.reduce(
    (total, fee) => total + fee.amount,
    0,
  );
  const trueMonthlyCost = record.askingRent + recurringFeeTotal;
  const comparison = calculateRentComparison(snapshot, record.bedrooms);
  const missingInformation =
    record.source === "synthetic-demo-listing"
      ? ["Pet fee information is not included in this demo listing."]
      : [
          ...(record.securityDeposit === null
            ? ["Security deposit has not been provided."]
            : []),
          ...(record.bathrooms === null
            ? ["Bathroom count has not been provided."]
            : []),
          ...(record.squareFootage === null
            ? ["Square footage has not been provided."]
            : []),
        ];

  return {
    advertisedRent: record.askingRent,
    recurringFeeTotal,
    trueMonthlyCost,
    estimatedMoveInCost:
      record.securityDeposit === null
        ? null
        : trueMonthlyCost + record.securityDeposit,
    comparison,
    fairRentResult: describeRangeResult(record.askingRent, comparison),
    confidence: describeConfidence(comparison),
    explanation: describeComparisonMethod(comparison, record.bedrooms),
    sourceLabel: "Dated RentCast snapshot",
    updatedAt: snapshot.generatedAt,
    missingInformation,
  };
}
