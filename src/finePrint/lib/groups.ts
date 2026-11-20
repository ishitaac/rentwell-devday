import { topicById } from "./checklist.js";
import { lineCents } from "./costs.js";
import { formatDollars, formatFindingAmount, formatPercentExample, formatUnits, NOT_STATED } from "./format.js";
import type { AnalysisResult, Finding, QuoteRef } from "./types";

/** Turns an analysis into the six display groups of spec §9. Pure; no React. */

export type Badge = "Stated" | "Estimate" | "Conditional" | "Not found" | "Needs clarification";
export type GroupId = "monthly" | "conditional" | "signing" | "estimates" | "clarify" | "missing";

export interface Row {
  key: string; // stable id used for highlight + scroll
  label: string;
  amount?: string;
  detail?: string;
  badge: Badge;
  refs: QuoteRef[]; // quotes to highlight in the clause drawer
  excluded?: boolean;
}

export interface Group {
  id: GroupId;
  title: string;
  hint: string;
  rows: Row[];
  subtotals: { label: string; value: string }[];
}

const refOf = (f: Finding): QuoteRef[] => [{ clauseId: f.clauseId, quote: f.quote }];

function findingRow(f: Finding, occupants: number, badge: Badge, extra: Partial<Row> = {}): Row {
  const units = formatUnits(f, occupants);
  return {
    key: f.id,
    label: f.label,
    amount: formatFindingAmount(f, occupants),
    detail: [units, f.condition].filter(Boolean).join(" · ") || undefined,
    badge,
    refs: refOf(f),
    ...extra,
  };
}

export function badgeFor(f: Finding): Badge {
  if (f.type === "estimate") return "Estimate";
  if (f.type === "unknown_cost") return "Not found";
  if (f.type === "conditional") return "Conditional";
  return "Stated";
}

export function buildGroups(analysis: AnalysisResult): Group[] {
  const { costs } = analysis;
  const occupants = costs.scenario.occupants;
  const verified = analysis.findings.filter((f) => f.verified);
  const byId = new Map(verified.map((f) => [f.id, f]));
  const excluded = new Set(costs.scenario.excludedFindingIds);
  const percentById = new Map(costs.percentExamples.map((p) => [p.findingId, p]));
  const multipleById = new Map(costs.rentMultiples.map((m) => [m.findingId, m]));

  const baseRent = verified.find((f) => f.kind === "base_rent");
  const monthlyFees = verified.filter(
    (f) => f.kind === "fee" && f.type === "mandatory" && f.frequency === "monthly" && typeof f.amount === "number",
  );
  const monthly: Group = {
    id: "monthly",
    title: "Every month",
    hint: "Required charges, in the headline",
    rows: [
      ...(baseRent ? [findingRow(baseRent, occupants, "Stated", { label: "Base rent (month 1)", amount: costs.baseRentCents !== null ? `${formatDollars(costs.baseRentCents)}/mo` : NOT_STATED })] : []),
      ...monthlyFees.map((f) => findingRow(f, occupants, "Stated", { excluded: excluded.has(f.id) })),
    ],
    subtotals: costs.headlineCents !== null ? [{ label: "Real monthly cost", value: formatDollars(costs.headlineCents) }] : [],
  };

  const conditional: Group = {
    id: "conditional",
    title: "Only if",
    hint: "Charges that apply only when something happens",
    rows: verified
      .filter((f) => f.type === "conditional")
      .map((f) => {
        const pct = percentById.get(f.id);
        const multiple = multipleById.get(f.id);
        const detail = pct
          ? formatPercentExample(pct)
          : multiple
            ? `${multiple.centsByPhase.map(formatDollars).join(" or ")} depending on the rent phase`
            : undefined;
        return findingRow(f, occupants, "Conditional", detail ? { detail: [detail, f.condition].filter(Boolean).join(" · ") } : {});
      }),
    subtotals: [],
  };

  const moveIn = costs.moveIn;
  const signingFindings = verified.filter(
    (f) =>
      (f.kind === "deposit" && f.isRequired && f.type !== "conditional") ||
      (f.kind === "fee" && f.frequency === "one_time" && f.type === "mandatory") ||
      f.kind === "deposit_deduction",
  );
  const signing: Group = {
    id: "signing",
    title: "At signing",
    hint: "Cash to move in",
    rows: [
      ...signingFindings.map((f) =>
        findingRow(f, occupants, "Stated", {
          amount: f.paidEarlier
            ? `${formatDollars(lineCents(f, occupants))} paid earlier`
            : f.kind === "deposit_deduction"
              ? `−${formatDollars(lineCents(f, occupants))} at move-out`
              : formatDollars(lineCents(f, occupants)),
          detail: [
            formatUnits(f, occupants),
            f.kind === "deposit" ? "Refundable" : f.kind === "deposit_deduction" ? "Taken from the deposit" : "Non-refundable",
          ].filter(Boolean).join(" · "),
        }),
      ),
      ...(moveIn ? [{ key: "first-month", label: "First month (rent + monthly charges)", amount: formatDollars(moveIn.firstMonthCents), badge: "Stated" as const, refs: [] }] : []),
    ],
    subtotals: moveIn
      ? [
          { label: "Due at signing", value: formatDollars(moveIn.dueAtSigningCents) },
          { label: "Non-refundable", value: formatDollars(moveIn.nonRefundableSubtotalCents) },
        ]
      : [],
  };

  const estimates: Group = {
    id: "estimates",
    title: "Estimates, not fixed",
    hint: "Not in the headline unless you include them",
    rows: verified.filter((f) => f.type === "estimate").map((f) => findingRow(f, occupants, "Estimate", { detail: "Estimated by the lease. Not a fixed charge." })),
    subtotals: costs.estimateCents > 0 ? [{ label: "Estimated", value: `about ${formatDollars(costs.estimateCents)}/mo` }] : [],
  };

  const clarify: Group = {
    id: "clarify",
    title: "Needs clarification",
    hint: "Conflicts and open-ended terms",
    rows: [
      ...analysis.conflicts.map((c, i) => ({ key: `conflict-${i}`, label: "Terms disagree", detail: c.text, badge: "Needs clarification" as const, refs: c.refs })),
      ...analysis.clarifications.map((c, i) => ({ key: `clar-${i}`, label: "Ask about this", detail: c.text, badge: "Needs clarification" as const, refs: c.refs })),
    ],
    subtotals: [],
  };

  const missing: Group = {
    id: "missing",
    title: "Not in this lease",
    hint: "Costs it doesn't price and topics it doesn't mention",
    rows: [
      ...costs.unknowns.map((u) => {
        const f = byId.get(u.findingId)!;
        return findingRow(f, occupants, "Not found", { key: u.findingId, amount: NOT_STATED, detail: "Ask what this has cost over the last 12 months." });
      }),
      ...analysis.topics
        .filter((t) => t.status === "not_found")
        .map((t) => ({ key: `topic-${t.topic}`, label: t.label, amount: "Not mentioned", detail: topicById(t.topic)?.question, badge: "Not found" as const, refs: [] })),
    ],
    subtotals: [],
  };

  return [monthly, conditional, signing, estimates, clarify, missing].filter((g) => g.rows.length > 0);
}

/** Row key for a topic, finding or flag, used by the Ask panel to highlight a row. */
export function rowKeyForTopic(analysis: AnalysisResult, topicId: string): string | null {
  const topic = analysis.topics.find((t) => t.topic === topicId);
  if (!topic) return null;
  if (topic.status === "not_found") return `topic-${topicId}`;
  const finding = analysis.findings.find((f) => f.verified && topic.clauseIds.includes(f.clauseId));
  return finding ? finding.id : null;
}
