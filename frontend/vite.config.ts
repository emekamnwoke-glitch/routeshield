import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));
const repo = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root: here,
  // GitHub Pages serves the site from /routeshield/ (ADR-0008).
  base: process.env.SITE_BASE ?? "/routeshield/",
  plugins: [react()],
  worker: { format: "es" },
  // SQLite WASM locates its .wasm file relative to its own module, so it must not be pre-bundled.
  optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
  server: { fs: { allow: [repo] } },
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
});
