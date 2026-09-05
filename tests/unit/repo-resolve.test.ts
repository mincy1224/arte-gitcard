/**
 * Repository resolver (P0): --repo takes priority; inside a Git work tree the
 * git root is the boundary and config discovery NEVER crosses it (a nested repo
 * must not resolve to the parent's config). Non-git dirs walk up for a config.
 */

import { describe, expect, it, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveProjectRoot } from "../../src/repo/resolve.js";

const dirs: string[] = [];

function temp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agc-resolve-"));
  dirs.push(dir);
  return dir;
}

function gitInit(dir: string): void {
  execFileSync("git", ["init", "-q"], { cwd: dir, stdio: ["ignore", "ignore", "ignore"] });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir, stdio: ["ignore", "ignore", "ignore"] });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir, stdio: ["ignore", "ignore", "ignore"] });
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

describe("resolveProjectRoot", () => {
  it("--repo takes priority over the cwd", () => {
    const explicit = temp();
    const cwd = temp();
    const r = resolveProjectRoot(cwd, { repo: explicit });
    expect(r.root).toBe(explicit);
  });

  it("--repo with a nonexistent path throws", () => {
    expect(() => resolveProjectRoot(process.cwd(), { repo: path.join(temp(), "nope") })).toThrow(/does not exist/);
  });

  it("inside a git repo with a config → root = git toplevel, config found", () => {
    const repo = temp();
    gitInit(repo);
    mkdirSync(path.join(repo, "sub"), { recursive: true });
    writeFileSync(path.join(repo, "arte-gitcard.yml"), "schema-version: 2\n", "utf8");
    const r = resolveProjectRoot(path.join(repo, "sub"));
    expect(r.root).toBe(repo);
    expect(r.gitRoot).toBe(repo);
    expect(r.configPath).toBe(path.join(repo, "arte-gitcard.yml"));
  });

  it("inside a git repo without a config → root = git toplevel, config null", () => {
    const repo = temp();
    gitInit(repo);
    const r = resolveProjectRoot(repo);
    expect(r.root).toBe(repo);
    expect(r.configPath).toBeNull();
  });

  it("a nested git repo NEVER crosses the git boundary into the parent config", () => {
    const parent = temp();
    gitInit(parent);
    writeFileSync(path.join(parent, "arte-gitcard.yml"), "schema-version: 2\n", "utf8");
    const child = path.join(parent, "child");
    mkdirSync(child, { recursive: true });
    gitInit(child);
    const r = resolveProjectRoot(child);
    // Must not resolve to the PARENT's config (that would let a mutation act on
    // the wrong repository).
    expect(r.root).toBe(child);
    expect(r.gitRoot).toBe(child);
    expect(r.configPath).toBeNull();
  });

  it("not in git: walks up to a config dir and uses it as root", () => {
    const dir = temp();
    mkdirSync(path.join(dir, "a", "b"), { recursive: true });
    writeFileSync(path.join(dir, "arte-gitcard.yml"), "schema-version: 2\n", "utf8");
    const r = resolveProjectRoot(path.join(dir, "a", "b"));
    expect(r.root).toBe(dir);
    expect(r.gitRoot).toBeNull();
    expect(r.configPath).toBe(path.join(dir, "arte-gitcard.yml"));
  });

  it("not in git without a config → root falls back to start", () => {
    const dir = temp();
    const r = resolveProjectRoot(dir);
    expect(r.root).toBe(dir);
    expect(r.configPath).toBeNull();
  });

  it("legacy config is discovered too (LEGACY state detection) when in a git repo", () => {
    const repo = temp();
    gitInit(repo);
    writeFileSync(path.join(repo, "arte-git-card.yml"), "cards: {}\n", "utf8");
    const r = resolveProjectRoot(repo);
    expect(r.configPath).toBe(path.join(repo, "arte-git-card.yml"));
  });
});
