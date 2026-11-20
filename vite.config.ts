import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { devApiPlugin } from "./server/devApiPlugin";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Server-only variables the dev /api handlers read from .env.local. They are copied into
// process.env for the dev server only; none of them has a VITE_ prefix, so Vite never
// exposes them to client code.
const SERVER_ENV_KEYS = ["ANTHROPIC_API_KEY", "FINE_PRINT_MODEL", "FINE_PRINT_ROUTER_MODEL", "FINE_PRINT_TIMEOUT_MS", "VISION_MODEL", "VISION_EFFORT"];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  for (const key of SERVER_ENV_KEYS) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [react(), tailwindcss(), devApiPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(projectRoot, "src"),
      },
    },
  };
});
