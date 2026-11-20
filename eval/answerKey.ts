import type { AnalysisResult, Finding } from "../src/finePrint/lib/types.js";

/**
 * Typed copy of eval/answer-key.md (hand-counted, fictional fixture). Used only by the
 * eval harness: never imported by app code and never sent to a model.
 */

type FindingTest = (f: Finding) => boolean;
const at = (...clauseIds: string[]): FindingTest => (f) => clauseIds.includes(f.clauseId);
const amount = (n: number): FindingTest => (f) => f.amount === n;
const all = (...tests: FindingTest[]): FindingTest => (f) => tests.every((t) => t(f));

export interface ExpectedFee {
  id: string;
  item: string;
  /** Every test must be satisfied by at least one verified finding. */
  needs: FindingTest[];
}

export const EXPECTED_FEES: ExpectedFee[] = [
  { id: "F1", item: "Base rent $2,100 / $2,150", needs: [all(at("s3.1"), amount(2100), (f) => f.kind === "base_rent")] },
  { id: "F2", item: "Security deposit $1,000", needs: [all(at("s2.1"), amount(1000), (f) => f.kind === "deposit")] },
  { id: "F3", item: "Carpet cleaning deduction $150", needs: [all(at("s2.1"), amount(150))] },
  { id: "F4", item: "Administrative fee $250", needs: [all(at("s2.2"), amount(250))] },
  { id: "F5", item: "Application fee $45/adult", needs: [all(at("s2.3"), amount(45), (f) => f.perPerson && f.paidEarlier)] },
  { id: "F6", item: "Key fob deposit $25 x 2", needs: [all(at("s2.4"), amount(25), (f) => f.quantity === 2)] },
  { id: "F7", item: "Lost/damaged fob $60", needs: [all(at("s2.4"), amount(60), (f) => f.type === "conditional")] },
  { id: "F8", item: "Late fee 5% + $15/day", needs: [all(at("s3.3"), (f) => f.percent === 5 && f.perDayAmount === 15)] },
  { id: "F9", item: "Returned payment $40", needs: [all(at("s3.4"), amount(40))] },
  { id: "F10", item: "Card convenience fee 2.9%", needs: [all(at("s3.5"), (f) => f.percent === 2.9)] },
  { id: "F11", item: "Reserved parking $100", needs: [all(at("s4.1"), amount(100), (f) => f.type === "mandatory")] },
  { id: "F12", item: "Second parking space $75", needs: [all(at("s4.1"), amount(75), (f) => f.type === "conditional")] },
  { id: "F13", item: "Community amenity fee $45", needs: [all(at("s4.2"), amount(45), (f) => f.type === "mandatory")] },
  { id: "F14", item: "Technology package $65", needs: [all(at("s4.3"), amount(65), (f) => f.type === "mandatory")] },
  { id: "F15", item: "Pest control $8", needs: [all(at("s4.4"), amount(8), (f) => f.type === "mandatory")] },
  { id: "F16", item: "Valet trash $25", needs: [all(at("s4.5"), amount(25), (f) => f.type === "mandatory")] },
  { id: "F17", item: "Water/sewer/storm approx. $70", needs: [all(at("s4.6"), amount(70), (f) => f.type === "estimate")] },
  { id: "F18", item: "RUBS billing fee $5", needs: [all(at("s4.6"), amount(5), (f) => f.type === "mandatory")] },
  { id: "F19", item: "Landlord-placed insurance $14", needs: [all(at("s4.7"), amount(14), (f) => f.type === "conditional")] },
  { id: "F20", item: "Pet rent $35 / deposit $300", needs: [all(at("s5.1"), amount(35)), all(at("s5.1"), amount(300))] },
  { id: "F21", item: "Transfer fee $150", needs: [all(at("s8.1"), amount(150))] },
  { id: "F22", item: "Early termination 2 months' rent", needs: [all(at("s10.1"), (f) => f.rentMultiple === 2)] },
  { id: "F23", item: "Month-to-month premium $250", needs: [all(at("s11.1"), amount(250))] },
];

/** Every figure in the answer key's tables, as computed by costs.ts (dollars). */
export const EXPECTED_MATH: { label: string; expected: number; actual: (a: AnalysisResult, alt: AltCosts) => number | null }[] = [
  { label: "Months 1-6 fixed", expected: 2348, actual: (a) => cents(a.costs.headlineCents) },
  { label: "Months 1-6 per person (2)", expected: 1174, actual: (a) => a.costs.perPersonDollars[0] ?? null },
  { label: "Months 1-6 + estimate", expected: 2418, actual: (_, alt) => cents(alt.withEstimates.displayedMonthlyCents) },
  { label: "Months 1-6 + estimate per person", expected: 1209, actual: (_, alt) => alt.withEstimates.perPersonDollars[0] ?? null },
  { label: "Months 7-12 fixed", expected: 2398, actual: (a) => cents(a.costs.phases[1]?.totalCents ?? null) },
  { label: "Months 7-12 per person", expected: 1199, actual: (a) => half(a.costs.phases[1]?.totalCents ?? null) },
  { label: "Months 7-12 + estimate", expected: 2468, actual: (_, alt) => cents(alt.withEstimates.phases[1]?.totalCents ?? null) },
  { label: "Months 7-12 + estimate per person", expected: 1234, actual: (_, alt) => half(alt.withEstimates.phases[1]?.totalCents ?? null) },
  { label: "Cash due at signing", expected: 3648, actual: (a) => cents(a.costs.moveIn?.dueAtSigningCents ?? null) },
  { label: "Total cash out (with paid earlier)", expected: 3738, actual: (a) => cents(a.costs.moveIn?.totalCashOutCents ?? null) },
  { label: "Non-refundable one-time", expected: 490, actual: (a) => cents(a.costs.moveIn?.nonRefundableSubtotalCents ?? null) },
  { label: "Max security deposit back", expected: 850, actual: (a) => cents(a.costs.moveIn?.depositReturns.find((d) => d.depositCents === 100_000)?.maxReturnCents ?? null) },
  { label: "Late fee, first day after grace", expected: 120, actual: (a) => { const p = a.costs.percentExamples.find((x) => x.perDayCents !== undefined); return p ? (p.exampleCents + p.perDayCents!) / 100 : null; } },
  { label: "Early termination (months 1-6)", expected: 4200, actual: (a) => cents(a.costs.rentMultiples[0]?.centsByPhase[0] ?? null) },
  { label: "Early termination (months 7-12)", expected: 4300, actual: (a) => cents(a.costs.rentMultiples[0]?.centsByPhase[1] ?? null) },
];

export interface AltCosts {
  withEstimates: AnalysisResult["costs"];
}

function cents(c: number | null): number | null {
  return c === null ? null : c / 100;
}
function half(c: number | null): number | null {
  return c === null ? null : c / 200;
}

const flagAt = (a: AnalysisResult, clauseId: string, text?: RegExp) =>
  [...a.conflicts, ...a.clarifications].some((f) => f.clauseIds.includes(clauseId) && (!text || text.test(f.text)));

/** The answer key's "must be flagged" traps. */
export const EXPECTED_TRAPS: { id: number; trap: string; caught: (a: AnalysisResult) => boolean }[] = [
  { id: 1, trap: "Rent conflict (3.1 fixed vs Exhibit A)", caught: (a) => a.conflicts.some((c) => c.clauseIds.includes("s3.1") && c.clauseIds.includes("exA")) },
  { id: 2, trap: "Estimate not shown as fixed", caught: (a) => a.costs.estimateCents === 7000 && !a.costs.monthlyLines.some((l) => l.cents === 7000) },
  { id: 3, trap: "Open-ended fees (4.8)", caught: (a) => flagAt(a, "s4.8") },
  { id: 4, trap: "Community Rules not attached (6.1)", caught: (a) => flagAt(a, "s6.1") },
  { id: 5, trap: "Late fee has no cap (3.3)", caught: (a) => flagAt(a, "s3.3", /cap/i) },
  { id: 6, trap: "Early termination $4,200 or $4,300", caught: (a) => flagAt(a, "s10.1", /4,200[\s\S]*4,300/) },
  { id: 7, trap: "Unknown, not zero: electricity/gas and insurance", caught: (a) => a.costs.unknowns.some((u) => /electric|gas/i.test(u.label)) && a.costs.unknowns.some((u) => /insurance/i.test(u.label)) },
  { id: 8, trap: "Parking: second space conditional", caught: (a) => a.findings.some((f) => f.verified && f.clauseId === "s4.1" && f.amount === 75 && f.type === "conditional") },
  { id: 9, trap: "Joint and several liability (9.1)", caught: (a) => flagAt(a, "s9.1") },
  { id: 10, trap: "Auto-conversion to month-to-month (11.1)", caught: (a) => flagAt(a, "s11.1") },
  { id: 11, trap: "Occupancy and guest limits (1.3)", caught: (a) => flagAt(a, "s1.3") },
];
