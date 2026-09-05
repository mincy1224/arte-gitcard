/**
 * Scanner exclusion semantics (SPEC §7) + Git-mode symlink handling (P0-2/P0-3).
 *
 * Exclude entries are EXACT segment / path / prefix rules — a bare `out` never
 * matches `about`/`stdout`, and a dotted name (`.github`, `.next`) is a plain
 * exact-name rule, never an inferred filename suffix. Filename-suffix rules
 * must be explicit `*.suffix` patterns.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { isExcludedFile, isExcludedDir } from "../../src/scanner/exclude.js";
import { scanRepository } from "../../src/scanner/index.js";

describe("exclude rules (SPEC §7) — exact segment/path, explicit *.suffix", () => {
  it('a bare "out" excludes the dir/file but never "about" / "stdout" / "out.ts"', () => {
    const opts = { exclude: ["out"] };
    expect(isExcludedFile("src/out/x.ts", opts)).toBe(true); // dir "out" at any depth
    expect(isExcludedFile("out", opts)).toBe(true); // file literally named "out"
    expect(isExcludedFile("src/about.ts", opts)).toBe(false); // substring, NOT a segment
    expect(isExcludedFile("src/stdout.ts", opts)).toBe(false);
    expect(isExcludedFile("src/out.ts", opts)).toBe(false);
    expect(isExcludedDir("src/out", opts)).toBe(true);
    expect(isExcludedDir("src", opts)).toBe(false);
  });

  it('dotted names (".github", ".next") are exact-segment rules, not suffixes', () => {
    const opts = { exclude: [".github", ".next"] };
    expect(isExcludedFile("src/.github/workflows/x.yml", opts)).toBe(true); // dir segment
    expect(isExcludedFile("src/.next/x.js", opts)).toBe(true);
    expect(isExcludedFile("src/foo.github", opts)).toBe(false); // no suffix inference
    expect(isExcludedFile("src/next.txt", opts)).toBe(false);
  });

  it('"*.suffix" patterns match the basename ending only', () => {
    const opts = { exclude: ["*.map", "*.min.js", "*.lock"] };
    expect(isExcludedFile("src/foo.map", opts)).toBe(true);
    expect(isExcludedFile("src/a/b/foo.min.js", opts)).toBe(true);
    expect(isExcludedFile("Cargo.lock", opts)).toBe(true);
    expect(isExcludedFile("src/about.mapx", opts)).toBe(false); // not a suffix
    expect(isExcludedDir("src", opts)).toBe(false); // suffix rules never prune dirs
  });

  it("exact filenames match the last segment (lock files, go.sum)", () => {
    const opts = { exclude: ["package-lock.json", "go.sum"] };
    expect(isExcludedFile("node_modules/pkg/package-lock.json", opts)).toBe(true);
    expect(isExcludedFile("go.sum", opts)).toBe(true);
    expect(isExcludedFile("src/go.sum2", opts)).toBe(false);
  });

  it("hard tool excludes (.git/.arte-git-card/both config names/owned workflow/output) always apply", () => {
    expect(isExcludedFile(".git/config")).toBe(true);
    expect(isExcludedFile("src/.git/HEAD")).toBe(true);
    expect(isExcludedFile("arte-git-card.yml")).toBe(true); // legacy name
    expect(isExcludedFile("arte-gitcard.yml")).toBe(true); // v2 name
    expect(isExcludedFile(".github/workflows/arte-gitcard.yml")).toBe(true); // owned workflow
    expect(isExcludedFile(".arte-git-card/themes/arte-theme.yml")).toBe(true);
    expect(isExcludedFile(".github/arte-git-card/codebase.svg", { outputDirs: [".github/arte-git-card"] })).toBe(true);
  });
});

describe("scanRepository — Git mode skips tracked symlinks (P0-2)", () => {
  let repo: string;
  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "arte-scan-"));
    execFileSync("git", ["init", "-q"], { cwd: repo, stdio: ["ignore", "ignore", "ignore"] });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repo, stdio: ["ignore", "ignore", "ignore"] });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: repo, stdio: ["ignore", "ignore", "ignore"] });
  });
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("a tracked symlink is skipped; real files are scanned", () => {
    mkdirSync(path.join(repo, "src"), { recursive: true });
    writeFileSync(path.join(repo, "src", "a.ts"), "const x = 1;\n", "utf8");

    // Create a tracked symlink pointing OUTSIDE the repo. Symlinks need
    // privilege (Windows without dev mode raises EPERM) — then we skip.
    let linkCreated = true;
    try {
      symlinkSync(path.join(repo, "..", "outside-target.txt"), path.join(repo, "src", "link.ts"), "file");
    } catch {
      linkCreated = false;
    }
    if (!linkCreated) return; // no symlink privilege on this host — nothing to assert

    execFileSync("git", ["add", "-A"], { cwd: repo, stdio: ["ignore", "ignore", "ignore"] });
    execFileSync("git", ["commit", "-m", "add"], { cwd: repo, stdio: ["ignore", "ignore", "ignore"], env: { ...process.env } });

    const result = scanRepository(repo);
    expect(result.git).toBe(true);
    const rels = result.files.map((f) => f.relative);
    expect(rels).toContain("src/a.ts");
    expect(rels).not.toContain("src/link.ts"); // symlink must never be read through
    expect(rels).not.toContain("link.ts");
  });
});
