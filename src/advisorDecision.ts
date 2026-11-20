import { buildRentalDecisionReceipt } from "./listingDecision";
import type { RentalDecisionRecord } from "./rentalDecision";
import { describeRentDifference, type RentSnapshot } from "./rentMarket";

export type AdvisorDecisionModel = {
  title: string;
  advertisedRent: number;
  recurringFeeTotal: number;
  trueMonthlyCost: number;
  securityDeposit: number | null;
  estimatedMoveInCost: number | null;
  comparableCount: number | null;
  comparableMedian: number | null;
  comparisonSummary: string;
  recurringFees: RentalDecisionRecord["recurringFees"];
};

export function buildAdvisorDecisionModel(
  decision: RentalDecisionRecord,
  snapshot: RentSnapshot,
): AdvisorDecisionModel {
  const receipt = buildRentalDecisionReceipt(decision, snapshot);
  const difference = describeRentDifference(decision.askingRent, receipt.comparison);

  return {
    title: decision.title,
    advertisedRent: receipt.advertisedRent,
    recurringFeeTotal: receipt.recurringFeeTotal,
    trueMonthlyCost: receipt.trueMonthlyCost,
    securityDeposit: decision.securityDeposit,
    estimatedMoveInCost: receipt.estimatedMoveInCost,
    comparableCount: receipt.comparison?.count ?? null,
    comparableMedian: receipt.comparison?.median ?? null,
    comparisonSummary:
      difference.percentage === null
        ? "A market comparison is unavailable for this rental."
        : `${difference.percentageLabel} ${difference.directionLabel}`,
    recurringFees: decision.recurringFees,
  };
}
