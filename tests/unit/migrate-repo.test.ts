/**
 * Transactional v1 → v2 migration (P0): writes arte-gitcard.yml atomically,
 * PRESERVES the legacy arte-git-card.yml, materializes builtin themes when the
 * legacy referenced one, and leaves the repo untouched on dry-run.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { migrateRepository } from "../../src/lifecycle/migrate.js";
import { loadConfig } from "../../src/config/load.js";
import { detectRepositoryState } from "../../src/repo/detect.js";
import { sha256Content } from "../../src/fs/hash.js";

function writeValidState(root: string, managed: Array<Record<string, string>>): string {
  const p = path.join(root, ".arte-git-card", "state.json");
  mkdirSync(path.dirname(p), { recursive: true });
  const doc = JSON.stringify(
    { schemaVersion: 2, toolVersion: "1.0.0", managedFiles: managed, outputRoots: [] },
    null,
    2,
  );
  writeFileSync(p, doc, "utf8");
  return p;
}

const dirs: string[] = [];

function repo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agc-migrate-"));
  dirs.push(dir);
  return dir;
}

const LEGACY = `cards:
  codebase: { enabled: true, languages: { include_comments: false } }
  structure: { enabled: true, root: ".", max_depth: 3, activity_days: 7,
    commits: { enabled: true }, changes: { enabled: true } }
theme: "arte-theme"
output: { directory: ".github/arte-git-card" }
`;

afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("migrateRepository (transactional)", () => {
  it("writes a v2 config, preserves the legacy file, and materializes the builtin theme", () => {
    const dir = repo();
    writeFileSync(path.join(dir, "arte-git-card.yml"), LEGACY, "utf8");
    const result = migrateRepository(dir);
    expect(result.materializedThemes).toContain(".arte-git-card/themes/arte-theme.yml");

    // legacy preserved (never deleted — fail-safe)
    expect(existsSync(path.join(dir, "arte-git-card.yml"))).toBe(true);
    // new v2 config is strict-loadable
    const cfgPath = path.join(dir, "arte-gitcard.yml");
    expect(existsSync(cfgPath)).toBe(true);
    const loaded = loadConfig(cfgPath);
    expect(loaded.config["schema-version"]).toBe(2);
    expect(loaded.config.theme).toBe(".arte-git-card/themes/arte-theme.yml");
    // theme materialized
    expect(existsSync(path.join(dir, ".arte-git-card", "themes", "arte-theme.yml"))).toBe(true);
    // no transaction leftovers
    expect(existsSync(path.join(dir, ".arte-git-card", "txn.json"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card", ".lock"))).toBe(false);
  });

  it("does not overwrite an already-installed theme during migration", () => {
    const dir = repo();
    writeFileSync(path.join(dir, "arte-git-card.yml"), LEGACY, "utf8");
    const themePath = path.join(dir, ".arte-git-card", "themes", "arte-theme.yml");
    mkdirSync(path.dirname(themePath), { recursive: true });
    writeFileSync(themePath, "# user-edited\nname: my-theme\n", "utf8");
    const before = readFileSync(themePath, "utf8");
    const result = migrateRepository(dir);
    expect(result.materializedThemes).not.toContain(".arte-git-card/themes/arte-theme.yml");
    expect(readFileSync(themePath, "utf8")).toBe(before); // untouched
  });

  it("dry-run reports effects and writes nothing", () => {
    const dir = repo();
    writeFileSync(path.join(dir, "arte-git-card.yml"), LEGACY, "utf8");
    const result = migrateRepository(dir, { dryRun: true });
    expect(result.effects.length).toBeGreaterThan(0);
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card"))).toBe(false); // no lock side effect
  });

  it("throws when there is no legacy config", () => {
    const dir = repo();
    expect(() => migrateRepository(dir)).toThrow(/No legacy config/);
  });

  it("P1-11: a legacy SVG at an enabled-card destination → migration REFUSED with ZERO mutation", () => {
    const dir = repo();
    writeFileSync(path.join(dir, "arte-git-card.yml"), LEGACY, "utf8");
    // a legacy v1 generated SVG (v1 has NO ownership registry — never claim it)
    const svg = path.join(dir, ".github", "arte-git-card", "codebase.svg");
    mkdirSync(path.dirname(svg), { recursive: true });
    writeFileSync(svg, "<svg>legacy v1 output</svg>", "utf8");
    expect(() => migrateRepository(dir)).toThrow(/migration refused|already exists|not owned/i);
    // ZERO mutation: no v2 config, no state/theme dir created
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card"))).toBe(false);
    // legacy config + SVG preserved
    expect(existsSync(path.join(dir, "arte-git-card.yml"))).toBe(true);
    expect(readFileSync(svg, "utf8")).toBe("<svg>legacy v1 output</svg>");
  });

  it("clean v1 repo migrate → generates cards + records preset theme provenance, HEALTHY", () => {
    const dir = repo();
    writeFileSync(path.join(dir, "arte-git-card.yml"), LEGACY, "utf8");
    migrateRepository(dir);
    // immediately usable: cards exist
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"))).toBe(true);
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "structure.svg"))).toBe(true);
    // the materialized preset theme has a {kind:"theme"} provenance entry
    const state = JSON.parse(readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8")) as {
      managedFiles: Array<{ kind: string; path: string }>;
    };
    expect(state.managedFiles.some((e) => e.kind === "theme" && e.path === ".arte-git-card/themes/arte-theme.yml")).toBe(true);
    // repo is HEALTHY right after migrate
    expect(detectRepositoryState(dir).state).toBe("HEALTHY");
    // legacy config preserved
    expect(existsSync(path.join(dir, "arte-git-card.yml"))).toBe(true);
  });

  it("RB-1: a pre-existing state.json forging a legacy SVG as owned → migration REFUSED, nothing touched", () => {
    const dir = repo();
    writeFileSync(path.join(dir, "arte-git-card.yml"), LEGACY, "utf8");
    const svgAbs = path.join(dir, ".github", "arte-git-card", "codebase.svg");
    mkdirSync(path.dirname(svgAbs), { recursive: true });
    const svgBytes = "<svg>legacy v1 output</svg>";
    writeFileSync(svgAbs, svgBytes, "utf8");
    // stale/forged v2 state claims arte-gitcard OWNS that SVG — migrate must NOT
    // use it (v1 has no ownership registry; explicit regeneration must not reclaim).
    const statePath = writeValidState(dir, [
      { path: ".github/arte-git-card/codebase.svg", kind: "card", sha256: sha256Content(svgBytes) },
    ]);
    const stateBefore = readFileSync(statePath, "utf8");

    expect(() => migrateRepository(dir)).toThrow(/state\.json was found|legacy repository|refuses to trust/i);
    expect(readFileSync(svgAbs, "utf8")).toBe(svgBytes); // SVG untouched
    expect(readFileSync(statePath, "utf8")).toBe(stateBefore); // state untouched
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false); // no migration
    expect(existsSync(path.join(dir, ".arte-git-card", "themes", "arte-theme.yml"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card", "txn.json"))).toBe(false); // no journal/temp
  });

  it("RB-1: a valid pre-existing state.json (no SVG) still REFUSES migration (never overwrite unknown state)", () => {
    const dir = repo();
    writeFileSync(path.join(dir, "arte-git-card.yml"), LEGACY, "utf8");
    const statePath = writeValidState(dir, []);
    const stateBefore = readFileSync(statePath, "utf8");
    expect(() => migrateRepository(dir)).toThrow(/state\.json was found|legacy repository|refuses to trust/i);
    expect(readFileSync(statePath, "utf8")).toBe(stateBefore);
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false);
  });
});

describe("v1 structure.max_depth domain over the legacy parser (compat rule)", () => {
  it("legacy >5 is refused with explicit remediation — never clamped, never written", () => {
    const dir = repo();
    writeFileSync(path.join(dir, "arte-git-card.yml"), LEGACY.replace("max_depth: 3", "max_depth: 8"), "utf8");
    expect(() => migrateRepository(dir)).toThrow(/1\.\.5|max_depth/);
    // ZERO mutation: no v2 config, no state/theme, legacy preserved.
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card"))).toBe(false);
    expect(existsSync(path.join(dir, "arte-git-card.yml"))).toBe(true);
  });
});
