/**
 * Public library surface (v2 safety model). The package exports (dist/index.js)
 * must expose ONLY pure analysis/render/model APIs — never the legacy direct
 * mutation writers that bypass state.json ownership and the transaction engine.
 */

import { describe, expect, it } from "vitest";
import * as lib from "../../src/index.js";

const UNSAFE = ["generateCards", "scaffoldProject", "writeFileDeterministic"] as const;
const SAFE = ["planCardArtifacts", "buildPreviewHtml", "analyzeCodebase", "scanRepository", "VERSION"] as const;

// P4-C1: no external Display/Statistics extension mechanism may leak through the
// package surface. These live only in internal src modules (not src/index.ts).
const EXTENSION_SURFACES = [
  "createArteRuntime",
  "defineDisplay",
  "DISPLAY_REGISTRY",
  "codebaseDisplay",
  "structureDisplay",
  "registryEnabledDisplays",
  "planCardArtifactsInternal",
  "h",
  "jsx",
  "jsxs",
  "Fragment",
  "renderSvg",
] as const;

describe("public index exports", () => {
  it("does NOT export the unsafe legacy mutation writers", () => {
    for (const name of UNSAFE) {
      expect(name in lib, `${name} must not be a public mutation export`).toBe(false);
    }
  });

  it("keeps the pure analysis/render/model/planning APIs", () => {
    for (const name of SAFE) {
      expect(name in lib, `${name} should still be exported`).toBe(true);
    }
  });

  it("does NOT expose runtime / Display registration / template-extension surfaces", () => {
    for (const name of EXTENSION_SURFACES) {
      expect(name in lib, `${name} must stay an INTERNAL surface (no external Display/plugin API)`).toBe(false);
    }
  });

  it("pure APIs are callable without a repository (memory-only)", () => {
    expect(typeof lib.planCardArtifacts).toBe("function");
    expect(typeof lib.buildPreviewHtml).toBe("function");
    expect(typeof lib.scanRepository).toBe("function");
  });

  it("public planCardArtifacts keeps the positional (loaded, theme, now?) call shape", () => {
    // Two required args + optional Date third arg (NOT an options bag carrying a
    // runtime): the previous public pure API is preserved while version stays 1.0.0.
    expect(lib.planCardArtifacts.length).toBe(3);
  });
});
