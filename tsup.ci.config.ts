import { defineConfig } from "tsup";

/**
 * Second, independent build config for the vendored CI runtime.
 *
 * P0: two build configs, NEVER a global `outExtension` (that would rename
 * cli.js/index.js to .cjs). This one emits `dist/ci/main.cjs` — a `.cjs`
 * extension so a target repository's root package.json `"type": "module"`
 * cannot break the vendored runtime.
 *
 * Wired into the `build` script in Phase 6 (GitHub manager) when src/ci/runtime.ts
 * exists. verify-dist.cjs requires dist/ci/main.cjs from that phase on.
 */
export default defineConfig({
  entry: { "ci/main": "src/ci/main.ts" },
  format: ["cjs"],
  outExtension: () => ({ js: ".cjs" }),
  target: "node20",
  platform: "node",
  bundle: true,
  // yaml/zod bundled (self-contained); commander is NOT part of the runtime.
  noExternal: ["yaml", "zod"],
  clean: false,
  minify: false,
  sourcemap: false,
  splitting: false,
  outDir: "dist",
  // .tsx Display templates compile to the internal safe `h` factory.
  esbuildOptions(options) {
    options.jsx = "transform";
    options.jsxFactory = "h";
  },
});
