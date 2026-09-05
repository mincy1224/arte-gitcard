/**
 * Completion CLI integration (Phase 7): __complete stdout carries ONLY
 * machine-readable candidates (no ANSI/log pollution); dynamic candidates are
 * state-aware (installed themes, config, git refs); language remove only lists
 * custom ids; damaged config degrades safely; __complete is strictly read-only
 * (no lock/temp); preceding --repo is honored.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { runCli, makeSrcRepo, cleanup } from "./util.js";

function git(cwd: string, args: string[], env: Record<string, string> = {}): void {
  execFileSync("git", args, { cwd, stdio: ["ignore", "ignore", "ignore"], env: { ...process.env, ...env } });
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

describe("__complete stdout discipline", () => {
  it("stdout is candidates only (one per line, no ANSI/log lines)", () => {
    const dir = repo();
    const out = runCli(dir, "__complete", "theme", "");
    expect(out.split("\n").filter(Boolean).length).toBeGreaterThan(0);
    for (const line of out.trim().split("\n")) {
      expect(line).not.toMatch(/\[/); // no ANSI
      expect(line).not.toMatch(/^✖|^✓|^ℹ/); // no log prefixes
    }
  });

  it("__complete is read-only: no lock / no transaction temp created", () => {
    const dir = repo();
    runCli(dir, "__complete", "theme", "select", "");
    runCli(dir, "__complete", "config", "set", "");
    expect(existsSync(path.join(dir, ".arte-git-card", ".lock"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card", "txn.json"))).toBe(false);
  });
});

describe("state-aware dynamic candidates via CLI", () => {
  it("theme select lists installed themes + presets after install", () => {
    const dir = repo();
    const src = path.join(dir, "custom.yml");
    writeFileSync(src, "name: custom\npalette:\n  accent: \"#123456\"\n", "utf8");
    runCli(dir, "theme", "install", src);
    const out = runCli(dir, "__complete", "theme", "select", "");
    expect(out.split("\n")).toContain("custom");
    expect(out.split("\n")).toContain("github-theme");
  });

  it("language remove lists ONLY custom ids (no builtin typescript)", () => {
    const dir = repo();
    runCli(dir, "language", "add", "tsx", "--name", "TSX", "--extensions", ".tsx", "--line-comment", "//");
    const out = runCli(dir, "__complete", "language", "remove", "");
    const lines = out.split("\n").filter(Boolean);
    expect(lines).toContain("tsx");
    expect(lines).not.toContain("typescript");
  });

  it("config set completes tuning keys (no lifecycle keys)", () => {
    const dir = repo();
    const out = runCli(dir, "__complete", "config", "set", "");
    const lines = out.split("\n").filter(Boolean);
    expect(lines).toContain("structure.max-depth");
    expect(lines).not.toContain("auto-update");
    expect(lines).not.toContain("theme");
  });

  it("github group completes enable/disable/status/sync (the branch command is gone)", () => {
    const dir = repo();
    const out = runCli(dir, "__complete", "github", "");
    const lines = out.split("\n").filter(Boolean);
    expect(lines).toContain("enable");
    expect(lines).toContain("disable");
    expect(lines).toContain("status");
    expect(lines).toContain("sync");
    expect(lines).not.toContain("branch");
  });
});

describe("--repo + damaged config", () => {
  it("preceding --repo resolves candidates from THAT repo", () => {
    const a = repo();
    const src = path.join(a, "custom.yml");
    writeFileSync(src, "name: custom\npalette:\n  accent: \"#123456\"\n", "utf8");
    runCli(a, "theme", "install", src);
    const b = repo(); // unrelated repo (cwd for the completion call)
    const out = runCli(b, "__complete", "--repo", a, "theme", "select", "");
    expect(out.split("\n")).toContain("custom"); // resolved from repo a, not b
  });

  it("damaged config degrades safely (static keys complete; card-dependent empty)", () => {
    const dir = repo();
    writeFileSync(path.join(dir, "arte-gitcard.yml"), "schema-version: 2\ncards: [broken\n", "utf8");
    const keys = runCli(dir, "__complete", "config", "get", "").split("\n").filter(Boolean);
    expect(keys).toContain("structure.max-depth"); // static registry still completes
    expect(runCli(dir, "__complete", "remove", "").trim()).toBe(""); // config-dependent → empty
    expect(runCli(dir, "__complete", "s")).toContain("status"); // static command path fine
  });
});
