import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildDemoListings, validateDemoListingAssets } from "./demo-listings.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const defaultProjectRoot = path.resolve(path.dirname(scriptPath), "..");

export async function generateDemoListingsFile({
  snapshotPath,
  enrichmentPath,
  outputPath,
  projectRoot,
}) {
  const [snapshotText, enrichmentText] = await Promise.all([
    readFile(snapshotPath, "utf8"),
    readFile(enrichmentPath, "utf8"),
  ]);
  const dataset = buildDemoListings(JSON.parse(snapshotText), JSON.parse(enrichmentText));
  await validateDemoListingAssets(dataset, projectRoot);

  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }

  return dataset;
}

async function main() {
  const dataset = await generateDemoListingsFile({
    snapshotPath: path.join(defaultProjectRoot, "src/data/rentcast-slc.json"),
    enrichmentPath: path.join(defaultProjectRoot, "src/data/demo-listing-enrichment.json"),
    outputPath: path.join(defaultProjectRoot, "src/data/demo-listings.json"),
    projectRoot: defaultProjectRoot,
  });
  console.log(`Generated ${dataset.listingCount} demo listings.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
