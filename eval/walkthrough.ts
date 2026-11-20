// Walkthrough eval: runs every hand-labeled photo twice and reports
// (a) issue detection vs labels, (b) repeat-run agreement, (c) false alarms on clean photos.
// Usage: node --env-file=.env.local --import tsx eval/walkthrough.ts [labels.json]
// Labels: fixtures/walkthrough/labels.json (see labels.example.json). Writes eval/walkthrough-last-run.md.
// Only quote numbers in the pitch that come from this script on labeled test photos.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { PhotoResult, Severity, UnitType } from "../src/walkthrough/lib/types.js";
import { analyzePhoto } from "../server/walkthrough/analyzePhoto.js";
import { visionModel } from "../server/walkthrough/vision.js";

interface Label {
  file: string;
  unitType: UnitType;
  shotId: string;
  /** "none" = clean photo; "not_assessable" = blurry, dark, or off-topic. */
  expected: "none" | "not_assessable" | Severity;
  note?: string;
}

type Outcome = "none" | "not_assessable" | "failed" | Severity;
const RANK: Record<Severity, number> = { follow_up: 1, priority: 2, stop_and_verify: 3 };

function outcomeOf(result: PhotoResult): Outcome {
  if (!result.assessable) return "not_assessable";
  let top: Severity | null = null;
  for (const o of result.observations) {
    if (o.finding === "concern_visible" && o.severity && (!top || RANK[o.severity] > RANK[top]))
      top = o.severity;
  }
  return top ?? "none";
}

async function run(label: Label, base: string): Promise<Outcome> {
  try {
    const imageBase64 = readFileSync(join(base, label.file)).toString("base64");
    return outcomeOf(
      await analyzePhoto({ unitType: label.unitType, shotId: label.shotId, imageBase64 }),
    );
  } catch {
    return "failed";
  }
}

const labelsPath = process.argv[2] ?? "fixtures/walkthrough/labels.json";
const labels = JSON.parse(readFileSync(labelsPath, "utf8")) as Label[];
const base = dirname(labelsPath);
const rows: string[] = [];
let issuePhotos = 0,
  detected = 0,
  cleanPhotos = 0,
  falseAlarms = 0,
  unassessPhotos = 0,
  unassessCaught = 0,
  agree = 0;

for (const label of labels) {
  const [first, second] = [await run(label, base), await run(label, base)];
  const isIssue = label.expected in RANK;
  const flagged = (o: Outcome) => o in RANK;
  if (first === second) agree += 1;
  if (isIssue) {
    issuePhotos += 1;
    if (flagged(first)) detected += 1;
  } else if (label.expected === "none") {
    cleanPhotos += 1;
    if (flagged(first)) falseAlarms += 1;
  } else {
    unassessPhotos += 1;
    if (first === "not_assessable") unassessCaught += 1;
  }
  rows.push(`| ${label.file} | ${label.shotId} | ${label.expected} | ${first} | ${second} |`);
  console.error(`${label.file}: expected ${label.expected}, got ${first} / ${second}`);
}

const pct = (n: number, d: number) => (d ? `${n}/${d} (${Math.round((n / d) * 100)}%)` : "n/a");
const report = `# Walkthrough eval, last run

Model: ${visionModel()} · ${new Date().toISOString()} · ${labels.length} labeled photos, each run twice.

| Measure | Result |
|---|---|
| Issue detection (labeled issue flagged on run 1) | ${pct(detected, issuePhotos)} |
| Repeat-run agreement (same top outcome both runs) | ${pct(agree, labels.length)} |
| False alarms on clean photos | ${pct(falseAlarms, cleanPhotos)} |
| Blurry/dark/off-topic caught as cannot assess | ${pct(unassessCaught, unassessPhotos)} |

| Photo | Shot | Label | Run 1 | Run 2 |
|---|---|---|---|---|
${rows.join("\n")}
`;
writeFileSync("eval/walkthrough-last-run.md", report);
console.log(report);
