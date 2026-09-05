/**
 * Dynamic completion engine unit tests (Phase 7, P0). Candidate sets are
 * STATE-AWARE (config / installed themes / git refs), strictly read-only, and
 * degrade safely on damaged config. language remove returns CUSTOM ids only.
 * Protocol safety (Release Gate): candidates never carry newline/CR/NUL; shell
 * wrappers never eval / word-split.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import YAML from "yaml";
import { candidates, nonOptionWords, isSafeCandidate } from "../../src/completion/engine.js";
import { SHELL_SCRIPTS } from "../../src/completion/shells.js";
import { makeV2Repo, seedHealthyRepo } from "../helpers/repo.js";
import { installTheme } from "../../src/thememgr/index.js";

const dirs: string[] = [];
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "agc-complete-"));
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

describe("static command candidates", () => {
  it("top-level commands", () => {
    expect(candidates([])).toContain("status");
    expect(candidates(["ge"])).toContain("generate");
  });
  it("group leaves", () => {
    expect(candidates(["theme", "sel"])).toContain("select");
    expect(candidates(["completion", "ba"])).toContain("bash");
  });
  it("option flags", () => {
    expect(candidates(["--dry"])).toContain("--dry-run");
  });
});

describe("state-aware dynamic candidates", () => {
  it("theme select/show -> installed + presets; remove -> installed minus selected", () => {
    const root = seedHealthyRepo(temp()).root;
    const src = path.join(temp(), "custom.yml");
    writeFileSync(src, "name: custom\npalette:\n  accent: \"#123456\"\n", "utf8");
    installTheme(root, src);
    const select = candidates(["theme", "select", ""], root);
    expect(select).toContain("custom");
    expect(select).toContain("github-theme"); // preset materializable
    const remove = candidates(["theme", "remove", ""], root);
    expect(remove).toContain("custom");
    expect(remove).not.toContain("arte-theme"); // selected default excluded
    expect(remove).not.toContain("github-theme"); // preset not installed
  });

  it("add -> not-yet-enabled cards; remove -> enabled cards", () => {
    const root = seedHealthyRepo(temp()).root; // both enabled
    expect(candidates(["add", ""], root)).toEqual([]);
    expect(candidates(["remove", ""], root).sort()).toEqual(["codebase", "structure"]);
  });

  it("config get -> all keys; set/reset -> TUNING keys only (lifecycle excluded)", () => {
    const root = seedHealthyRepo(temp()).root;
    expect(candidates(["config", "get", ""], root)).toContain("auto-update");
    const set = candidates(["config", "set", ""], root);
    expect(set).toContain("structure.max-depth");
    expect(set).not.toContain("auto-update");
    expect(set).not.toContain("theme");
  });

  it("exclude remove -> current config.exclude entries", () => {
    const root = seedHealthyRepo(temp()).root;
    const cfgPath = path.join(root, "arte-gitcard.yml");
    const doc = YAML.parse(readFileSync(cfgPath, "utf8"));
    doc.exclude = ["node_modules", "vendor"];
    writeFileSync(cfgPath, YAML.stringify(doc), "utf8");
    expect(candidates(["exclude", "remove", "no"], root)).toContain("node_modules");
    expect(candidates(["exclude", "remove", "zzz"], root)).toEqual([]);
  });

  it("language remove -> CUSTOM ids only (builtins never removable); show -> builtin + custom", () => {
    const root = seedHealthyRepo(temp()).root;
    const cfgPath = path.join(root, "arte-gitcard.yml");
    const doc = YAML.parse(readFileSync(cfgPath, "utf8"));
    doc.languages = [{ id: "tsx", name: "TSX", extensions: [".tsx"], comments: { line: ["//"] } }];
    writeFileSync(cfgPath, YAML.stringify(doc), "utf8");

    const show = candidates(["language", "show", ""], root);
    expect(show).toContain("typescript"); // builtin visible
    expect(show).toContain("tsx"); // custom visible
    const remove = candidates(["language", "remove", ""], root);
    expect(remove).toContain("tsx");
    expect(remove).not.toContain("typescript"); // builtin NOT removable
  });

  it("github group completes enable/disable/status/sync — the `branch` command was removed", () => {
    const root = temp();
    const b = candidates(["github", ""], root);
    expect(b).toContain("enable");
    expect(b).toContain("disable");
    expect(b).toContain("status");
    expect(b).toContain("sync");
    expect(b).not.toContain("branch");
  });
});

describe("safe degradation + read-only", () => {
  it("damaged config degrades safely", () => {
    const root = makeV2Repo(temp()).root;
    writeFileSync(path.join(root, "arte-gitcard.yml"), "schema-version: 2\ncards: [broken\n", "utf8");
    expect(candidates([""], root)).toContain("status"); // static unaffected
    expect(candidates(["config", "get", ""], root)).toContain("structure.max-depth"); // static registry
    expect(candidates(["add", ""], root)).toEqual([]); // config-dependent → empty, no crash
    expect(candidates(["remove", ""], root)).toEqual([]);
  });

  it("completion is strictly read-only (no lock/temp/state writes)", () => {
    const root = seedHealthyRepo(temp()).root;
    candidates(["theme", "select", ""], root);
    candidates(["config", "set", ""], root);
    expect(existsSync(path.join(root, ".arte-git-card", ".lock"))).toBe(false);
    expect(existsSync(path.join(root, ".arte-git-card", "txn.json"))).toBe(false);
  });

  it("nonOptionWords strips option flags and their values", () => {
    expect(nonOptionWords(["--repo", "/x", "theme", "select"])).toEqual(["theme", "select"]);
    expect(nonOptionWords(["theme", "--repo", "/x", "select"])).toEqual(["theme", "select"]);
  });
});

describe("completion protocol safety (Release Gate)", () => {
  it("candidates carrying newline/CR/NUL are DROPPED before the one-per-line stream", () => {
    const NL = "\n";
    const CR = "\r";
    const NUL = String.fromCharCode(0);
    const root = seedHealthyRepo(temp()).root;
    const cfgPath = path.join(root, "arte-gitcard.yml");
    const doc = YAML.parse(readFileSync(cfgPath, "utf8"));
    doc.exclude = ["safe-pattern", "bad" + NL + "line", "cr" + CR + "line", "nul" + NUL + "line"];
    doc.languages = [{ id: "evil" + NL + "id", name: "X", extensions: [".x"], comments: { line: ["//"] } }];
    writeFileSync(cfgPath, YAML.stringify(doc), "utf8");

    const excludeOut = candidates(["exclude", "remove", ""], root);
    expect(excludeOut).toContain("safe-pattern");
    expect(excludeOut.every(isSafeCandidate)).toBe(true);
    expect(excludeOut).not.toContain("bad" + NL + "line");
    expect(excludeOut).not.toContain("cr" + CR + "line");
    expect(excludeOut).not.toContain("nul" + NUL + "line");

    const langOut = candidates(["language", "remove", ""], root);
    expect(langOut.every(isSafeCandidate)).toBe(true); // "evil\nid" filtered out
    expect(langOut).not.toContain("evil" + NL + "id");
  });

  it("shell wrappers treat candidates as plain strings — no eval / no word-splitting", () => {
    for (const script of Object.values(SHELL_SCRIPTS)) {
      expect(script).not.toMatch(/\beval\b/);
      expect(script).not.toContain("compgen -W");
      expect(script).toContain("__complete");
    }
  });
});
