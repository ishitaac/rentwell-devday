/** Shared Fine Print types. Used by the browser and the /api functions. */

export type FeeType = "mandatory" | "conditional" | "estimate" | "refundable" | "unknown_cost";
export type Frequency = "monthly" | "one_time" | "per_event" | "per_day" | "percent";
/** What the money is, so code (never the model) decides where it lands in the totals. */
export type FindingKind = "base_rent" | "fee" | "deposit" | "deposit_deduction";

export interface Clause {
  id: string; // "s4.2", "exA", "preamble", "p3"
  section: string; // "§ 4.2", "Exhibit A"
  heading?: string;
  text: string;
}

export interface QuoteRef {
  clauseId: string;
  quote: string;
}

export interface Finding {
  id: string;
  label: string;
  clauseId: string;
  quote: string; // verbatim, verified by code
  type: FeeType;
  frequency: Frequency;
  kind: FindingKind;
  amount: number | null; // dollars for ONE unit; null when unknown
  percent?: number;
  perDayAmount?: number; // "$15 for each additional day"
  rentMultiple?: number; // "two (2) months' base rent"
  quantity?: number; // "two (2) key fobs"
  perPerson: boolean; // "per adult applicant"
  isRequired: boolean; // every resident pays it, no if/when
  paidEarlier: boolean; // e.g. application fee already paid
  condition?: string;
  notes?: string;
  verified: boolean; // set by verify.ts, never by the model
  verifyFailure?: string; // why verification failed (debug view)
}

export interface RentPhase {
  fromMonth: number;
  toMonth: number;
  amount: number;
  clauseId: string;
  quote: string;
}

export interface Flag {
  text: string;
  refs: QuoteRef[];
  clauseIds: string[];
}

export interface TopicStatus {
  topic: string;
  label: string;
  status: "found" | "not_found";
  clauseIds: string[];
}

export interface CostScenario {
  occupants: number;
  includeEstimates: boolean;
  excludedFindingIds: string[];
}

export interface MoneyLine {
  findingId: string;
  label: string;
  cents: number;
}

export interface CostSummary {
  scenario: CostScenario;
  baseRentCents: number | null; // month 1
  monthlyLines: MoneyLine[]; // mandatory monthly charges in the headline
  headlineCents: number | null; // month-1 real monthly cost
  estimateLines: MoneyLine[];
  estimateCents: number;
  headlineWithEstimatesCents: number | null;
  displayedMonthlyCents: number | null; // headline, plus estimates when toggled on
  perPersonDollars: number[]; // sums exactly to the rounded displayed total
  phases: { fromMonth: number; toMonth: number; totalCents: number; rentCents: number }[];
  unknowns: { findingId: string; label: string }[];
  moveIn: {
    refundableCents: number;
    nonRefundableDueAtSigningCents: number;
    firstMonthCents: number;
    dueAtSigningCents: number;
    paidEarlierCents: number;
    totalCashOutCents: number;
    nonRefundableSubtotalCents: number; // signing fees + stated deposit deductions + paid earlier
    maxDepositReturnCents: number;
  } | null;
  percentExamples: {
    findingId: string;
    label: string;
    percent: number;
    exampleCents: number;
    perDayCents?: number;
  }[];
  rentMultiples: { findingId: string; label: string; multiple: number; centsByPhase: number[] }[];
  occupancyLimit: { max: number; clauseId: string } | null;
}

export interface AnalysisResult {
  clauses: Clause[];
  findings: Finding[];
  topics: TopicStatus[];
  conflicts: Flag[];
  rentSchedule: RentPhase[];
  clarifications: Flag[];
  costs: CostSummary;
  questions: string[];
  isFictionalSample: boolean;
  meta: { model: string; source: "live" | "cached"; unverifiedCount: number; ms: number };
}
