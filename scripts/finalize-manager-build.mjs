// Vite names the output page after its input (manager.html). Hosting expects the
// site root to be index.html, so rename it after `vite build`.
import { existsSync, renameSync } from "node:fs";

const outDir = new URL("../dist-manager/", import.meta.url);
const built = new URL("manager.html", outDir);
const entry = new URL("index.html", outDir);

if (existsSync(built)) renameSync(built, entry);

if (!existsSync(entry)) {
  console.error("dist-manager/index.html was not produced. Did `vite build` succeed?");
  process.exit(1);
}

console.log("dist-manager/index.html is ready.");
