import type { DemoListing } from "./demoListings";
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
  estimatedMoveInCost: number;
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
  const { synthetic } = listing;
  const comparison = calculateRentComparison(snapshot, synthetic.bedrooms);

  return {
    advertisedRent: synthetic.askingRent,
    recurringFeeTotal: synthetic.mandatoryRecurringFeeTotal,
    trueMonthlyCost: synthetic.trueMonthlyCost,
    estimatedMoveInCost: synthetic.trueMonthlyCost + synthetic.securityDeposit,
    comparison,
    fairRentResult: describeRangeResult(synthetic.askingRent, comparison),
    confidence: describeConfidence(comparison),
    explanation: describeComparisonMethod(comparison, synthetic.bedrooms),
    sourceLabel: "Dated RentCast snapshot",
    updatedAt: snapshot.generatedAt,
    missingInformation: ["Pet fee information is not included in this demo listing."],
  };
}
