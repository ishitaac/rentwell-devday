import { defineConfig, devices } from "@playwright/test";

const PORT = 4317;

/** E2E runs against the production build served by `vite preview`, which has no /api. */
export default defineConfig({
  testDir: "e2e",
  // e2e/playwright.config.ts runs the roommate-AI specs against their own flag builds.
  testMatch: "demo.spec.ts",
  timeout: 30_000,
  workers: 2,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile-375", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, hasTouch: true } },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
