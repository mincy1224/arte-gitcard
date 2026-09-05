/**
 * Strict v2 config loading (P0): NO deepMerge of defaults. Missing fields,
 * wrong types, unknown keys → ConfigError{reason:'strict-fail'}. Legacy config
 * → reason 'v1'; unsupported version → 'unsupported-version'; bad YAML →
 * 'invalid-yaml'. Existing configs are never silently repaired.
 */

import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfig, ConfigError } from "../../src/config/load.js";

const dirs: string[] = [];

function repo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agc-load-"));
  dirs.push(dir);
  return dir;
}

function write(root: string, content: string): string {
  const p = path.join(root, "arte-gitcard.yml");
  writeFileSync(p, content, "utf8");
  return p;
}

const V2_FULL = `schema-version: 2
cards:
  codebase: { enabled: true, languages: { include_comments: false } }
  structure: { enabled: true, root: ".", max_depth: 3, activity_days: 7,
    commits: { enabled: true }, changes: { enabled: true } }
theme: ".arte-git-card/themes/arte-theme.yml"
output: { directory: ".github/arte-git-card" }
auto-update: false
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

function expectReason(fn: () => unknown, reason: string): void {
  let err: ConfigError | null = null;
  try {
    fn();
  } catch (e) {
    err = e as ConfigError;
  }
  expect(err).toBeInstanceOf(ConfigError);
  expect(err!.reason).toBe(reason);
}

describe("strict v2 loadConfig", () => {
  it("loads a complete v2 config without any merging", () => {
    const root = repo();
    const cfgPath = write(root, V2_FULL);
    const loaded = loadConfig(cfgPath);
    expect(loaded.config["schema-version"]).toBe(2);
    expect(loaded.config["auto-update"]).toBe(false);
    expect(loaded.config).not.toHaveProperty("github"); // config never owns the branch
    expect(loaded.projectRoot).toBe(root);
  });

  it("an unknown `github:` top-level key → strict-fail (the default branch is never config)", () => {
    const root = repo();
    const cfgPath = write(root, V2_FULL + "github:\n  branch: main\n");
    expectReason(() => loadConfig(cfgPath), "strict-fail");
  });

  it("a legacy v1 config (no schema-version) → reason 'v1'", () => {
    const root = repo();
    const cfgPath = write(
      root,
      `cards:
  codebase: { enabled: true, languages: { include_comments: false } }
  structure: { enabled: true, root: ".", max_depth: 3, activity_days: 7,
    commits: { enabled: true }, changes: { enabled: true } }
theme: "arte-theme"
output: { directory: ".github/arte-git-card" }
`,
    );
    expectReason(() => loadConfig(cfgPath), "v1");
  });

  it("an unsupported schema-version → reason 'unsupported-version'", () => {
    const root = repo();
    const cfgPath = write(root, V2_FULL.replace("schema-version: 2", "schema-version: 3"));
    expectReason(() => loadConfig(cfgPath), "unsupported-version");
  });

  it("invalid YAML → reason 'invalid-yaml'", () => {
    const root = repo();
    const cfgPath = write(root, "cards: [unclosed\n  :\n");
    expectReason(() => loadConfig(cfgPath), "invalid-yaml");
  });

  it("a missing required field (auto-update) → strict-fail, NOT silently defaulted", () => {
    const root = repo();
    // Without auto-update a v1 deepMerge would have supplied a default; v2 refuses.
    const cfgPath = write(root, V2_FULL.replace("auto-update: false\n", ""));
    expectReason(() => loadConfig(cfgPath), "strict-fail");
  });

  it("an unknown top-level key → strict-fail", () => {
    const root = repo();
    const cfgPath = write(root, V2_FULL + "extra: true\n");
    expectReason(() => loadConfig(cfgPath), "strict-fail");
  });

  it("a wrong-typed field → strict-fail with an actionable message naming the field", () => {
    const root = repo();
    const cfgPath = write(root, V2_FULL.replace("max_depth: 3", "max_depth: many"));
    let err: ConfigError | null = null;
    try {
      loadConfig(cfgPath);
    } catch (e) {
      err = e as ConfigError;
    }
    expect(err).toBeInstanceOf(ConfigError);
    expect(err!.reason).toBe("strict-fail");
    expect(err!.message).toContain("cards.structure.max_depth");
  });
});
