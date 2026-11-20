import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Build for the separate property-manager app. It shares everything in src/ with
// the renter app but has its own entry (manager.html) and its own output folder.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
    },
  },
  build: {
    outDir: "dist-manager",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(projectRoot, "manager.html"),
    },
  },
  server: { port: 5174 },
  preview: { port: 4174 },
});
