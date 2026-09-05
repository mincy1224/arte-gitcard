import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli/index.ts",
    index: "src/index.ts",
  },
  format: ["cjs"],
  target: "node20",
  platform: "node",
  bundle: true,
  // Explicit release guarantee: these must be bundled into dist, never a
  // runtime dependency of the final .tgz (package.json carries zero deps).
  noExternal: ["commander", "yaml", "zod"],
  clean: true,
  minify: false,
  sourcemap: false,
  splitting: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
  outDir: "dist",
  // Internal Display `.tsx` templates compile to the safe `h` factory (authoring
  // syntax only — no React/jsx-runtime is ever bundled).
  esbuildOptions(options) {
    options.jsx = "transform";
    options.jsxFactory = "h";
  },
});
