import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Test-only helper: loads a fixture from /fixtures. Never imported by app code. */
export function loadFixture(name: string): string {
  const url = new URL(`../../../fixtures/${name}`, import.meta.url);
  return readFileSync(fileURLToPath(url), "utf8");
}
