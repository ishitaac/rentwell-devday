import { describe, expect, test } from "vitest";
import { computeCosts, DEFAULT_SCENARIO, roundHalfUpDollars, splitDollars } from "./costs";
import { formatDollars, formatFindingAmount, formatPercentExample } from "./format";
import { sampleFindings, sampleSchedule } from "./sampleFindings.testdata";
import type { CostScenario } from "./types";

const occupancy = { max: 2, clauseId: "s1.3" };
const run = (scenario: Partial<CostScenario> = {}, findings = sampleFindings()) =>
  computeCosts(findings, sampleSchedule, { ...DEFAULT_SCENARIO, ...scenario }, occupancy);

describe("T03 headline, per person, rent phases", () => {
  const costs = run();

  test("months 1-6 fixed total is $2,348 (rent $2,100 + $248 mandatory)", () => {
    expect(costs.baseRentCents).toBe(210_000);
    expect(costs.headlineCents).toBe(234_800);
    expect(costs.monthlyLines.map((l) => l.cents / 100).sort((a, b) => a - b)).toEqual([5, 8, 25, 45, 65, 100]);
  });

  test("per person for 2 is $1,174", () => {
    expect(costs.perPersonDollars).toEqual([1174, 1174]);
  });

  test("months 7-12 total is $2,398", () => {
    expect(costs.phases.map((p) => [p.fromMonth, p.toMonth, p.totalCents])).toEqual([
      [1, 6, 234_800],
      [7, 12, 239_800],
    ]);
  });

  test("per-person shares always sum to the rounded total", () => {
    expect(splitDollars(2348, 3)).toEqual([783, 783, 782]);
    expect(splitDollars(2418, 4).reduce((a, b) => a + b, 0)).toBe(2418);
    expect(run({ occupants: 3 }).perPersonDollars.reduce((a, b) => a + b, 0)).toBe(2348);
  });

  test("excluding a charge recalculates the headline", () => {
    const parking = sampleFindings().find((f) => f.label === "Reserved parking")!;
    expect(run({ excludedFindingIds: [parking.id] }).headlineCents).toBe(224_800);
  });

  test("conditional, refundable and unverified items never reach the headline", () => {
    const findings = sampleFindings().map((f) =>
      f.label === "Pest control" ? { ...f, verified: false } : f,
    );
    expect(run({}, findings).headlineCents).toBe(234_000);
  });
});

describe("T04 estimates", () => {
  test("estimate is excluded from the headline", () => {
    const costs = run();
    expect(costs.estimateCents).toBe(7_000);
    expect(costs.displayedMonthlyCents).toBe(234_800);
  });

  test("toggle adds $70", () => {
    const costs = run({ includeEstimates: true });
    expect(costs.displayedMonthlyCents).toBe(241_800);
    expect(costs.headlineCents).toBe(234_800); // the headline itself never changes
    expect(costs.perPersonDollars).toEqual([1209, 1209]);
    expect(costs.phases[1].totalCents).toBe(246_800);
  });
});

describe("T05 move-in cash", () => {
  const moveIn = run().moveIn!;

  test("move-in cash is $3,648", () => {
    expect(moveIn.refundableCents).toBe(105_000);
    expect(moveIn.nonRefundableDueAtSigningCents).toBe(25_000);
    expect(moveIn.firstMonthCents).toBe(234_800);
    expect(moveIn.dueAtSigningCents).toBe(364_800);
  });

  test("non-refundable subtotal is $490, with application fees shown as paid earlier", () => {
    expect(moveIn.nonRefundableSubtotalCents).toBe(49_000);
    expect(moveIn.paidEarlierCents).toBe(9_000);
    expect(moveIn.totalCashOutCents).toBe(373_800);
  });

  test("conditional pet deposit is not in move-in cash", () => {
    expect(moveIn.refundableCents).not.toBe(135_000);
  });

  test("maximum security deposit back is $850 before other deductions", () => {
    const security = moveIn.depositReturns.find((d) => d.label === "Security deposit")!;
    expect(security.maxReturnCents).toBe(85_000);
  });
});

describe("T06 unknown costs", () => {
  test("unknown costs render 'Not stated', never $0", () => {
    const costs = run();
    expect(costs.unknowns.map((u) => u.label)).toEqual(["Electricity and natural gas", "Renter's insurance"]);
    const electricity = sampleFindings().find((f) => f.type === "unknown_cost")!;
    expect(formatFindingAmount(electricity)).toBe("Not stated in lease");
    expect(formatFindingAmount(electricity)).not.toMatch(/\$0/);
  });

  test("a lease with no base rent gives no headline rather than a fake number", () => {
    const noRent = sampleFindings().filter((f) => f.kind !== "base_rent");
    const costs = computeCosts(noRent, [], DEFAULT_SCENARIO, null);
    expect(costs.headlineCents).toBeNull();
    expect(costs.perPersonDollars).toEqual([]);
    expect(costs.moveIn).toBeNull();
  });
});

describe("T07 percent fees", () => {
  const costs = run();

  test("late fee example is $105 plus $15/day", () => {
    const late = costs.percentExamples.find((p) => p.label === "Late fee")!;
    expect(late.exampleCents).toBe(10_500);
    expect(late.perDayCents).toBe(1_500);
    expect(formatPercentExample(late)).toBe("5% of base rent: $105 plus $15/day");
  });

  test("card fee shows the percent and a dollar example", () => {
    const card = costs.percentExamples.find((p) => p.label === "Card convenience fee")!;
    expect(card.exampleCents).toBe(6_090);
    expect(formatPercentExample(card)).toBe("2.9% of base rent: $61");
  });

  test("rent-multiple fees are computed per rent phase ($4,200 or $4,300)", () => {
    expect(costs.rentMultiples[0].centsByPhase).toEqual([420_000, 430_000]);
  });
});

describe("rounding and occupancy", () => {
  test("round half up happens at display time only", () => {
    expect(roundHalfUpDollars(10_450)).toBe(105);
    expect(roundHalfUpDollars(10_449)).toBe(104);
    expect(formatDollars(6_090)).toBe("$61");
  });

  test("the lease's occupancy limit travels with the result", () => {
    expect(run({ occupants: 3 }).occupancyLimit).toEqual(occupancy);
  });
});
