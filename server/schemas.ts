import { z } from "zod";

/**
 * Structured-output schemas for the model calls. Every field is required (nullable when it
 * may be absent) so the model must state "null" explicitly rather than omit things.
 */

const QuoteRefSchema = z.object({
  clauseId: z.string().describe("Id of the clause the quote is copied from, e.g. s4.1"),
  quote: z.string().describe("Exact text copied verbatim from that clause, at most 200 characters"),
});

const ExtractedFindingSchema = z.object({
  label: z.string().describe("Short plain-English name, e.g. 'Reserved parking'"),
  clauseId: z.string(),
  quote: z.string().describe("Verbatim from the clause; must contain every number you report"),
  kind: z.enum(["base_rent", "fee", "deposit", "deposit_deduction"]),
  type: z.enum(["mandatory", "conditional", "estimate", "refundable", "unknown_cost"]),
  frequency: z.enum(["monthly", "one_time", "per_event", "per_day", "percent"]),
  amount: z.number().nullable().describe("Dollars for ONE unit exactly as written; null if not stated"),
  percent: z.number().nullable().describe("For percentage fees, the percent as written (5 for 5%)"),
  perDayAmount: z.number().nullable().describe("Dollars per additional day, if the clause adds one"),
  rentMultiple: z.number().nullable().describe("For fees stated as N months of rent, N"),
  quantity: z.number().nullable().describe("Unit count written in the quote (two (2) fobs -> 2)"),
  perPerson: z.boolean().describe("True if charged per adult/applicant/person"),
  isRequired: z.boolean().describe("True only if every resident must pay it with no if/when"),
  paidEarlier: z.boolean().describe("True if the lease says it was already paid before signing"),
  condition: z.string().nullable().describe("When it applies, e.g. 'if no proof of insurance'"),
  notes: z.string().nullable(),
});

const FlagSchema = z.object({
  text: z.string().describe("One plain sentence a renter can understand"),
  refs: z.array(QuoteRefSchema),
});

export const ExtractionSchema = z.object({
  findings: z.array(ExtractedFindingSchema),
  rentSchedule: z.array(
    z.object({
      fromMonth: z.number(),
      toMonth: z.number(),
      amount: z.number(),
      clauseId: z.string(),
      quote: z.string(),
    }),
  ),
  conflicts: z.array(FlagSchema),
  clarifications: z.array(FlagSchema),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

/** Parallel extraction parts: findings for a subset of clauses, and lease-wide flags. */
export const FindingsPartSchema = ExtractionSchema.pick({ findings: true, rentSchedule: true });
export const FlagsPartSchema = ExtractionSchema.pick({ conflicts: true, clarifications: true });

export const RouterSchema = z.object({
  lane: z.enum(["IN_LEASE", "LEGAL_JUDGMENT", "WHAT_IF", "OFF_TOPIC"]),
  topic: z.string().nullable().describe("A topic id from the provided list, or null"),
  whatIf: z
    .object({
      occupants: z.number().nullable(),
      removeCharge: z.string().nullable().describe("Name of a charge to leave out, e.g. 'parking'"),
      includeEstimates: z.boolean().nullable(),
    })
    .nullable(),
  ack: z.string().nullable().describe("OFF_TOPIC only: at most 8 words, no questions or instructions"),
});

export type RouterOutput = z.infer<typeof RouterSchema>;

export const AnswerSchema = z.object({
  answer: z.string().nullable(),
  citations: z.array(QuoteRefSchema),
});

export type AnswerOutput = z.infer<typeof AnswerSchema>;
