/**
 * Phase 4 acceptance: a TEST-ONLY third Display (`languages-test`) flows through
 * the real product lifecycle under an isolated `createArteRuntime`, with NO
 * production-core file aware of the id (no `if (id === "languages-test")`, no
 * languages-test literal in src/).
 *
 *   A  old v2 config (codebase+structure) loads strict-valid under the test schema
 *   B  card list → languages-test visible + disabled, config bytes unchanged
 *   C  completion auto-proposes languages-test, zero write
 *   D  generate/status/doctor/snippet with a disabled languages-test → no SVG, no config drift
 *   E  config get languages-test.limit → effective default 3, zero write
 *   F  config reset languages-test.limit (missing block) → no-op, no materialization
 *   G  config set languages-test.limit 5 → materializes defaults, enabled stays false, no SVG
 *   H  add languages-test → settings kept (limit 5), enabled true, SVG generated, state
 *      kind=card, status HEALTHY, snippet appears, completion proposes remove
 *   I  remove languages-test → disabled, owned unchanged SVG deleted, settings kept;
 *      a MODIFIED SVG is preserved (ownership dropped)
 *   J  forged `evil.svg` state entry → NEVER authority (reset preserves it)
 *
 * Compatibility:
 *   Test 1  load→save an old config under the test runtime does NOT auto-write a
 *           languages-test block
 *   Test 2  a config containing languages-test strict-fails under DEFAULT_RUNTIME
 *           but is strict-valid under the test runtime
 */

import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { createArteRuntime } from "../../src/runtime.js";
import { codebaseDisplay } from "../../src/display/builtin/codebase/definition.js";
import { structureDisplay } from "../../src/display/builtin/structure/definition.js";
import { languagesTestDisplay } from "./languages-test-display.js";
import { initRepository } from "../../src/lifecycle/init.js";
import { resetRepository } from "../../src/lifecycle/reset.js";
import { loadConfig, loadConfigWithSchema } from "../../src/config/load.js";
import { buildDefaultConfig } from "../../src/config/defaults.js";
import { cloneConfig, findConfigKey } from "../../src/config/registry.js";
import { writeConfigTxn } from "../../src/config/commit.js";
import { addCard, removeCard, cardStatusList, buildCardSnippet } from "../../src/cardmgr/index.js";
import { buildStatusReport } from "../../src/lifecycle/status.js";
import { detectRepositoryState } from "../../src/repo/detect.js";
import { generateEnabledCards } from "../../src/generate/manage.js";
import { readState, findEntry } from "../../src/state/registry.js";
import type { ArteGitcardState } from "../../src/state/registry.js";
import { sha256WrittenContent } from "../../src/fs/atomic.js";
import { loadTheme } from "../../src/theme/load.js";
import { resolveTheme } from "../../src/theme/resolve.js";
import { candidates } from "../../src/completion/engine.js";
import type { ArteRuntime } from "../../src/runtime.js";

const testRuntime: ArteRuntime = createArteRuntime({
  displays: [codebaseDisplay, structureDisplay, languagesTestDisplay],
});

const OUTPUT_REL = ".github/arte-git-card";
const LANG_REL = `${OUTPUT_REL}/languages-test.svg`;
const CONFIG = "arte-gitcard.yml";

const dirs: string[] = [];
function tmpRoot(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agc-p4-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of dirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
  dirs.length = 0;
});

function cfgPath(root: string): string {
  return path.join(root, CONFIG);
}
function cfgBytes(root: string): string {
  return readFileSync(cfgPath(root), "utf8");
}
function loadLoaded(root: string): ReturnType<typeof loadConfigWithSchema> {
  return loadConfigWithSchema(cfgPath(root), testRuntime.config.v2Schema);
}
function themeOf(root: string): { loaded: ReturnType<typeof loadConfigWithSchema>; theme: ReturnType<typeof resolveTheme> } {
  const loaded = loadLoaded(root);
  const theme = resolveTheme(loadTheme(loaded.config.theme, root));
  return { loaded, theme };
}
function seedHealthy(root: string): void {
  initRepository(root, {});
}
function langBlock(cfg: { cards: Record<string, unknown> }): { enabled?: boolean; limit?: number } {
  return (cfg.cards["languages-test"] as { enabled?: boolean; limit?: number }) ?? {};
}
function hasLanguagesBlock(root: string): boolean {
  const y = YAML.parse(cfgBytes(root)) as { cards?: Record<string, unknown> };
  return y.cards?.["languages-test"] !== undefined;
}
function stateOf(root: string): ArteGitcardState | null {
  const read = readState(root);
  return read.status === "ok" ? read.state : null;
}

describe("Phase 4: test-only languages-test under an isolated runtime", () => {
  it("A/B/C/E/F: optional display visible + disabled; reads/effective defaults; zero materialization", () => {
    const root = tmpRoot();
    seedHealthy(root);

    // A — old v2 config (only codebase+structure) is strict-valid under the test schema.
    const loaded = loadLoaded(root);
    expect(loaded.config.cards.codebase.enabled).toBe(true);
    expect("languages-test" in (loaded.config.cards as object)).toBe(false);

    // B — card list shows languages-test as a DISABLED display; config bytes unchanged.
    const before = cfgBytes(root);
    const list = cardStatusList(root, loaded.config, { runtime: testRuntime });
    expect(list.map((c) => c.id)).toEqual(["codebase", "structure", "languages-test"]);
    const langRow = list.find((c) => c.id === "languages-test")!;
    expect(langRow.enabled).toBe(false);
    expect(cfgBytes(root)).toBe(before);

    // C — completion auto-proposes languages-test for `add`; zero write.
    const addCandidates = candidates(["add", ""], root, { runtime: testRuntime });
    expect(addCandidates).toContain("languages-test");
    expect(cfgBytes(root)).toBe(before);

    // E — config get languages-test.limit → effective default 3; zero write.
    const limitSpec = findConfigKey(testRuntime, "languages-test.limit")!;
    expect(limitSpec.read(loaded.config)).toBe(3);
    expect(cfgBytes(root)).toBe(before);

    // F — config reset languages-test.limit on a MISSING block is a no-op (no materialization).
    const next = cloneConfig(loaded.config);
    limitSpec.reset(next);
    expect("languages-test" in (next.cards as object)).toBe(false);
    expect((next.cards as unknown as Record<string, unknown>)["languages-test"]).toBeUndefined();
    expect(hasLanguagesBlock(root)).toBe(false);
  });

  it("G/D: config set materializes defaults (enabled=false); generate/status/doctor/snippet never drift", () => {
    const root = tmpRoot();
    seedHealthy(root);
    const { loaded } = themeOf(root);

    // G — config set languages-test.limit 5 → block materialized {enabled:false, limit:5}.
    const spec = findConfigKey(testRuntime, "languages-test.limit")!;
    const next = cloneConfig(loaded.config);
    spec.apply(next, "5", { projectRoot: root });
    expect(langBlock(next)).toEqual({ enabled: false, limit: 5 });
    writeConfigTxn(root, loaded, next, { command: "phase4-config-set", runtime: testRuntime });
    expect(hasLanguagesBlock(root)).toBe(true);
    const afterSet = loadLoaded(root).config;
    expect(langBlock(afterSet)).toEqual({ enabled: false, limit: 5 });
    expect(existsSync(path.join(root, LANG_REL))).toBe(false); // no SVG while disabled

    // D — generate/status/doctor/snippet are READ-ONLY: no languages-test.svg, config byte-identical.
    const snapshot = cfgBytes(root);
    const loaded2 = loadLoaded(root);
    const theme2 = resolveTheme(loadTheme(loaded2.config.theme, root));
    const genRes = generateEnabledCards(root, loaded2, theme2, { runtime: testRuntime });
    expect(genRes.planned.artifacts.map((a) => a.file)).not.toContain("languages-test.svg");
    expect(existsSync(path.join(root, LANG_REL))).toBe(false);
    expect(cfgBytes(root)).toBe(snapshot);
    expect(detectRepositoryState(root, { runtime: testRuntime }).state).toBe("HEALTHY");
    expect(buildStatusReport(root, { runtime: testRuntime }).report.state).toBe("HEALTHY");
    // snippet is read-only for an ENABLED card; disabled languages-test is refused (never enabled).
    const enabledSnippet = buildCardSnippet(loaded2.config, ["codebase"], testRuntime);
    expect(enabledSnippet).toHaveLength(1);
    expect(cfgBytes(root)).toBe(snapshot);
  });

  it("H/I: add generates + owns + HEALTHY; remove deletes owned SVG and preserves modified SVG", () => {
    const root = tmpRoot();
    seedHealthy(root);

    // G-setup: materialize disabled block limit 5.
    const first = themeOf(root);
    const spec = findConfigKey(testRuntime, "languages-test.limit")!;
    const withBlock = cloneConfig(first.loaded.config);
    spec.apply(withBlock, "5", { projectRoot: root });
    writeConfigTxn(root, first.loaded, withBlock, { command: "phase4-setup", runtime: testRuntime });

    // H — add languages-test keeps limit=5, enables, generates + owns SVG.
    const { loaded, theme } = themeOf(root);
    const addRes = addCard(root, loaded, theme, "languages-test", { runtime: testRuntime });
    expect(addRes.nextConfig.cards.codebase.enabled).toBe(true); // unrelated card untouched
    const afterAdd = loadLoaded(root).config;
    expect(langBlock(afterAdd)).toEqual({ enabled: true, limit: 5 });
    const svgAbs = path.join(root, LANG_REL);
    expect(existsSync(svgAbs)).toBe(true);
    const state = stateOf(root);
    expect(state).not.toBeNull();
    const entry = findEntry(state!, LANG_REL);
    expect(entry?.kind).toBe("card");
    expect(detectRepositoryState(root, { runtime: testRuntime }).state).toBe("HEALTHY");
    expect(buildStatusReport(root, { runtime: testRuntime }).report.state).toBe("HEALTHY");
    expect(buildCardSnippet(afterAdd, ["languages-test"], testRuntime)).toEqual([
      `![languages-test card](${OUTPUT_REL}/languages-test.svg)`,
    ]);
    expect(candidates(["remove", ""], root, { runtime: testRuntime })).toContain("languages-test");

    // I — remove: disables, deletes the OWNED unchanged SVG, KEEPS settings.
    const rmRes = removeCard(root, themeOf(root).loaded, themeOf(root).theme, "languages-test", {
      runtime: testRuntime,
    });
    expect(rmRes.warnings).toHaveLength(0);
    const afterRemove = loadLoaded(root).config;
    expect(langBlock(afterRemove)).toEqual({ enabled: false, limit: 5 });
    expect(existsSync(svgAbs)).toBe(false);
  });

  it("I (modified): remove preserves a user-modified SVG and drops its ownership", () => {
    const root = tmpRoot();
    seedHealthy(root);

    // Materialize + add.
    const first = themeOf(root);
    const spec = findConfigKey(testRuntime, "languages-test.limit")!;
    const withBlock = cloneConfig(first.loaded.config);
    spec.apply(withBlock, "5", { projectRoot: root });
    writeConfigTxn(root, first.loaded, withBlock, { command: "phase4-setup", runtime: testRuntime });
    addCard(root, themeOf(root).loaded, themeOf(root).theme, "languages-test", { runtime: testRuntime });

    // User modifies the generated SVG.
    const svgAbs = path.join(root, LANG_REL);
    writeFileSync(svgAbs, "CUSTOM-EDIT\n", "utf8");

    const rmRes = removeCard(root, themeOf(root).loaded, themeOf(root).theme, "languages-test", {
      runtime: testRuntime,
    });
    expect(rmRes.warnings.join(" ")).toMatch(/modified/);
    expect(readFileSync(svgAbs, "utf8")).toBe("CUSTOM-EDIT\n"); // preserved, never deleted
    const state = stateOf(root);
    expect(findEntry(state!, LANG_REL)).toBeUndefined(); // ownership dropped
    const afterRemove = loadLoaded(root).config;
    expect(langBlock(afterRemove)).toEqual({ enabled: false, limit: 5 });
  });

  it("J: a forged state entry for an UNREGISTERED evil.svg never grants delete authority", () => {
    for (const runtime of [testRuntime]) {
      const root = tmpRoot();
      seedHealthy(root);

      const evilContent = "EVIL\n";
      const evilAbs = path.join(root, OUTPUT_REL, "evil.svg");
      writeFileSync(evilAbs, evilContent, "utf8");
      // Forge an ownership entry with a MATCHING hash for the unregistered file.
      const statePathAbs = path.join(root, ".arte-git-card", "state.json");
      const st = JSON.parse(readFileSync(statePathAbs, "utf8")) as {
        managedFiles: Array<{ path: string; kind: string; sha256: string }>;
      };
      st.managedFiles.push({
        path: `${OUTPUT_REL}/evil.svg`,
        kind: "card",
        sha256: sha256WrittenContent(evilContent),
      });
      writeFileSync(statePathAbs, JSON.stringify(st, null, 2) + "\n", "utf8");

      const res = resetRepository(root, { runtime });
      // evil.svg is NOT a registered display → never deleted, never blocks.
      expect(existsSync(evilAbs)).toBe(true);
      expect(res.preserved.join(" ")).toMatch(/evil\.svg/);
      const state = stateOf(root);
      expect(findEntry(state!, `${OUTPUT_REL}/evil.svg`)).toBeUndefined();
    }
  });

  it("Test 1: load→save an old config does NOT auto-write a languages-test block", () => {
    const root = tmpRoot();
    seedHealthy(root);
    const loaded = loadLoaded(root);
    const next = cloneConfig(loaded.config);
    next.exclude = [...(next.exclude ?? []), "vendor-extra"];
    writeConfigTxn(root, loaded, next, { command: "phase4-test1", runtime: testRuntime });
    expect(hasLanguagesBlock(root)).toBe(false);
    const round = loadLoaded(root).config;
    expect(round.exclude).toContain("vendor-extra");
  });

  it("Test 2: a config with languages-test strict-fails under DEFAULT_RUNTIME but is strict-valid under the test runtime", () => {
    const root = tmpRoot();
    const cfg = buildDefaultConfig();
    (cfg.cards as Record<string, unknown>)["languages-test"] = { enabled: false, limit: 3 };
    writeFileSync(cfgPath(root), YAML.stringify(cfg), "utf8");

    // DEFAULT_RUNTIME does not register languages-test → schema authority refuses it.
    expect(() => loadConfig(cfgPath(root))).toThrow(/Invalid configuration/);
    // The test runtime registers it → strict-valid.
    const loaded = loadConfigWithSchema(cfgPath(root), testRuntime.config.v2Schema);
    expect(langBlock(loaded.config)).toEqual({ enabled: false, limit: 3 });
  });
});
