import { describe, expect, it } from "vitest";

import rentSnapshotData from "./data/rentcast-slc.json";
import { demoListingsDataset, getDemoListings } from "./demoListings";
import { createDemoRentalDecision } from "./rentalDecision";
import type { RentSnapshot } from "./rentMarket";
import { buildAdvisorDecisionModel } from "./advisorDecision";

describe("buildAdvisorDecisionModel", () => {
  it("derives costs and market evidence from the selected rental decision", () => {
    const decision = createDemoRentalDecision(getDemoListings(demoListingsDataset)[1]);

    expect(buildAdvisorDecisionModel(decision, rentSnapshotData as RentSnapshot)).toEqual(
      expect.objectContaining({
        title: "Avenues Garden Apartment",
        advertisedRent: 1299,
        recurringFeeTotal: 65,
        trueMonthlyCost: 1364,
        securityDeposit: 700,
        estimatedMoveInCost: 2064,
        comparableCount: 6,
        comparableMedian: 966.5,
      }),
    );
  });
});
