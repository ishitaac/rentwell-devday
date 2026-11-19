import type { CostScenario, CostSummary, Finding, MoneyLine, RentPhase } from "./types";

/**
 * ALL money math for Fine Print. Pure functions over VERIFIED findings only.
 * Amounts are integer cents internally; rounding to dollars (half up) happens only at
 * display time, plus the per-person split, which must sum to the displayed total.
 */

export const DEFAULT_SCENARIO: CostScenario = { occupants: 2, includeEstimates: false, excludedFindingIds: [] };
export const OCCUPANT_CHOICES = [1, 2, 3, 4] as const;

export const toCents = (dollars: number): number => Math.round(dollars * 100);

/** Round half up to whole dollars. Display-time only. */
export function roundHalfUpDollars(cents: number): number {
  return Math.floor((cents + 50) / 100);
}

/** Splits whole dollars into n shares that sum exactly to the total (largest remainder). */
export function splitDollars(totalDollars: number, n: number): number[] {
  if (n < 1) return [];
  const base = Math.floor(totalDollars / n);
  const remainder = totalDollars - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

// ---- Classification. Code, not the model, decides where each verified finding lands. ----

const hasAmount = (f: Finding): f is Finding & { amount: number } => f.verified && f.amount !== null;

export const isBaseRent = (f: Finding) => hasAmount(f) && f.kind === "base_rent";
export const isMandatoryMonthly = (f: Finding) =>
  hasAmount(f) && f.kind === "fee" && f.type === "mandatory" && f.frequency === "monthly";
export const isEstimateMonthly = (f: Finding) =>
  hasAmount(f) && f.type === "estimate" && f.frequency === "monthly";
export const isUnknownCost = (f: Finding) => f.verified && f.type === "unknown_cost";
export const isRequiredDeposit = (f: Finding) =>
  hasAmount(f) && f.kind === "deposit" && f.type !== "conditional" && f.isRequired;
export const isSigningFee = (f: Finding) =>
  hasAmount(f) && f.kind === "fee" && f.type === "mandatory" && f.frequency === "one_time" && !f.paidEarlier;
export const isPaidEarlier = (f: Finding) => hasAmount(f) && f.kind === "fee" && f.paidEarlier;
export const isDepositDeduction = (f: Finding) =>
  hasAmount(f) && f.kind === "deposit_deduction" && f.type !== "conditional";

/** How many units a charge applies to: "two (2) fobs", or per adult x occupants. */
export function unitsFor(f: Finding, occupants: number): number {
  return (f.quantity ?? 1) * (f.perPerson ? occupants : 1);
}

export function lineCents(f: Finding, occupants: number): number {
  return f.amount === null ? 0 : toCents(f.amount) * unitsFor(f, occupants);
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const toLine = (f: Finding, occupants: number): MoneyLine => ({
  findingId: f.id,
  label: f.label,
  cents: lineCents(f, occupants),
});

/** Base rent for a lease month: a verified rent phase if one covers it, else the base rent clause. */
export function rentCentsForMonth(month: number, phases: RentPhase[], findings: Finding[]): number | null {
  const phase = phases.find((p) => p.fromMonth <= month && month <= p.toMonth);
  if (phase) return toCents(phase.amount);
  const base = findings.find(isBaseRent);
  return base ? toCents(base.amount!) : null;
}

// ---- Summary ----

export function computeCosts(
  findings: Finding[],
  rentSchedule: RentPhase[],
  scenario: CostScenario,
  occupancyLimit: CostSummary["occupancyLimit"],
): CostSummary {
  const occupants = Math.max(1, Math.floor(scenario.occupants));
  const excluded = new Set(scenario.excludedFindingIds);
  const included = (f: Finding) => !excluded.has(f.id);

  const monthlyLines = findings.filter((f) => isMandatoryMonthly(f) && included(f)).map((f) => toLine(f, occupants));
  const estimateLines = findings.filter((f) => isEstimateMonthly(f) && included(f)).map((f) => toLine(f, occupants));
  const monthlyCents = sum(monthlyLines.map((l) => l.cents));
  const estimateCents = sum(estimateLines.map((l) => l.cents));
  const extraMonthly = monthlyCents + (scenario.includeEstimates ? estimateCents : 0);

  const baseRentCents = rentCentsForMonth(1, rentSchedule, findings);
  const headlineCents = baseRentCents === null ? null : baseRentCents + monthlyCents;
  const headlineWithEstimatesCents = headlineCents === null ? null : headlineCents + estimateCents;
  const displayedMonthlyCents = scenario.includeEstimates ? headlineWithEstimatesCents : headlineCents;

  return {
    scenario: { ...scenario, occupants },
    baseRentCents,
    monthlyLines,
    headlineCents,
    estimateLines,
    estimateCents,
    headlineWithEstimatesCents,
    displayedMonthlyCents,
    perPersonDollars:
      displayedMonthlyCents === null ? [] : splitDollars(roundHalfUpDollars(displayedMonthlyCents), occupants),
    phases: rentSchedule.map((p) => ({
      fromMonth: p.fromMonth,
      toMonth: p.toMonth,
      rentCents: toCents(p.amount),
      totalCents: toCents(p.amount) + extraMonthly,
    })),
    unknowns: findings.filter(isUnknownCost).map((f) => ({ findingId: f.id, label: f.label })),
    moveIn: computeMoveIn(findings, headlineCents, occupants),
    percentExamples: computePercentExamples(findings, baseRentCents),
    rentMultiples: computeRentMultiples(findings, rentSchedule),
    occupancyLimit,
  };
}

function computeMoveIn(findings: Finding[], firstMonthCents: number | null, occupants: number): CostSummary["moveIn"] {
  if (firstMonthCents === null) return null;
  const deposits = findings.filter(isRequiredDeposit);
  const deductions = findings.filter(isDepositDeduction);
  const refundableCents = sum(deposits.map((f) => lineCents(f, occupants)));
  const nonRefundableDueAtSigningCents = sum(findings.filter(isSigningFee).map((f) => lineCents(f, occupants)));
  const paidEarlierCents = sum(findings.filter(isPaidEarlier).map((f) => lineCents(f, occupants)));
  const deductionCents = sum(deductions.map((f) => lineCents(f, occupants)));
  const dueAtSigningCents = refundableCents + nonRefundableDueAtSigningCents + firstMonthCents;

  return {
    refundableCents,
    nonRefundableDueAtSigningCents,
    firstMonthCents,
    dueAtSigningCents,
    paidEarlierCents,
    totalCashOutCents: dueAtSigningCents + paidEarlierCents,
    nonRefundableSubtotalCents: nonRefundableDueAtSigningCents + deductionCents + paidEarlierCents,
    // A stated deduction is taken from the deposit in the same clause.
    depositReturns: deposits.map((d) => {
      const depositCents = lineCents(d, occupants);
      const taken = sum(deductions.filter((x) => x.clauseId === d.clauseId).map((x) => lineCents(x, occupants)));
      return {
        findingId: d.id,
        label: d.label,
        depositCents,
        deductionCents: taken,
        maxReturnCents: Math.max(0, depositCents - taken),
      };
    }),
  };
}

function computePercentExamples(findings: Finding[], baseRentCents: number | null): CostSummary["percentExamples"] {
  if (baseRentCents === null) return [];
  return findings
    .filter((f) => f.verified && f.percent !== undefined)
    .map((f) => ({
      findingId: f.id,
      label: f.label,
      percent: f.percent!,
      // Integer math: percent may have one decimal (2.9), so scale by 10 first.
      exampleCents: Math.round((baseRentCents * Math.round(f.percent! * 10)) / 1000),
      ...(f.perDayAmount !== undefined ? { perDayCents: toCents(f.perDayAmount) } : {}),
    }));
}

function computeRentMultiples(findings: Finding[], rentSchedule: RentPhase[]): CostSummary["rentMultiples"] {
  const base = findings.find(isBaseRent);
  const rents = rentSchedule.length > 0 ? rentSchedule.map((p) => toCents(p.amount)) : base ? [toCents(base.amount!)] : [];
  const distinct = [...new Set(rents)];
  return findings
    .filter((f) => f.verified && f.rentMultiple !== undefined)
    .map((f) => ({
      findingId: f.id,
      label: f.label,
      multiple: f.rentMultiple!,
      centsByPhase: distinct.map((r) => r * f.rentMultiple!),
    }));
}
