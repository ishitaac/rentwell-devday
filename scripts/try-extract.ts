// Dev probe: runs live extraction on a fixture and prints verified findings plus timing.
// Usage: pnpm exec tsx scripts/try-extract.ts [fixture-file]
import { readFileSync } from "node:fs";
import { segmentLease } from "../src/finePrint/lib/segment.js";
import { verifyExtraction } from "../src/finePrint/lib/verifyExtraction.js";
import { extractFromClauses } from "../server/extract.js";

const file = process.argv[2] ?? "fixtures/sample-lease-juniper-row.txt";
const clauses = segmentLease(readFileSync(file, "utf8"));
const started = Date.now();
const { extraction, model } = await extractFromClauses(clauses);
const ms = Date.now() - started;
const verified = verifyExtraction(extraction, clauses);
console.log(JSON.stringify({ model, ms, ...verified }, null, 2));
console.error(
  `\n${model}: ${ms} ms, ${verified.findings.length} findings, ` +
    `${verified.findings.filter((f) => !f.verified).length} unverified, ` +
    `${verified.rentSchedule.length} rent phases, ${verified.conflicts.length} conflicts, ` +
    `${verified.clarifications.length} clarifications, ${verified.droppedFlags} flags dropped`,
);
