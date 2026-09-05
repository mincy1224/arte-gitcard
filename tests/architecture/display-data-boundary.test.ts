/**
 * FC-3/FC-7 internal data boundaries (LC-2 strengthened to RESOLVED module
 * targets):
 *  - Display builtins get repository data ONLY through ctx.statistics — no direct
 *    imports of scanner / structure/activity / codebase/analyze / state / txn /
 *    github / repo / generate / output/write / init/scaffold / config
 *    load|commit|root|migrate / fs-mutation / node:fs / node:child_process, and
 *    no process.cwd/env.
 *  - The guard validates RESOLVED module targets, not raw import strings: every
 *    relative specifier is resolved to its ACTUAL source file. The mixed/global
 *    public barrel src/index.ts is rejected outright (it re-exports
 *    scanRepository / analyzeCodebase / runGitActivity), and src/statistics/**
 *    is an APPROVED TERMINAL boundary — Statistics' own audited reader imports
 *    (scanner …) are never treated as Display imports.
 *  - Negative fixtures prove the resolved guard catches the public-barrel
 *    bypass and lets the statistics boundary pass.
 *  - the internal `legacyView` (mutable legacy seam) is importable ONLY by the
 *    two byte-locked legacy presenters (codebase, structure) inside display
 *    builtins (statistics built-ins may use it for their legacy analyzers).
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src");

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const abs = path.join(d, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(abs);
    }
  };
  walk(dir);
  return out;
}

function importSpecifiers(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const out: string[] = [];
  for (const m of text.matchAll(/(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/g)) {
    const spec = m[1]!;
    if (spec.startsWith(".")) out.push(spec);
    else if (spec.startsWith("node:")) out.push(spec);
  }
  return out;
}

/**
 * Resolve a relative import specifier to its ACTUAL source module under src/
 * (`.js` specifiers map to `.ts`/`.tsx` — ESM-style authoring over TS sources).
 * Throws when a specifier cannot be resolved so a silently-ignored import can
 * never hide behind a dead path.
 */
function resolveRelative(importerFile: string, spec: string): string {
  const fromDir = path.dirname(importerFile);
  const base = spec.endsWith(".js") ? spec.slice(0, -".js".length) : spec;
  const candidates = [base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx"];
  if (!spec.endsWith(".js")) candidates.unshift(base);
  for (const cand of candidates) {
    const abs = path.resolve(fromDir, cand);
    if (existsSync(abs)) return abs;
  }
  throw new Error(`display architecture: cannot resolve relative import "${spec}" from ${importerFile}`);
}

/** Resolved src-relative (posix) targets a Display must never reach directly. */
function isForbiddenTarget(rel: string): boolean {
  return (
    rel === "index.ts" || // mixed/global public barrel (re-exports scanner/analyze/activity)
    rel === "runtime.ts" ||
    rel.startsWith("scanner/") ||
    rel === "codebase/analyze.ts" ||
    rel === "structure/activity.ts" ||
    rel === "generate.ts" ||
    rel.startsWith("generate/") ||
    rel === "output/write.ts" ||
    rel === "init/scaffold.ts" ||
    rel.startsWith("repo/") ||
    rel.startsWith("state/") ||
    rel.startsWith("txn/") ||
    rel.startsWith("github/") ||
    rel.startsWith("fs/") ||
    rel === "config/load.ts" ||
    rel === "config/commit.ts" ||
    rel === "config/root.ts" ||
    rel === "config/migrate.ts"
  );
}

function isForbiddenNodeSpec(spec: string): boolean {
  return (
    spec === "node:fs" ||
    spec.startsWith("node:fs/") ||
    spec === "node:child_process" ||
    spec.startsWith("node:child_process/")
  );
}

/**
 * Validate a Display source file against the capability boundary by resolving
 * its DIRECT module targets. src/statistics/** is the approved terminal
 * boundary (a Display may reach it freely); everything forbidden is matched on
 * the RESOLVED module, so barrels and renamed paths cannot bypass the guard.
 */
function capabilityViolationsOf(entryFile: string): string[] {
  const violations = new Set<string>();
  for (const spec of importSpecifiers(entryFile)) {
    if (spec.startsWith(".")) {
      const target = resolveRelative(entryFile, spec);
      const rel = toPosix(path.relative(srcRoot, target));
      if (rel === ".." || rel.startsWith("../")) continue; // outside src/ — not a Display capability
      if (rel.startsWith("statistics/")) continue; // approved terminal capability boundary
      if (isForbiddenTarget(rel)) violations.add(rel);
    } else if (spec.startsWith("node:")) {
      if (isForbiddenNodeSpec(spec)) violations.add(spec);
    }
    // bare third-party specifiers (zod …) are allowed terminals.
  }
  return [...violations].sort();
}

const displayBuiltins = collectFiles(path.join(srcRoot, "display", "builtin"));
const statisticBuiltins = collectFiles(path.join(srcRoot, "statistics", "builtin"));
const capabilityFixtures = collectFiles(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "display-capability"),
);

describe("FC-7/LC-2: Display repository data ONLY through Statistics", () => {
  it("every real display builtin resolves clean — no forbidden/barrel module target", () => {
    expect(displayBuiltins.length).toBeGreaterThan(0);
    for (const file of displayBuiltins) {
      const rel = path.relative(srcRoot, file).replace(/\\/g, "/");
      expect(capabilityViolationsOf(file), `${rel} must resolve to no forbidden module target`).toEqual([]);
    }
  });

  it("the resolved guard FAILS the public barrel and PASSES statistics", () => {
    const fixture = (name: string) =>
      capabilityFixtures.find((f) => path.basename(f) === name) ??
      (() => {
        throw new Error(`missing fixture ${name}`);
      })();

    expect(capabilityViolationsOf(fixture("index-barrel.ts"))).toContain("index.ts"); // FAIL — public barrel
    expect(capabilityViolationsOf(fixture("statistics-reader.ts"))).toEqual([]); // PASS — statistics terminal
  });

  it("display builtins never read process.cwd()/process.env to find the repo", () => {
    for (const file of displayBuiltins) {
      const rel = path.relative(srcRoot, file).replace(/\\/g, "/");
      const text = readFileSync(file, "utf8");
      expect(text.includes("process.cwd("), `${rel} must not read process.cwd()`).toBe(false);
      expect(text.includes("process.env"), `${rel} must not read process.env`).toBe(false);
    }
  });

  it("statistics builtins never use raw node:fs / child_process / process state", () => {
    for (const file of statisticBuiltins) {
      const rel = path.relative(srcRoot, file).replace(/\\/g, "/");
      for (const spec of importSpecifiers(file)) {
        expect(spec.includes("node:fs"), `${rel} imports node:fs`).toBe(false);
        expect(spec.includes("node:child_process"), `${rel} imports node:child_process`).toBe(false);
      }
      const text = readFileSync(file, "utf8");
      expect(text.includes("process.cwd("), `${rel} must not read process.cwd()`).toBe(false);
      expect(text.includes("process.env"), `${rel} must not read process.env`).toBe(false);
    }
  });
});

describe("FC-3: legacyView stays a narrow seam", () => {
  it("only codebase + structure legacy presenters may import the internal legacy seam", () => {
    const users = displayBuiltins
      .filter((f) => readFileSync(f, "utf8").includes("legacy-internal"))
      .map((f) => path.relative(srcRoot, f).replace(/\\/g, "/"))
      .sort();
    expect(users).toEqual([
      "display/builtin/codebase/presenter.ts",
      "display/builtin/structure/presenter.ts",
    ]);
  });
});
