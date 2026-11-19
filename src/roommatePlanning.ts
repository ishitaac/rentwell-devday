import type { RentalDecisionRecord } from "./rentalDecision";

export type RoommatePlanningContext =
  | { entryPerspective: "roommate-first"; rental: null }
  | {
      entryPerspective: "rental-first";
      rental: {
        decisionId: string;
        title: string;
        neighborhood: string;
        advertisedRent: number;
        recurringFeeTotal: number;
        trueMonthlyCost: number;
        bedrooms: number;
      };
    };

export function createRentalFirstRoommateContext(
  record: RentalDecisionRecord,
): RoommatePlanningContext {
  const recurringFeeTotal = record.recurringFees.reduce(
    (total, fee) => total + fee.amount,
    0,
  );

  return {
    entryPerspective: "rental-first",
    rental: {
      decisionId: record.decisionId,
      title: record.title,
      neighborhood: record.neighborhood,
      advertisedRent: record.askingRent,
      recurringFeeTotal,
      trueMonthlyCost: record.askingRent + recurringFeeTotal,
      bedrooms: record.bedrooms,
    },
  };
}

export function createRoommateFirstContext(): RoommatePlanningContext {
  return { entryPerspective: "roommate-first", rental: null };
}
