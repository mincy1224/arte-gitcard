/**
 * Phase 4 acceptance guard (#15): adding the test-only `languages-test` Display
 * must require ZERO production-core changes. No src file may name the display,
 * no `if (id === "languages-test")` branch exists, and the production registry /
 * DEFAULT_RUNTIME never contains it — its authority exists ONLY in a test
 * registry/runtime.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DISPLAY_REGISTRY } from "../../src/display/registry.js";
import { DEFAULT_RUNTIME } from "../../src/runtime.js";
import { languagesTestDisplay } from "../phase4/languages-test-display.js";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src");

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const abs = path.join(d, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (name.endsWith(".ts")) out.push(abs);
    }
  };
  walk(dir);
  return out;
}

describe("languages-test stays a TEST-ONLY display", () => {
  it("production src never mentions 'languages-test' and never branches on its id", () => {
    for (const file of collectFiles(srcRoot)) {
      const text = readFileSync(file, "utf8");
      expect(text, `${file} mentions the test-only display id`).not.toContain("languages-test");
      expect(text, `${file} branches on the test-only display id`).not.toMatch(/if\s*\(\s*id\s*===\s*["']languages-test["']/);
    }
  });

  it("the production registry / DEFAULT_RUNTIME never contains languages-test", () => {
    expect(DISPLAY_REGISTRY.map((d) => d.id)).toEqual(["codebase", "structure"]);
    expect(DEFAULT_RUNTIME.findDisplay("languages-test")).toBeUndefined();
    expect(DEFAULT_RUNTIME.cardIds).toEqual(["codebase", "structure"]);
  });

  it("the test display is optional in schema-v2 and lives only in a test registry", () => {
    expect(languagesTestDisplay.config.requiredInSchemaV2).toBe(false);
    expect(languagesTestDisplay.config.defaults()).toEqual({ enabled: false, limit: 3 });
    // It is deliberately NOT in the production registry.
    expect(DISPLAY_REGISTRY.some((d) => d.id === languagesTestDisplay.id)).toBe(false);
  });
});
