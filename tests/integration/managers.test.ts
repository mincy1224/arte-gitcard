/**
 * Typed managers integration (Phase 3): config set/get/reset (typed, lifecycle
 * keys refused, invalid values rejected before write), output.directory
 * relocation (moves owned artifacts + records both roots), exclude add/remove,
 * language add/remove/show with builtin protection.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runCli, runCliFail, makeSrcRepo, cleanup } from "./util.js";
import { sha256Content } from "../../src/fs/hash.js";

/** Create a BROKEN symlink at `linkAbs` (target created then removed). */
function brokenSymlinkAt(linkAbs: string): boolean {
  try {
    mkdirSync(path.dirname(linkAbs), { recursive: true });
    const real = path.join(path.dirname(linkAbs), `.agc-link-${Math.random().toString(36).slice(2)}`);
    mkdirSync(real, { recursive: true });
    symlinkSync(real, linkAbs, "junction");
    rmSync(real, { recursive: true, force: true }); // break the link
    return lstatSync(linkAbs).isSymbolicLink();
  } catch {
    return false; // no symlink privilege on this host
  }
}

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

function stateJson(dir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8"));
}

describe("config (typed)", () => {
  it("set → get → reset round-trips a tuning key", () => {
    const dir = repo();
    runCli(dir, "config set", "structure.max-depth", "4");
    expect(runCli(dir, "config get", "structure.max-depth")).toContain("4");
    runCli(dir, "config reset", "structure.max-depth");
    expect(runCli(dir, "config get", "structure.max-depth")).toContain("3");
  });

  it("rejects an out-of-range value BEFORE any write", () => {
    const dir = repo();
    const fail = runCliFail(dir, "config set", "structure.max-depth", "99");
    expect(fail.stdout + fail.stderr).toContain("integer in 1..5");
    expect(runCli(dir, "config get", "structure.max-depth")).toContain("3"); // unchanged
  });

  it("rejects a lifecycle-managed key (theme/auto-update/enabled) — no bypass", () => {
    const dir = repo();
    const out = (dir0: string, ...a: string[]): string => {
      const f = runCliFail(dir0, ...a);
      return f.stdout + f.stderr;
    };
    expect(out(dir, "config set", "auto-update", "true")).toContain("github enable");
    expect(out(dir, "config set", "theme", "github-theme")).toContain("theme select");
    expect(out(dir, "config set", "codebase.enabled", "false")).toContain("add");
    // config reset is refused for lifecycle keys too
    expect(out(dir, "config reset", "auto-update")).toContain("github enable");
    expect(out(dir, "config reset", "theme")).toContain("theme select");
    // nothing changed on disk
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).not.toContain("auto-update: true");
  });

  it("rejects an unknown key", () => {
    const dir = repo();
    const f = runCliFail(dir, "config set", "cards.structure.foo", "1");
    expect(f.stdout + f.stderr).toContain("unknown config key");
  });

  it("config list reports lifecycle-managed keys with their dedicated command", () => {
    const dir = repo();
    const out = runCli(dir, "config list");
    expect(out).toContain("auto-update");
    expect(out).toContain("github enable/disable");
    expect(out).toContain("structure.max-depth");
  });
});

describe("output.directory relocation", () => {
  it("moves owned cards to the new directory, cleans the old dir, records both roots", () => {
    const dir = repo();
    const oldDir = path.join(dir, ".github", "arte-git-card");
    expect(existsSync(path.join(oldDir, "codebase.svg"))).toBe(true);
    const out = runCli(dir, "config set", "output.directory", "docs/cards");
    expect(out).toContain("wrote docs/cards/codebase.svg");
    expect(out).toContain("removed .github/arte-git-card/codebase.svg");
    expect(existsSync(path.join(dir, "docs", "cards", "codebase.svg"))).toBe(true);
    expect(existsSync(path.join(dir, "docs", "cards", "structure.svg"))).toBe(true);
    expect(existsSync(path.join(oldDir, "codebase.svg"))).toBe(false); // old owned moved away
    expect(existsSync(oldDir)).toBe(true); // the OLD DIRECTORY is not recursively removed
    const roots = (stateJson(dir).outputRoots as string[]).sort();
    expect(roots).toEqual([".github/arte-git-card", "docs/cards"]);
  });

  it("relocation fails BEFORE any mutation when the new target holds an unowned file", () => {
    const dir = repo();
    const configBefore = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    const newTarget = path.join(dir, "docs", "cards", "codebase.svg");
    mkdirSync(path.dirname(newTarget), { recursive: true });
    writeFileSync(newTarget, "<svg>someone else's file</svg>", "utf8");
    const fail = runCliFail(dir, "config set", "output.directory", "docs/cards");
    expect(fail.stdout + fail.stderr).toMatch(/not owned|collision|Refusing/i);
    // nothing changed: config, old owned cards, and the unowned file all intact
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toBe(configBefore);
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"))).toBe(true);
    expect(readFileSync(newTarget, "utf8")).toBe("<svg>someone else's file</svg>");
  });

  it("does NOT move a user-modified owned card (preserved with warning)", () => {
    const dir = repo();
    const svg = path.join(dir, ".github", "arte-git-card", "structure.svg");
    writeFileSync(svg, "user changed me", "utf8");
    const out = runCli(dir, "config set", "output.directory", "docs/cards");
    expect(out).toContain("preserved (not moved)");
    expect(readFileSync(svg, "utf8")).toBe("user changed me"); // still where it was
  });

  it("config reset output.directory relocates (same lifecycle as config set)", () => {
    const dir = repo();
    runCli(dir, "config set", "output.directory", "docs/cards");
    expect(existsSync(path.join(dir, "docs", "cards", "codebase.svg"))).toBe(true);
    // reset back to the default output directory
    const out = runCli(dir, "config reset", "output.directory");
    expect(out).toContain("wrote .github/arte-git-card/codebase.svg");
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"))).toBe(true);
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "structure.svg"))).toBe(true);
    expect(existsSync(path.join(dir, "docs", "cards", "codebase.svg"))).toBe(false); // old owned cleaned
    const roots = (stateJson(dir).outputRoots as string[]).sort();
    expect(roots).toEqual([".github/arte-git-card", "docs/cards"]);
    expect(runCli(dir, "status")).toContain("OK");
  });

  it("relocation regenerates a missing old card so the NEW output is complete", () => {
    const dir = repo();
    // delete the default structure card (owned but missing on disk → drift)
    rmSync(path.join(dir, ".github", "arte-git-card", "structure.svg"));
    const out = runCli(dir, "config set", "output.directory", "docs/cards");
    expect(out).toContain("wrote docs/cards/codebase.svg");
    expect(existsSync(path.join(dir, "docs", "cards", "codebase.svg"))).toBe(true);
    expect(existsSync(path.join(dir, "docs", "cards", "structure.svg"))).toBe(true); // regenerated
    expect(runCli(dir, "status")).toContain("OK");
  });

  it("relocation regenerates into the new dir while preserving a modified old card (ownership dropped)", () => {
    const dir = repo();
    const oldSvg = path.join(dir, ".github", "arte-git-card", "structure.svg");
    writeFileSync(oldSvg, "user changed me", "utf8");
    const out = runCli(dir, "config set", "output.directory", "docs/cards");
    expect(out).toContain("preserved (not moved)");
    expect(readFileSync(oldSvg, "utf8")).toBe("user changed me"); // preserved bytes
    // the NEW output still gets a complete regenerated card
    expect(existsSync(path.join(dir, "docs", "cards", "structure.svg"))).toBe(true);
    // ownership of the old (preserved) file is dropped from state
    const state = stateJson(dir) as { managedFiles: Array<{ path: string; kind: string }> };
    expect(state.managedFiles.some((e) => e.path === ".github/arte-git-card/structure.svg" && e.kind === "card")).toBe(false);
    expect(runCli(dir, "status")).toContain("OK");
  });

  it("relocation REFUSES a new-target file that is owned-but-user-modified (no silent overwrite)", () => {
    const dir = repo();
    const configBefore = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    // craft an owned-but-modified file at the DESTINATION
    const target = path.join(dir, "docs", "cards", "codebase.svg");
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, "someone edited the destination", "utf8");
    const statePath = path.join(dir, ".arte-git-card", "state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8")) as {
      managedFiles: Array<Record<string, string>>;
    };
    state.managedFiles.push({ path: "docs/cards/codebase.svg", kind: "card", sha256: sha256Content("original bytes") });
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");

    const fail = runCliFail(dir, "config set", "output.directory", "docs/cards");
    expect(fail.stdout + fail.stderr).toMatch(/modified|Refusing|refus/i);
    expect(readFileSync(target, "utf8")).toBe("someone edited the destination"); // untouched
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toBe(configBefore); // config unchanged
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"))).toBe(true); // old cards intact
  });

  it("RB-3: relocation REFUSES a broken-symlink DESTINATION (zero mutation, no staging/journal)", () => {
    const dir = repo();
    const configBefore = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    const stateBefore = readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8");
    const oldCodebase = readFileSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"), "utf8");
    const target = path.join(dir, "docs", "cards", "codebase.svg");
    if (!brokenSymlinkAt(target)) return; // no symlink privilege on this host
    const fail = runCliFail(dir, "config set", "output.directory", "docs/cards");
    expect(fail.stdout + fail.stderr).toMatch(/not owned|exists|collision|Refus/i);
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toBe(configBefore);
    expect(readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8")).toBe(stateBefore);
    expect(readFileSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"), "utf8")).toBe(oldCodebase);
    expect(existsSync(path.join(dir, ".arte-git-card", "txn.json"))).toBe(false); // never staged/journaled
    expect(lstatSync(target).isSymbolicLink()).toBe(true); // symlink preserved
  });
});

describe("exclude", () => {
  it("add → list → remove round-trips and reset restores defaults", () => {
    const dir = repo();
    runCli(dir, "exclude add", "build-out");
    expect(runCli(dir, "exclude list")).toContain("build-out");
    runCli(dir, "exclude remove", "build-out");
    expect(runCli(dir, "exclude list")).not.toContain("build-out");
    const dup = runCliFail(dir, "exclude add", "out");
    expect(dup.stdout + dup.stderr).toContain("already excluded"); // default present
    runCli(dir, "exclude reset");
  });
});

describe("language", () => {
  it("add custom, list shows it, show works, remove works; builtins cannot be removed", () => {
    const dir = repo();
    runCli(dir, "language add", "tsx", "--name", "TSX", "--extensions", ".tsx,.ts", "--line-comment", "//");
    expect(runCli(dir, "language list")).toContain("tsx\tcustom");
    expect(runCli(dir, "language show", "tsx")).toContain("TSX");
    const builtin = runCliFail(dir, "language remove", "typescript");
    expect(builtin.stdout + builtin.stderr).toContain("built-in");
    runCli(dir, "language remove", "tsx");
    expect(runCli(dir, "language list")).not.toContain("tsx");
  });

  it("refuses to add a language rule without the required --name (nothing written)", () => {
    const dir = repo();
    const fail = runCliFail(dir, "language add", "bad");
    expect(fail.stdout + fail.stderr).toContain("--name is required");
    expect(runCli(dir, "language list")).not.toContain("bad");
  });
});
