import { defineConfig } from "@playwright/test";

// Serves the production build (dist-on, :4173). CI builds it first.
const serve = (dir: string, port: number) => ({
  command: `pnpm exec vite preview --outDir ${dir} --host 127.0.0.1 --port ${port} --strictPort`,
  cwd: "..",
  url: `http://127.0.0.1:${port}`,
  reuseExistingServer: false,
  timeout: 60_000,
});

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { viewport: { width: 1280, height: 900 }, trace: "retain-on-failure" },
  webServer: [serve("dist-on", 4173)],
  projects: [
    { name: "flag-on", testMatch: "flag-on.spec.ts", use: { baseURL: "http://127.0.0.1:4173" } },
  ],
});
