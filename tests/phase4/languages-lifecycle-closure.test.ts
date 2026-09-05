/**
 * Phase-4 closure (P4-C3): lifecycle behavior of a runtime that contains ONE
 * OPTIONAL Display (`languages-test`) — init/reset/migrate must not materialize,
 * persist, or generate the optional display until a user actually adds/configures
 * it, and reset restores the canonical default (absence) without force-deleting
 * modified/unowned artifacts.
 */

import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createArteRuntime } from "../../src/runtime.js";
import { codebaseDisplay } from "../../src/display/builtin/codebase/definition.js";
import { structureDisplay } from "../../src/display/builtin/structure/definition.js";
import { languagesTestDisplay } from "./languages-test-display.js";
import { initRepository } from "../../src/lifecycle/init.js";
import { resetRepository } from "../../src/lifecycle/reset.js";
import { migrateRepository } from "../../src/lifecycle/migrate.js";
import { loadConfigWithSchema } from "../../src/config/load.js";
import { cloneConfig, findConfigKey } from "../../src/config/registry.js";
import { writeConfigTxn } from "../../src/config/commit.js";
import { addCard } from "../../src/cardmgr/index.js";
import { buildStatusReport } from "../../src/lifecycle/status.js";
import { readState, findEntry } from "../../src/state/registry.js";
import type { ArteGitcardState } from "../../src/state/registry.js";
import { loadTheme } from "../../src/theme/load.js";
import { resolveTheme } from "../../src/theme/resolve.js";

const testRuntime = createArteRuntime({
  displays: [codebaseDisplay, structureDisplay, languagesTestDisplay],
});
const CONFIG = "arte-gitcard.yml";
const OUTPUT_REL = ".github/arte-git-card";
const LANG_SVG = `${OUTPUT_REL}/languages-test.svg`;

const LEGACY = `cards:
  codebase: { enabled: true, languages: { include_comments: false } }
  structure: { enabled: true, root: ".", max_depth: 3, activity_days: 7,
    commits: { enabled: true }, changes: { enabled: true } }
theme: "arte-theme"
output: { directory: ".github/arte-git-card" }
`;

const dirs: string[] = [];
function tmpRoot(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agc-p4lc-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function cfgPath(root: string): string {
  return path.join(root, CONFIG);
}
function cfg(root: string) {
  return loadConfigWithSchema(cfgPath(root), testRuntime.config.v2Schema).config;
}
function stateOf(root: string): ArteGitcardState | null {
  const read = readState(root);
  return read.status === "ok" ? read.state : null;
}
function themeOf(root: string): { loaded: ReturnType<typeof loadConfigWithSchema>; theme: ReturnType<typeof resolveTheme> } {
  const loaded = loadConfigWithSchema(cfgPath(root), testRuntime.config.v2Schema);
  const theme = resolveTheme(loadTheme(loaded.config.theme, root));
  return { loaded, theme };
}
function hasLangBlock(root: string): boolean {
  return (cfg(root).cards as unknown as Record<string, unknown>)["languages-test"] !== undefined;
}

/** init + add languages-test + set limit 5 → enabled=true, owned SVG present. */
function seedEnabledLangTest(root: string): void {
  initRepository(root, {});
  const t0 = themeOf(root);
  addCard(root, t0.loaded, t0.theme, "languages-test", { runtime: testRuntime });
  const { loaded } = themeOf(root); // reload AFTER the add (config on disk changed)
  const spec = findConfigKey(testRuntime, "languages-test.limit")!;
  const next = cloneConfig(loaded.config);
  spec.apply(next, "5", { projectRoot: root });
  writeConfigTxn(root, loaded, next, { command: "phase4-lc-limit", runtime: testRuntime });
}

describe("optional-display lifecycle closure (init/reset/migrate)", () => {
  it("init under a runtime with an optional display writes ONLY the required default blocks", () => {
    const root = tmpRoot();
    initRepository(root, {});
    const config = cfg(root);
    const cards = config.cards as unknown as Record<string, unknown>;
    expect(Object.keys(cards).sort()).toEqual(["codebase", "structure"]);
    expect(cards["languages-test"]).toBeUndefined();
    expect(existsSync(path.join(root, LANG_SVG))).toBe(false);
    expect(buildStatusReport(root, { runtime: testRuntime }).report.state).toBe("HEALTHY");
  });

  it("reset restores the canonical default (optional block absent) and deletes the owned unchanged SVG", () => {
    const root = tmpRoot();
    seedEnabledLangTest(root);
    expect(hasLangBlock(root)).toBe(true);
    const entry = findEntry(stateOf(root)!, LANG_SVG);
    expect(entry?.kind).toBe("card");
    expect(existsSync(path.join(root, LANG_SVG))).toBe(true);

    resetRepository(root, { runtime: testRuntime });

    expect(hasLangBlock(root)).toBe(false); // canonical absence
    expect(existsSync(path.join(root, LANG_SVG))).toBe(false); // owned+unchanged deleted
    const config = cfg(root);
    expect((config.cards as unknown as Record<string, unknown>)["codebase"]).toBeTruthy();
    expect((config.cards as unknown as Record<string, unknown>)["structure"]).toBeTruthy();
    expect(buildStatusReport(root, { runtime: testRuntime }).report.state).toBe("HEALTHY");
  });

  it("reset PRESERVES a modified owned optional SVG (abort, zero change) and an unowned one (kept)", () => {
    // modified owned artifact → existing reset safety semantics (never force-delete).
    const modifiedRoot = tmpRoot();
    seedEnabledLangTest(modifiedRoot);
    const svgAbs = path.join(modifiedRoot, LANG_SVG);
    writeFileSync(svgAbs, "MODIFIED\n", "utf8");
    const beforeConfig = readFileSync(cfgPath(modifiedRoot), "utf8");
    expect(() => resetRepository(modifiedRoot, { runtime: testRuntime })).toThrow(/modified/);
    expect(readFileSync(svgAbs, "utf8")).toBe("MODIFIED\n");
    expect(readFileSync(cfgPath(modifiedRoot), "utf8")).toBe(beforeConfig); // nothing was reset

    // unowned file at a managed path (no state entry) → reset never claims it.
    const unownedRoot = tmpRoot();
    initRepository(unownedRoot, {});
    const unownedAbs = path.join(unownedRoot, LANG_SVG);
    writeFileSync(unownedAbs, "UNOWNED\n", "utf8");
    resetRepository(unownedRoot, { runtime: testRuntime });
    expect(readFileSync(unownedAbs, "utf8")).toBe("UNOWNED\n"); // not force-deleted
    expect(hasLangBlock(unownedRoot)).toBe(false);
    expect(buildStatusReport(unownedRoot, { runtime: testRuntime }).report.state).toBe("HEALTHY");
  });

  it("migrate (v1→v2) under a runtime with an optional display migrates only codebase/structure", () => {
    const root = tmpRoot();
    writeFileSync(path.join(root, "arte-git-card.yml"), LEGACY, "utf8");
    migrateRepository(root);

    const config = cfg(root);
    const cards = config.cards as unknown as Record<string, unknown>;
    expect(Object.keys(cards).sort()).toEqual(["codebase", "structure"]);
    expect(cards["languages-test"]).toBeUndefined();
    expect(existsSync(path.join(root, LANG_SVG))).toBe(false);
    expect(config["schema-version"]).toBe(2);
    expect(buildStatusReport(root, { runtime: testRuntime }).report.state).toBe("HEALTHY");
  });
});
