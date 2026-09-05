import { defineConfig } from "vitest/config";

export default defineConfig({
  // Internal Display templates are authoring-time TSX only (NO React/JSX runtime
  // in the shipped artifact). .tsx compiles to the internal safe `h` factory.
  esbuild: {
    jsx: "transform",
    jsxFactory: "h",
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
