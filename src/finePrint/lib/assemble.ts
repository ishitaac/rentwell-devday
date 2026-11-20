import { findOccupancyLimit, scanTopics } from "./checklist.js";
import { computeCosts, DEFAULT_SCENARIO } from "./costs.js";
import { deriveClarifications, deriveConflicts, withoutDuplicates } from "./derivedFlags.js";
import { looksLikeInjection } from "./injection.js";
import { buildQuestions } from "./questions.js";
import { isFictionalSample } from "./segment.js";
import type { AnalysisResult, Clause, CostScenario, Finding, Flag, RentPhase } from "./types";

export interface VerifiedParts {
  clauses: Clause[];
  findings: Finding[];
  rentSchedule: RentPhase[];
  conflicts: Flag[];
  clarifications: Flag[];
}

/** Builds the full AnalysisResult from verified parts. Pure: no network, no model. */
export function assembleAnalysis(
  parts: VerifiedParts,
  leaseText: string,
  meta: Omit<AnalysisResult["meta"], "unverifiedCount">,
): AnalysisResult {
  const topics = scanTopics(parts.clauses);
  const conflicts = [
    ...parts.conflicts,
    ...deriveConflicts(parts.findings, parts.rentSchedule, parts.clauses, parts.conflicts),
  ];
  const derived = deriveClarifications(parts.findings, parts.rentSchedule, parts.clauses);
  const clarifications = [
    ...injectionWarnings(parts.clauses),
    ...derived.map((d) => d.flag),
    ...withoutDuplicates(parts.clarifications, derived),
  ];
  const costs = computeCosts(parts.findings, parts.rentSchedule, DEFAULT_SCENARIO, findOccupancyLimit(parts.clauses));
  return {
    clauses: parts.clauses,
    findings: parts.findings,
    topics,
    conflicts,
    rentSchedule: parts.rentSchedule,
    clarifications,
    costs,
    questions: buildQuestions({ topics, conflicts, clarifications, unknowns: costs.unknowns, clauses: parts.clauses }),
    isFictionalSample: isFictionalSample(leaseText),
    meta: { ...meta, unverifiedCount: parts.findings.filter((f) => !f.verified).length },
  };
}

/** Clauses that address software are surfaced, never obeyed; their findings never verify. */
function injectionWarnings(clauses: Clause[]): Flag[] {
  return clauses
    .filter((c) => looksLikeInjection(c.text))
    .map((c) => ({
      text: `${c.section} contains text addressed to AI tools, not to you. Fine Print ignored it. Ask the landlord why it's there.`,
      refs: [{ clauseId: c.id, quote: c.text.slice(0, 200) }],
      clauseIds: [c.id],
    }));
}

/** Recomputes the cost summary for a new scenario (occupants, estimates, what-ifs). */
export function withScenario(analysis: AnalysisResult, scenario: CostScenario): AnalysisResult {
  return {
    ...analysis,
    costs: computeCosts(analysis.findings, analysis.rentSchedule, scenario, analysis.costs.occupancyLimit),
  };
}
