import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));
const repo = fileURLToPath(new URL("..", import.meta.url));
const sqliteWasmDir = dirname(createRequire(import.meta.url).resolve("@sqlite.org/sqlite-wasm/package.json"));

export default defineConfig({
  root: here,
  // GitHub Pages serves the site from /routeshield/ (ADR-0008).
  base: process.env.SITE_BASE ?? "/routeshield/",
  plugins: [react()],
  worker: { format: "es" },
  // SQLite WASM locates its .wasm file relative to its own module, so it must not be pre-bundled.
  optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
  // The package may resolve outside the repo (e.g. a git worktree using its parent's node_modules);
  // its .wasm is fetched by URL rather than imported, so its folder must be allowed explicitly.
  server: { fs: { allow: [repo, sqliteWasmDir] } },
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
});
