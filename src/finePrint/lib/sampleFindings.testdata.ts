import type { Finding, RentPhase } from "./types";

/**
 * Test data: verified findings mirroring the fictional Juniper Row sample lease. Amounts
 * match fixtures/sample-lease-juniper-row.txt; expected totals come from eval/answer-key.md.
 */

type Defaulted = "id" | "quote" | "perPerson" | "isRequired" | "paidEarlier" | "verified";
type Input = Omit<Finding, Defaulted> & Partial<Pick<Finding, Defaulted>>;

let next = 0;
function f(p: Input): Finding {
  next += 1;
  return {
    id: `t${next}`,
    quote: "(test)",
    perPerson: false,
    isRequired: false,
    paidEarlier: false,
    verified: true,
    ...p,
  };
}

export function sampleFindings(): Finding[] {
  next = 0;
  return [
    f({ label: "Base rent", clauseId: "s3.1", kind: "base_rent", type: "mandatory", frequency: "monthly", amount: 2100, isRequired: true }),
    f({ label: "Security deposit", clauseId: "s2.1", kind: "deposit", type: "refundable", frequency: "one_time", amount: 1000, isRequired: true }),
    f({ label: "Carpet cleaning deduction", clauseId: "s2.1", kind: "deposit_deduction", type: "mandatory", frequency: "one_time", amount: 150, isRequired: true }),
    f({ label: "Administrative fee", clauseId: "s2.2", kind: "fee", type: "mandatory", frequency: "one_time", amount: 250, isRequired: true }),
    f({ label: "Application fee", clauseId: "s2.3", kind: "fee", type: "mandatory", frequency: "one_time", amount: 45, perPerson: true, paidEarlier: true, isRequired: true }),
    f({ label: "Key fob deposit", clauseId: "s2.4", kind: "deposit", type: "refundable", frequency: "one_time", amount: 25, quantity: 2, isRequired: true }),
    f({ label: "Lost fob", clauseId: "s2.4", kind: "fee", type: "conditional", frequency: "per_event", amount: 60 }),
    f({ label: "Late fee", clauseId: "s3.3", kind: "fee", type: "conditional", frequency: "percent", amount: null, percent: 5, perDayAmount: 15 }),
    f({ label: "Returned payment", clauseId: "s3.4", kind: "fee", type: "conditional", frequency: "per_event", amount: 40 }),
    f({ label: "Card convenience fee", clauseId: "s3.5", kind: "fee", type: "conditional", frequency: "percent", amount: null, percent: 2.9 }),
    f({ label: "Reserved parking", clauseId: "s4.1", kind: "fee", type: "mandatory", frequency: "monthly", amount: 100, isRequired: true }),
    f({ label: "Second parking space", clauseId: "s4.1", kind: "fee", type: "conditional", frequency: "monthly", amount: 75 }),
    f({ label: "Community amenity fee", clauseId: "s4.2", kind: "fee", type: "mandatory", frequency: "monthly", amount: 45, isRequired: true }),
    f({ label: "Technology package", clauseId: "s4.3", kind: "fee", type: "mandatory", frequency: "monthly", amount: 65, isRequired: true }),
    f({ label: "Pest control", clauseId: "s4.4", kind: "fee", type: "mandatory", frequency: "monthly", amount: 8, isRequired: true }),
    f({ label: "Valet trash", clauseId: "s4.5", kind: "fee", type: "mandatory", frequency: "monthly", amount: 25, isRequired: true }),
    f({ label: "Water, sewer, storm (RUBS)", clauseId: "s4.6", kind: "fee", type: "estimate", frequency: "monthly", amount: 70 }),
    f({ label: "RUBS billing fee", clauseId: "s4.6", kind: "fee", type: "mandatory", frequency: "monthly", amount: 5, isRequired: true }),
    f({ label: "Electricity and natural gas", clauseId: "s4.6", kind: "fee", type: "unknown_cost", frequency: "monthly", amount: null }),
    f({ label: "Renter's insurance", clauseId: "s4.7", kind: "fee", type: "unknown_cost", frequency: "monthly", amount: null }),
    f({ label: "Landlord-placed insurance", clauseId: "s4.7", kind: "fee", type: "conditional", frequency: "monthly", amount: 14 }),
    f({ label: "Pet rent", clauseId: "s5.1", kind: "fee", type: "conditional", frequency: "monthly", amount: 35 }),
    f({ label: "Pet deposit", clauseId: "s5.1", kind: "deposit", type: "refundable", frequency: "one_time", amount: 300 }),
    f({ label: "Transfer fee", clauseId: "s8.1", kind: "fee", type: "conditional", frequency: "one_time", amount: 150 }),
    f({ label: "Early termination fee", clauseId: "s10.1", kind: "fee", type: "conditional", frequency: "one_time", amount: null, rentMultiple: 2 }),
    f({ label: "Month-to-month premium", clauseId: "s11.1", kind: "fee", type: "conditional", frequency: "monthly", amount: 250 }),
  ];
}

export const sampleSchedule: RentPhase[] = [
  { fromMonth: 1, toMonth: 6, amount: 2100, clauseId: "exA", quote: "(test)" },
  { fromMonth: 7, toMonth: 12, amount: 2150, clauseId: "exA", quote: "(test)" },
];
