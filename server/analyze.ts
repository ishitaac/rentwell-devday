import { assembleAnalysis } from "../src/finePrint/lib/assemble.js";
import { segmentLease } from "../src/finePrint/lib/segment.js";
import type { AnalysisResult } from "../src/finePrint/lib/types.js";
import { verifyExtraction } from "../src/finePrint/lib/verifyExtraction.js";
import { extractFromClauses } from "./extract.js";

/** segment -> extract (model) -> verify (code) -> costs/checklist/questions (code). */
export async function analyzeLease(leaseText: string): Promise<AnalysisResult> {
  const started = Date.now();
  const clauses = segmentLease(leaseText);
  const { extraction, model } = await extractFromClauses(clauses);
  const verified = verifyExtraction(extraction, clauses);
  return assembleAnalysis({ ...verified, clauses }, leaseText, {
    model,
    source: "live",
    ms: Date.now() - started,
  });
}
