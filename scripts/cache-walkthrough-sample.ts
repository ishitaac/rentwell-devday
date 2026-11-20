// Replaces the illustrated Sample with real model output from labeled, non-listing test photos.
// Put up to six JPEGs named by apartment shot (A1.jpg ... A6.jpg) in fixtures/walkthrough/sample/,
// ideally already resized (longest side <= 1568 px). Then run:
//   node --env-file=.env.local --import tsx scripts/cache-walkthrough-sample.ts
// Writes src/walkthrough/data/sample-live.json. Set it back to `null` to restore the illustrations.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { analyzePhoto } from "../server/walkthrough/analyzePhoto.js";

const DIR = "fixtures/walkthrough/sample";
const MAX_BYTES = 600_000;
const results: unknown[] = [];
const photos: Record<string, string> = {};

for (const shotId of ["A1", "A2", "A3", "A4", "A5", "A6"]) {
  const file = `${DIR}/${shotId}.jpg`;
  if (!existsSync(file)) {
    console.error(`${shotId}: no photo, will show as a gap`);
    continue;
  }
  if (statSync(file).size > MAX_BYTES) {
    console.error(
      `${shotId}: ${file} is over ${MAX_BYTES} bytes; resize it first so the bundle stays small`,
    );
    process.exit(1);
  }
  const imageBase64 = readFileSync(file).toString("base64");
  const result = await analyzePhoto({ unitType: "apartment", shotId, imageBase64 });
  results.push(result);
  photos[shotId] = `data:image/jpeg;base64,${imageBase64}`;
  console.error(
    `${shotId}: ${result.assessable ? `${result.observations.length} observation(s)` : "cannot assess"}`,
  );
}

writeFileSync("src/walkthrough/data/sample-live.json", JSON.stringify({ results, photos }));
console.error("Wrote src/walkthrough/data/sample-live.json");
