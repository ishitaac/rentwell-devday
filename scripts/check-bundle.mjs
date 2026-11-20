// Fails if anything secret-shaped or server-only ended up in the client bundle (dist/).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = [/sk-ant-[A-Za-z0-9_-]{10,}/, /ANTHROPIC_API_KEY/, /Answer key for sample-lease/];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const offenders = walk("dist").filter((file) => {
  const text = readFileSync(file, "utf8");
  return FORBIDDEN.some((pattern) => pattern.test(text));
});

if (offenders.length > 0) {
  console.error(`Bundle check FAILED. Server-only content found in:\n${offenders.join("\n")}`);
  process.exit(1);
}
console.log(`Bundle check passed (${walk("dist").length} files scanned).`);
