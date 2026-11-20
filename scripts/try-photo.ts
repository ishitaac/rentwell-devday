// Dev probe: analyzes one JPEG for one shot and prints the validated result plus timing.
// Usage: node --env-file=.env.local --import tsx scripts/try-photo.ts <photo.jpg> [unitType] [shotId]
import { readFileSync } from "node:fs";
import type { UnitType } from "../src/walkthrough/lib/types.js";
import { analyzePhoto } from "../server/walkthrough/analyzePhoto.js";
import { visionModel } from "../server/walkthrough/vision.js";

const [file, unitType = "apartment", shotId = "A2"] = process.argv.slice(2);
if (!file) {
  console.error("Usage: scripts/try-photo.ts <photo.jpg> [unitType] [shotId]");
  process.exit(1);
}
const imageBase64 = readFileSync(file).toString("base64");
const started = Date.now();
const result = await analyzePhoto({ unitType: unitType as UnitType, shotId, imageBase64 });
console.log(JSON.stringify({ model: visionModel(), ms: Date.now() - started, result }, null, 2));
