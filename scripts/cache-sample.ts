// Runs the live analysis on the sample lease and saves it for the offline demo path.
// Usage: pnpm cache:sample   (needs ANTHROPIC_API_KEY; uses a 60 s timeout)
import { readFileSync, writeFileSync } from "node:fs";
import { analyzeLease } from "../server/analyze.js";

process.env.FINE_PRINT_TIMEOUT_MS ||= "60000";
const lease = readFileSync("fixtures/sample-lease-juniper-row.txt", "utf8");
const analysis = await analyzeLease(lease);
const cached = { ...analysis, meta: { ...analysis.meta, source: "cached" as const } };
writeFileSync("src/finePrint/data/sample-analysis.json", `${JSON.stringify(cached, null, 2)}\n`);
console.log(
  `Saved: ${analysis.findings.length} findings (${analysis.meta.unverifiedCount} unverified), ` +
    `headline ${analysis.costs.headlineCents! / 100}, ${analysis.meta.ms} ms`,
);
