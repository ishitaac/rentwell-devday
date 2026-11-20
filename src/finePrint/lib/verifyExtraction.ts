import type { Clause, Finding, Flag, QuoteRef, RentPhase } from "./types";
import { canonicalRef, verifyFinding, verifyRentPhase } from "./verify.js";

/** Shape of the raw model extraction (mirrors server/schemas.ts, without zod). */
export interface RawExtraction {
  findings: (Omit<Finding, "id" | "verified" | "verifyFailure" | "percent" | "perDayAmount" | "rentMultiple" | "quantity" | "condition" | "notes"> & {
    percent: number | null;
    perDayAmount: number | null;
    rentMultiple: number | null;
    quantity: number | null;
    condition: string | null;
    notes: string | null;
  })[];
  rentSchedule: RentPhase[];
  conflicts: { text: string; refs: QuoteRef[] }[];
  clarifications: { text: string; refs: QuoteRef[] }[];
}

export interface VerifiedExtraction {
  findings: Finding[]; // all findings, verified flag set by code
  rentSchedule: RentPhase[]; // verified phases only
  conflicts: Flag[]; // only flags with at least one verified quote
  clarifications: Flag[];
  droppedFlags: number;
}

/** Drops null OPTIONAL fields; `amount` is required and keeps its null ("not stated"). */
function dropNulls<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([k, v]) => v !== null || k === "amount")) as T;
}

function verifyFlags(flags: RawExtraction["conflicts"], byId: Map<string, Clause>): Flag[] {
  return flags
    .map((flag) => {
      const refs = flag.refs
        .map((ref) => canonicalRef(ref, byId))
        .filter((ref): ref is QuoteRef => ref !== null);
      return { text: flag.text, refs, clauseIds: [...new Set(refs.map((r) => r.clauseId))] };
    })
    .filter((flag) => flag.refs.length > 0);
}

/** Verified rent phases, one per month range, sorted by start month. */
export function verifyPhases(phases: RentPhase[], byId: Map<string, Clause>): RentPhase[] {
  const unique = new Map<string, RentPhase>();
  for (const phase of phases) {
    const verified = verifyRentPhase(phase, byId);
    const key = `${phase.fromMonth}-${phase.toMonth}`;
    if (verified && !unique.has(key)) unique.set(key, verified);
  }
  return [...unique.values()].sort((a, b) => a.fromMonth - b.fromMonth);
}

export function verifyExtraction(raw: RawExtraction, clauses: Clause[]): VerifiedExtraction {
  const byId = new Map(clauses.map((c) => [c.id, c]));
  const findings = raw.findings.map((f, i) =>
    verifyFinding({ ...(dropNulls(f) as Omit<Finding, "id" | "verified">), id: `f${i + 1}` }, byId),
  );
  const conflicts = verifyFlags(raw.conflicts, byId);
  const clarifications = verifyFlags(raw.clarifications, byId);
  return {
    findings,
    rentSchedule: verifyPhases(raw.rentSchedule, byId),
    conflicts,
    clarifications,
    droppedFlags: raw.conflicts.length + raw.clarifications.length - conflicts.length - clarifications.length,
  };
}
