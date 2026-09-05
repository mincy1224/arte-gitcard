/**
 * Global CLI options UX (Phase 3): --dry-run performs ZERO writes; --json emits
 * one parseable document on stdout (logs never pollute it); --quiet suppresses
 * informational lines; --no-color strips ANSI; -v is version.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { runCli, makeSrcRepo, cleanup } from "./util.js";

function hasAgcTemps(dir: string): boolean {
  const found: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d)) {
      const p = path.join(d, e);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (e.startsWith(".agc-")) found.push(e);
    }
  };
  try {
    walk(dir);
  } catch {
    /* ignore unreadable */
  }
  return found.length > 0;
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

describe("--dry-run", () => {
  it("config set --dry-run leaves the config untouched", () => {
    const dir = repo();
    const before = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    const out = runCli(dir, "--dry-run", "config", "set", "structure.max-depth", "4");
    expect(out).toContain("would write");
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toBe(before);
    expect(runCli(dir, "config get", "structure.max-depth")).toContain("3");
  });

  it("remove --dry-run does not disable or delete", () => {
    const dir = repo();
    const svg = path.join(dir, ".github", "arte-git-card", "structure.svg");
    runCli(dir, "--dry-run", "remove", "structure");
    expect(readFileSync(path.join(dir, ".github", "arte-git-card", "structure.svg"))).toBeTruthy();
    expect(runCli(dir, "config get", "structure.enabled")).toContain("true");
  });

  it("dry-run mutations leave ZERO lock/temp/config/state/file side effects", () => {
    const dir = repo();
    const stateBefore = readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8");
    const configBefore = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    runCli(dir, "--dry-run", "config", "set", "structure.max-depth", "4");
    runCli(dir, "--dry-run", "remove", "structure");
    // no lock, no transaction temp, config/state untouched, no file removed
    expect(existsSync(path.join(dir, ".arte-git-card", ".lock"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card", "txn.json"))).toBe(false);
    expect(readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8")).toBe(stateBefore);
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toBe(configBefore);
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "structure.svg"))).toBe(true);
    expect(hasAgcTemps(dir)).toBe(false);
  });

  it("init --dry-run writes nothing in an empty repo", () => {
    const dir = makeSrcRepo();
    dirs.push(dir);
    runCli(dir, "--dry-run", "init");
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card"))).toBe(false);
  });
});

describe("--json", () => {
  it("status --json emits a single parseable JSON document on stdout", () => {
    const dir = repo();
    const out = runCli(dir, "status", "--json");
    const doc = JSON.parse(out); // would throw if polluted
    expect(doc.state).toBe("HEALTHY");
    expect(doc.version).toBe("1.0.0");
    expect(Array.isArray(doc.cards)).toBe(true);
  });

  it("config list --json emits keys with kind/managedBy", () => {
    const dir = repo();
    const doc = JSON.parse(runCli(dir, "config", "list", "--json"));
    const auto = doc.find((r: { key: string }) => r.key === "auto-update");
    expect(auto.kind).toBe("lifecycle");
    expect(auto.managedBy).toContain("github");
  });
});

describe("--quiet / --no-color / -v", () => {
  it("--quiet suppresses informational output but keeps JSON usable", () => {
    const dir = repo();
    const json = runCli(dir, "status", "--quiet", "--json");
    expect(JSON.parse(json).state).toBeTruthy();
  });

  it("--no-color strips ANSI escapes", () => {
    const dir = repo();
    const plain = runCli(dir, "status", "--no-color");
    expect(plain).not.toMatch(/\[/);
  });

  it("-v prints the version", () => {
    const dir = repo();
    expect(runCli(dir, "-v").trim()).toBe("1.0.0");
  });
});
