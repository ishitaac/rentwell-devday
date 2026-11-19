import { segmentLease } from "../src/finePrint/lib/segment.js";
import { verifyExtraction, type VerifiedExtraction } from "../src/finePrint/lib/verifyExtraction.js";
import type { Clause } from "../src/finePrint/lib/types.js";
import { extractFromClauses } from "./extract.js";

export interface RawAnalysis extends VerifiedExtraction {
  clauses: Clause[];
  model: string;
  ms: number;
}

/** segment -> extract (model) -> verify (code). Lease text is never logged or stored. */
export async function analyzeLease(leaseText: string): Promise<RawAnalysis> {
  const started = Date.now();
  const clauses = segmentLease(leaseText);
  const { extraction, model } = await extractFromClauses(clauses);
  const verified = verifyExtraction(extraction, clauses);
  return { ...verified, clauses, model, ms: Date.now() - started };
}
