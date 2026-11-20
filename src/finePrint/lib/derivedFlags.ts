import { computeCosts, DEFAULT_SCENARIO } from "./costs.js";
import { formatDollars } from "./format.js";
import type { Clause, Finding, Flag, RentPhase } from "./types";
import { normalizeForMatch } from "./verify.js";

/**
 * Clarifications and conflicts that code can establish on its own from verified data.
 * These cover traps that depend on math or on something being absent, which the model is
 * unreliable at (for example "this late fee has no cap").
 */

const CAP_RE = /\b(cap|capped|maximum|max\.?|not to exceed|no more than|up to|limit(?:ed)?)\b/i;
const FIXED_RE = /\b(fixed|will not (?:change|increase)|remain(?:s)? (?:the same|unchanged|fixed))\b/i;

const flag = (text: string, f: Pick<Finding, "clauseId" | "quote">): Flag => ({
  text,
  refs: [{ clauseId: f.clauseId, quote: f.quote }],
  clauseIds: [f.clauseId],
});

const STOP_WORDS = new Set(["fee", "fees", "charge", "charges", "the", "and", "for", "of"]);
const subjectWords = (text: string) =>
  text.toLowerCase().match(/[a-z]{3,}/g)?.filter((w) => !STOP_WORDS.has(w)) ?? [];

/**
 * Drops model clarifications that repeat a code-derived one: same clause, and the model's
 * text names the same subject (e.g. "late" for the late-fee cap flag).
 */
export function withoutDuplicates(modelFlags: Flag[], derived: { flag: Flag; subject: string }[]): Flag[] {
  return modelFlags.filter(
    (m) =>
      !derived.some(
        ({ flag: d, subject }) =>
          d.clauseIds.some((id) => m.clauseIds.includes(id)) &&
          subjectWords(subject).every((w) => m.text.toLowerCase().includes(w)),
      ),
  );
}

/** Returns each derived flag with the finding label it is about (for de-duplication). */
export function deriveClarifications(
  findings: Finding[],
  rentSchedule: RentPhase[],
  clauses: Clause[],
): { flag: Flag; subject: string }[] {
  const byId = new Map(clauses.map((c) => [c.id, c]));
  const costs = computeCosts(findings, rentSchedule, DEFAULT_SCENARIO, null);
  const flags: { flag: Flag; subject: string }[] = [];

  for (const f of findings) {
    if (!f.verified || f.perDayAmount === undefined) continue;
    const clause = byId.get(f.clauseId);
    if (clause && !CAP_RE.test(normalizeForMatch(clause.text))) {
      const text = `The ${f.label.toLowerCase()} keeps adding ${formatDollars(Math.round(f.perDayAmount * 100))} a day with no stated cap.`;
      flags.push({ flag: flag(text, f), subject: f.label });
    }
  }

  for (const multiple of costs.rentMultiples) {
    if (multiple.centsByPhase.length < 2) continue;
    const f = findings.find((x) => x.id === multiple.findingId)!;
    const amounts = multiple.centsByPhase.map(formatDollars).join(" or ");
    const text = `The ${f.label.toLowerCase()} is ${multiple.multiple} months' base rent: ${amounts} depending on which rate applies.`;
    flags.push({ flag: flag(text, f), subject: f.label });
  }
  return flags;
}

/** A clause that says rent is fixed, contradicted by a verified multi-rate rent schedule. */
export function deriveConflicts(findings: Finding[], rentSchedule: RentPhase[], clauses: Clause[], existing: Flag[]): Flag[] {
  const rates = [...new Set(rentSchedule.map((p) => p.amount))];
  if (rates.length < 2) return [];
  const byId = new Map(clauses.map((c) => [c.id, c]));
  const base = findings.find((f) => f.verified && f.kind === "base_rent");
  const baseClause = base && byId.get(base.clauseId);
  const fixedMatch = baseClause && normalizeForMatch(baseClause.text).match(FIXED_RE);
  if (!base || !baseClause || !fixedMatch) return [];

  const phaseClauseId = rentSchedule[0].clauseId;
  const alreadyFlagged = existing.some(
    (c) => c.clauseIds.includes(base.clauseId) && c.clauseIds.includes(phaseClauseId),
  );
  if (alreadyFlagged) return [];

  const sentence = baseClause.text.split(/(?<=\.)\s+/).find((s) => FIXED_RE.test(normalizeForMatch(s)));
  const later = rentSchedule.find((p) => p.amount !== rentSchedule[0].amount)!;
  const phaseClause = byId.get(phaseClauseId);
  return [
    {
      text: `${baseClause.section} says rent stays fixed, but ${phaseClause?.section ?? "the rent schedule"} raises it to ${formatDollars(Math.round(later.amount * 100))} in months ${later.fromMonth}–${later.toMonth}.`,
      refs: [
        { clauseId: base.clauseId, quote: sentence ?? base.quote },
        { clauseId: later.clauseId, quote: later.quote },
      ],
      clauseIds: [base.clauseId, later.clauseId],
    },
  ];
}
