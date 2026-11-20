import type { z } from "zod";
import type { Clause } from "../src/finePrint/lib/types.js";
import { callStructured, models } from "./anthropic.js";
import { EXTRACTION_SYSTEM, formatClauses } from "./prompts.js";
import { FindingsPartSchema, FlagsPartSchema, type Extraction } from "./schemas.js";

/**
 * Extraction runs as three parallel calls over the SAME full clause list, so each call has
 * the whole lease as context:
 *   A, B: findings (and rent phases) for the first / second half of the clauses
 *   C:    conflicts and clarifications across the whole lease
 * Wall time is the slowest call rather than the sum: one call with ~30 structured findings
 * measured ~31 s, over the 20 s budget. No arithmetic is requested in any call.
 */

const FINDINGS_EFFORT = "low" as const;

export function splitClauses(clauses: Clause[]): [Clause[], Clause[]] {
  const total = clauses.reduce((sum, c) => sum + c.text.length, 0);
  let running = 0;
  let cut = clauses.length;
  for (let i = 0; i < clauses.length; i += 1) {
    running += clauses[i].text.length;
    if (running >= total / 2) {
      cut = i + 1;
      break;
    }
  }
  return [clauses.slice(0, cut), clauses.slice(cut)];
}

function findingsTask(scope: Clause[]): string {
  const ids = scope.map((c) => c.id).join(", ");
  return `Task: report findings and rent schedule entries ONLY from these clause ids: ${ids}.
Read the other clauses for context only. Do not report conflicts or clarifications in this task.`;
}

const FLAGS_TASK = `Task: report conflicts and clarifications across the whole lease. Do not report findings in this task.`;

type FindingsPart = z.infer<typeof FindingsPartSchema>;
type FlagsPart = z.infer<typeof FlagsPartSchema>;

export async function extractFromClauses(clauses: Clause[]): Promise<{ extraction: Extraction; model: string }> {
  const model = models.main();
  const leaseBlock = formatClauses(clauses);
  const base = { model, system: EXTRACTION_SYSTEM, effort: FINDINGS_EFFORT, maxTokens: 16_000 };

  const findingsFor = async (scope: Clause[]): Promise<FindingsPart> => {
    if (scope.length === 0) return { findings: [], rentSchedule: [] };
    const request = () =>
      callStructured({ ...base, user: `${leaseBlock}\n\n${findingsTask(scope)}`, schema: FindingsPartSchema });
    // One retry. Never return partial findings: a missing half would show a falsely LOW cost.
    const part: FindingsPart = await request().catch(() => request());
    // Each call may only report clauses in its own scope; this prevents double counting.
    const inScope = new Set(scope.map((c) => c.id));
    return { ...part, findings: part.findings.filter((f) => inScope.has(f.clauseId)) };
  };

  const [first, second] = splitClauses(clauses);
  const [partA, partB, flags] = await Promise.all([
    findingsFor(first),
    findingsFor(second),
    callStructured({ ...base, user: `${leaseBlock}\n\n${FLAGS_TASK}`, schema: FlagsPartSchema }) as Promise<FlagsPart>,
  ]);

  return {
    model,
    extraction: {
      findings: [...partA.findings, ...partB.findings],
      rentSchedule: [...partA.rentSchedule, ...partB.rentSchedule], // deduped during verification
      conflicts: flags.conflicts,
      clarifications: flags.clarifications,
    },
  };
}
