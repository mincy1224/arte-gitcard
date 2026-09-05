/**
 * Theme manager CLI integration (Phase 5): install from local file, duplicate
 * refusal, preset materialization via select, config+regenerate in one
 * transaction, selected-removal refusal, modified preserve.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runCli, runCliFail, makeSrcRepo, cleanup } from "./util.js";

const dirs: string[] = [];
function repo(): string {
  const d = makeSrcRepo();
  dirs.push(d);
  runCli(d, "init");
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) cleanup(d);
});

function failText(dir: string, ...args: string[]): string {
  const f = runCliFail(dir, ...args);
  return f.stdout + f.stderr;
}

const PARTIAL = "name: tokyo-night\npalette:\n  accent: \"#111111\"\n";

function writeSource(dir: string): string {
  const p = path.join(dir, "tokyo-night.yml");
  writeFileSync(p, PARTIAL, "utf8");
  return p;
}

describe("theme CLI", () => {
  it("list shows the init-materialized default + installable presets", () => {
    const dir = repo();
    const out = runCli(dir, "theme list");
    expect(out).toContain("arte-theme");
    expect(out).toContain("[selected]"); // init default is selected
    expect(out).toContain("github-theme");
  });

  it("install (local file) → select → regenerate; duplicate refused", () => {
    const dir = repo();
    const src = writeSource(dir);
    runCli(dir, "theme install", src);
    const cfgAfterInstall = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    expect(cfgAfterInstall).not.toContain("tokyo-night"); // install does not change selection
    // duplicate refused
    expect(failText(dir, "theme install", src)).toContain("already installed");

    const selectOut = runCli(dir, "theme select", "tokyo-night");
    expect(selectOut).toContain("selected theme \"tokyo-night\"");
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toContain("tokyo-night.yml");
    expect(runCli(dir, "theme list")).toContain("tokyo-night  [selected]");
    expect(runCli(dir, "status")).toContain("OK");
    // theme select regenerated the cards under the new theme (structure.svg exists again)
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "structure.svg"))).toBe(true);
  });

  it("select preset materializes it on demand", () => {
    const dir = repo();
    expect(existsSync(path.join(dir, ".arte-git-card", "themes", "github-theme.yml"))).toBe(false);
    runCli(dir, "theme select", "github-theme");
    expect(existsSync(path.join(dir, ".arte-git-card", "themes", "github-theme.yml"))).toBe(true);
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toContain("github-theme.yml");
    expect(runCli(dir, "status")).toContain("OK");
  });

  it("remove: refuses the selected theme; removes an unselected one; preserves modified", () => {
    const dir = repo();
    const src = writeSource(dir);
    runCli(dir, "theme install", src);
    runCli(dir, "theme select", "tokyo-night");
    // selected → refused
    expect(failText(dir, "theme remove", "tokyo-night")).toContain("selected");
    // switch back to arte-theme, then remove tokyo-night
    runCli(dir, "theme select", "arte-theme");
    runCli(dir, "theme remove", "tokyo-night");
    expect(existsSync(path.join(dir, ".arte-git-card", "themes", "tokyo-night.yml"))).toBe(false);
  });

  it("modified installed theme is preserved on remove", () => {
    const dir = repo();
    const src = writeSource(dir);
    runCli(dir, "theme install", src);
    writeFileSync(path.join(dir, ".arte-git-card", "themes", "tokyo-night.yml"), "# user edit\nname: tokyo-night\n", "utf8");
    const fail = runCliFail(dir, "theme remove", "tokyo-night");
    expect(fail.stdout + fail.stderr).toMatch(/preserved|modified/i);
    expect(existsSync(path.join(dir, ".arte-git-card", "themes", "tokyo-night.yml"))).toBe(true);
  });

  it("validate command accepts a valid partial file and rejects a bad one", () => {
    const dir = repo();
    const good = writeSource(dir);
    expect(runCli(dir, "theme validate", good)).toContain("theme ok");
    const bad = path.join(dir, "bad.yml");
    writeFileSync(bad, "palette:\n  accent: not-hex\n", "utf8");
    expect(failText(dir, "theme validate", bad)).toMatch(/invalid theme/i);
  });
});

describe("theme install CLI state gate (P1-5)", () => {
  it("theme install fails closed with zero writes when state.json is MISSING", () => {
    const dir = repo();
    const src = writeSource(dir);
    rmSync(path.join(dir, ".arte-git-card", "state.json"));
    expect(failText(dir, "theme install", src)).toMatch(/state\.json is missing|cannot prove ownership|fail closed/i);
    expect(existsSync(path.join(dir, ".arte-git-card", "themes", "tokyo-night.yml"))).toBe(false);
  });

  it("theme install fails closed with zero writes when state.json is CORRUPT", () => {
    const dir = repo();
    const src = writeSource(dir);
    writeFileSync(path.join(dir, ".arte-git-card", "state.json"), "{ corrupt", "utf8");
    expect(failText(dir, "theme install", src)).toMatch(/state\.json is corrupt|cannot prove ownership|fail closed/i);
    expect(existsSync(path.join(dir, ".arte-git-card", "themes", "tokyo-night.yml"))).toBe(false);
  });

  it("theme install fails closed with zero writes when state.json is INCOMPATIBLE", () => {
    const dir = repo();
    const src = writeSource(dir);
    writeFileSync(
      path.join(dir, ".arte-git-card", "state.json"),
      JSON.stringify({ schemaVersion: 99, toolVersion: "x", managedFiles: [], outputRoots: [] }),
      "utf8",
    );
    expect(failText(dir, "theme install", src)).toMatch(/state\.json is incompatible|cannot prove ownership|fail closed/i);
    expect(existsSync(path.join(dir, ".arte-git-card", "themes", "tokyo-night.yml"))).toBe(false);
  });
});
