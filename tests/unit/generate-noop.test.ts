/**
 * `arte-gitcard generate` TRUE no-op contract.
 *
 * A generate whose planned artifact bytes exactly equal the existing regular
 * file bytes must NOT create/apply a filesystem write: no staging, no mtime
 * change, no "wrote" effect — while every ownership/path-authority/precondition
 * check still runs. Missing and genuinely-different targets keep the normal path.
 */

import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import YAML from "yaml";
import { seedHealthyRepo } from "../helpers/repo.js";
import { loadConfig } from "../../src/config/load.js";
import { loadTheme } from "../../src/theme/load.js";
import { resolveTheme } from "../../src/theme/resolve.js";
import { generateEnabledCards } from "../../src/generate/manage.js";
import { readState, removeEntry, serializeState } from "../../src/state/registry.js";
import { sha256File } from "../../src/fs/hash.js";
import { CONFIG_FILENAME } from "../../src/config/paths.js";

const dirs: string[] = [];
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "agc-nop-"));
  dirs.push(d);
  return d;
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

function snapshot(fixture: ReturnType<typeof seedHealthyRepo>): {
  codebase: { sha: string | null; mtime: number };
  structure: { sha: string | null; mtime: number };
} {
  const cb = path.join(fixture.root, fixture.outputRel, "codebase.svg");
  const st = path.join(fixture.root, fixture.outputRel, "structure.svg");
  return {
    codebase: { sha: sha256File(cb), mtime: statSync(cb).mtimeMs },
    structure: { sha: sha256File(st), mtime: statSync(st).mtimeMs },
  };
}

describe("arte-gitcard generate no-op", () => {
  it("1: a second generate preserves sha + mtime and reports no change", () => {
    const fixture = seedHealthyRepo(temp());
    const loaded = loadConfig(fixture.configPath);
    const theme = resolveTheme(loadTheme(loaded.config.theme, fixture.root));
    const before = snapshot(fixture);

    const res = generateEnabledCards(fixture.root, loaded, theme);
    const writes = res.effects.filter((e) => e.type === "write");
    expect(writes).toEqual([]);

    const after = snapshot(fixture);
    expect(after.codebase.sha).toBe(before.codebase.sha);
    expect(after.codebase.mtime).toBe(before.codebase.mtime);
    expect(after.structure.sha).toBe(before.structure.sha);
    expect(after.structure.mtime).toBe(before.structure.mtime);
  });

  it("2: only the genuinely changed artifact is written/touched", () => {
    const fixture = seedHealthyRepo(temp());
    const loaded = loadConfig(fixture.configPath);
    const theme = resolveTheme(loadTheme(loaded.config.theme, fixture.root));
    const before = snapshot(fixture);

    // Make ONLY structure.svg differ from what generate would write.
    const structAbs = path.join(fixture.root, fixture.outputRel, "structure.svg");
    writeFileSync(structAbs, readFileSync(structAbs, "utf8") + "<!-- drift -->\n", "utf8");

    const res = generateEnabledCards(fixture.root, loaded, theme);
    const writeRels = res.effects.filter((e) => e.type === "write").map((e) => e.rel);
    expect(writeRels).toEqual([`${fixture.outputRel}/structure.svg`]); // codebase not reported

    const after = snapshot(fixture);
    expect(after.codebase.sha).toBe(before.codebase.sha); // untouched
    expect(after.codebase.mtime).toBe(before.codebase.mtime); // untouched
    expect(after.structure.sha).toBe(before.structure.sha); // repaired back to baseline
  });

  it("3: an unchanged artifact still fails closed when it is UNOWNED (bytes equal are not a bypass)", () => {
    const fixture = seedHealthyRepo(temp());
    const structRel = `${fixture.outputRel}/structure.svg`;
    const structAbs = path.join(fixture.root, structRel);
    const structBytes = readFileSync(structAbs, "utf8");

    // Drop ownership of structure.svg while leaving its bytes in place.
    const stateRead = readState(fixture.root);
    if (stateRead.status !== "ok") throw new Error("expected ok state");
    removeEntry(stateRead.state, structRel);
    writeFileSync(path.join(fixture.root, ".arte-git-card", "state.json"), serializeState(stateRead.state), "utf8");

    const loaded = loadConfig(fixture.configPath);
    const theme = resolveTheme(loadTheme(loaded.config.theme, fixture.root));
    expect(() => generateEnabledCards(fixture.root, loaded, theme)).toThrow(/no ownership record|doctor|Collision/i);

    expect(readFileSync(structAbs, "utf8")).toBe(structBytes); // preserved, never adopted/overwritten
  });

  it("4: config/state precondition guarantees are unaffected by the no-op path", () => {
    const fixture = seedHealthyRepo(temp());
    const loadedA = loadConfig(fixture.configPath);
    const theme = resolveTheme(loadTheme(loadedA.config.theme, fixture.root));
    // disk config → B (differs from A) after A was consumed.
    const cfgB = loadConfig(fixture.configPath).config;
    cfgB.cards.codebase.languages.include_comments = true;
    writeFileSync(path.join(fixture.root, CONFIG_FILENAME), YAML.stringify(cfgB), "utf8");

    expect(() => generateEnabledCards(fixture.root, loadedA, theme)).toThrow(/changed concurrently|Retry/);
  });
});
