/**
 * Architecture security boundaries (Phase 6).
 *  1. Display modules (src/display/builtin/**) may NOT import filesystem /
 *     child-process / state / txn / github-mutation / fs-mutation helpers.
 *  2. Statistics modules (src/statistics/builtin/**) may NOT import txn /
 *     github mutation / fs-mutation helpers.
 *  3. The static display registry satisfies its contract (valid/unique ids and
 *     derived filenames, no reserved names, codebase+structure both present).
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DISPLAY_REGISTRY, DISPLAY_ID_RE, registryDisplayFilenames, registryDisplayIds } from "../../src/display/registry.js";
import { DEFAULT_RUNTIME, createArteRuntime } from "../../src/runtime.js";
import { codebaseDisplay } from "../../src/display/builtin/codebase/definition.js";
import { structureDisplay } from "../../src/display/builtin/structure/definition.js";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src");

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const abs = path.join(d, name);
      if (statSync(abs).isDirectory()) walk(abs);
      // FH-3: Display templates are `.tsx` — they MUST be scanned too.
      else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(abs);
    }
  };
  walk(dir);
  return out;
}

function importSpecifiers(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const out: string[] = [];
  // import from "…" / import("…") / require("…")
  for (const m of text.matchAll(/(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/g)) {
    const spec = m[1]!;
    if (spec.startsWith(".")) out.push(spec);
    else if (spec.startsWith("node:")) out.push(spec);
  }
  return out;
}

const DISPLAY_FORBIDDEN = [
  "node:fs",
  "node:child_process",
  "/txn/",
  "state/registry",
  "github/manage",
  "config/commit",
  "config/load",
  "fs/atomic",
  "fs/lock",
  "fs/presence",
  "fs/hash",
  "fs/pathguard",
  "config/root",
];

const STATISTICS_FORBIDDEN = ["/txn/", "github/manage", "config/commit", "fs/atomic", "fs/lock"];

describe("Display module import boundaries", () => {
  it("src/display/builtin/** never imports fs/child-process/state/txn/mutation helpers", () => {
    const files = collectFiles(path.join(srcRoot, "display", "builtin"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const rel = path.relative(srcRoot, file).replace(/\\/g, "/");
      for (const spec of importSpecifiers(file)) {
        for (const forbidden of DISPLAY_FORBIDDEN) {
          expect(spec.includes(forbidden), `${rel} imports forbidden module ${spec}`).toBe(false);
        }
      }
    }
  });

  it("src/statistics/builtin/** never imports txn / github mutation / fs-mutation helpers", () => {
    const files = collectFiles(path.join(srcRoot, "statistics", "builtin"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const rel = path.relative(srcRoot, file).replace(/\\/g, "/");
      for (const spec of importSpecifiers(file)) {
        for (const forbidden of STATISTICS_FORBIDDEN) {
          expect(spec.includes(forbidden), `${rel} imports forbidden module ${spec}`).toBe(false);
        }
      }
    }
  });

  it("display/statistics builtins read the deterministic clock (ctx.now) — never wall-clock", () => {
    // P4-C4: `now` in DisplayContext is the planner-injected generation clock.
    // A template may not read Date.now()/new Date() (would break determinism).
    const roots = [
      path.join(srcRoot, "display", "builtin"),
      path.join(srcRoot, "statistics", "builtin"),
    ];
    for (const root of roots) {
      for (const file of collectFiles(root)) {
        const text = readFileSync(file, "utf8");
        const rel = path.relative(srcRoot, file).replace(/\\/g, "/");
        expect(text.includes("Date.now("), `${rel} must not read wall-clock Date.now()`).toBe(false);
        expect(text.includes("new Date("), `${rel} must not construct wall-clock dates`).toBe(false);
      }
    }
  });

  it("FH-3: the scanner detects forbidden imports in .tsx templates AND require('node:…') literals", () => {
    const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "bad-tsx-display");
    const files = collectFiles(fixtureDir);
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(files.some((f) => f.endsWith(".tsx"))).toBe(true); // .tsx is scanned

    const violations: string[] = [];
    for (const file of files) {
      const rel = path.relative(fixtureDir, file);
      for (const spec of importSpecifiers(file)) {
        if (spec.includes("node:fs") || spec.includes("node:child_process")) {
          violations.push(`${rel} → ${spec}`);
        }
      }
    }
    // .tsx import form AND require() literal form are both caught.
    expect(violations.some((v) => v.includes("template.tsx") && v.includes("node:fs"))).toBe(true);
    expect(violations.some((v) => v.includes("template.tsx") && v.includes("node:child_process"))).toBe(true);
    expect(violations.some((v) => v.includes("require-holder.ts") && v.includes("node:fs"))).toBe(true);
  });
});

describe("static display registry contract", () => {
  it("ids are valid, unique, and derived filenames are unique", () => {
    const ids = registryDisplayIds(DISPLAY_REGISTRY);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(DISPLAY_ID_RE.test(id)).toBe(true);
    const files = registryDisplayFilenames(DISPLAY_REGISTRY);
    expect(new Set(files).size).toBe(files.length);
    for (const f of files) expect(f.endsWith(".svg")).toBe(true);
  });

  it("the compiled DEFAULT runtime mirrors the static registry (frozen, codebase+structure)", () => {
    expect(Object.isFrozen(DEFAULT_RUNTIME)).toBe(true);
    expect(DEFAULT_RUNTIME.displays).toHaveLength(DISPLAY_REGISTRY.length);
    expect(DEFAULT_RUNTIME.cardIds).toEqual(DISPLAY_REGISTRY.map((d) => d.id));
    expect(DEFAULT_RUNTIME.cardIds).toEqual(["codebase", "structure"]);
    expect(DEFAULT_RUNTIME.findDisplay("codebase")).toBeTruthy();
    expect(DEFAULT_RUNTIME.findDisplay("structure")).toBeTruthy();
    expect(Object.isFrozen(DEFAULT_RUNTIME.displays)).toBe(true);
    expect(Object.isFrozen(DEFAULT_RUNTIME.cardIds)).toBe(true);
    expect(Object.isFrozen(DEFAULT_RUNTIME.cardFilenames)).toBe(true);
  });

  it("a display id is reserved against framework-owned filenames", () => {
    for (const reserved of ["preview", "state", "workflow", "ci"]) {
      expect(DEFAULT_RUNTIME.findDisplay(reserved)).toBeUndefined();
      expect(DISPLAY_ID_RE.test(reserved)).toBe(true); // syntactically ok but reserved
    }
  });

  it("createArteRuntime validates and freezes an isolated test registry", () => {
    const rt = createArteRuntime({ displays: [codebaseDisplay, structureDisplay] });
    expect(rt.cardIds).toEqual(["codebase", "structure"]);
    expect(() =>
      createArteRuntime({ displays: [codebaseDisplay, structureDisplay, structureDisplay] }),
    ).toThrow(/duplicate display id/);
  });
});
