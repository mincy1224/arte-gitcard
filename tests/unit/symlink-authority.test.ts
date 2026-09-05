/**
 * P0-1 strict no-symlink/junction authority + transaction cleanup hardening.
 *
 * NO arte-gitcard mutation/control path may traverse an existing symlink/
 * junction component — even when the link target stays inside the repo. A
 * symlinked `.arte-git-card` (e.g. -> `src`) or `.github` must fail BEFORE any
 * staging/lock/journal I/O through the redirect, never overwriting a source file.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runTransaction } from "../../src/txn/engine.js";
import { recoverTransaction } from "../../src/txn/recover.js";
import { emptyPlan } from "../../src/txn/plan.js";
import { readStructureDescriptions } from "../../src/structure/descriptions.js";
import { readState } from "../../src/state/registry.js";

const dirs: string[] = [];
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "agc-sym-"));
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

function tryLink(target: string, link: string): boolean {
  try {
    symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
    return true;
  } catch {
    return false;
  }
}

describe("strict no-symlink mutation authority", () => {
  it(".arte-git-card symlink -> in-repo source: write fails before staging; source untouched", (ctx) => {
    const root = temp();
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "keep.txt"), "x\n", "utf8");
    if (!tryLink(path.join(root, "src"), path.join(root, ".arte-git-card"))) {
      process.stderr.write("[symlink-authority] skipping: symlink privilege unavailable\n");
      ctx.skip();
      return;
    }
    const rel = ".arte-git-card/ci/main.cjs";
    const plan = emptyPlan();
    plan.writes.push({ rel, abs: path.join(root, rel), content: "payload", kind: "card" });
    expect(() => runTransaction(plan, { repoRoot: root, command: "symlink-test" })).toThrow(/symlink/);
    // no source file overwritten; no staging created through the redirect
    expect(existsSync(path.join(root, "src", "ci", "main.cjs"))).toBe(false);
    expect(existsSync(path.join(root, "src", "keep.txt"))).toBe(true);
    expect(lstatSync(path.join(root, ".arte-git-card")).isSymbolicLink()).toBe(true);
    expect(readdirSync(path.join(root, "src"))).not.toContain(".agc-"); // no temp through redirect
  });

  it(".arte-git-card symlink -> OUTSIDE directory: fails closed, outside untouched", (ctx) => {
    const root = temp();
    const outside = temp();
    writeFileSync(path.join(outside, "sentinel.txt"), "keep\n", "utf8");
    if (!tryLink(outside, path.join(root, ".arte-git-card"))) {
      process.stderr.write("[symlink-authority] skipping: symlink privilege unavailable\n");
      ctx.skip();
      return;
    }
    const plan = emptyPlan();
    plan.writes.push({ rel: ".arte-git-card/state.json", abs: path.join(root, ".arte-git-card", "state.json"), content: "{}", kind: "state" });
    expect(() => runTransaction(plan, { repoRoot: root, command: "symlink-out" })).toThrow(/symlink/);
    expect(readdirSync(outside)).toEqual(["sentinel.txt"]); // nothing written outside
  });

  it(".github symlink -> in-repo source: card write fails closed before staging", (ctx) => {
    const root = temp();
    mkdirSync(path.join(root, ".arte-git-card"), { recursive: true }); // real control dir for the lock
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "keep.txt"), "x\n", "utf8");
    if (!tryLink(path.join(root, "src"), path.join(root, ".github"))) {
      process.stderr.write("[symlink-authority] skipping: symlink privilege unavailable\n");
      ctx.skip();
      return;
    }
    const rel = ".github/arte-git-card/codebase.svg";
    const plan = emptyPlan();
    plan.writes.push({ rel, abs: path.join(root, rel), content: "<svg/>", kind: "card" });
    expect(() => runTransaction(plan, { repoRoot: root, command: "symlink-github" })).toThrow(/symlink/);
    expect(existsSync(path.join(root, "src", "arte-git-card", "codebase.svg"))).toBe(false);
    expect(readdirSync(path.join(root, "src"))).toEqual(["keep.txt"]);
  });

  it("description-store reads refuse a symlinked .arte-git-card (no trust through the redirect)", (ctx) => {
    const root = temp();
    mkdirSync(path.join(root, "src"), { recursive: true });
    // `.arte-git-card` -> `src` redirects the store read onto src/structure-descriptions.json
    writeFileSync(path.join(root, "src", "structure-descriptions.json"), '{"schemaVersion":1,"descriptions":{}}\n', "utf8");
    if (!tryLink(path.join(root, "src"), path.join(root, ".arte-git-card"))) {
      process.stderr.write("[symlink-authority] skipping: symlink privilege unavailable\n");
      ctx.skip();
      return;
    }
    expect(() => readStructureDescriptions(root)).toThrow(/symlink|junction/);
  });

  it("recoverTransaction fails on a symlinked .arte-git-card BEFORE touching .lock/journal", (ctx) => {
    const root = temp();
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "keep.txt"), "x\n", "utf8");
    if (!tryLink(path.join(root, "src"), path.join(root, ".arte-git-card"))) {
      process.stderr.write("[symlink-authority] skipping: symlink privilege unavailable\n");
      ctx.skip();
      return;
    }
    expect(() => recoverTransaction(root)).toThrow(/symlink/);
    // nothing was created through the redirect
    expect(existsSync(path.join(root, "src", ".lock"))).toBe(false);
    expect(existsSync(path.join(root, "src", "txn.json"))).toBe(false);
    expect(readdirSync(path.join(root, "src"))).toEqual(["keep.txt"]);
    expect(lstatSync(path.join(root, ".arte-git-card")).isSymbolicLink()).toBe(true);
  });

  it("state reads report a symlinked .arte-git-card as CORRUPT (never trusted for authority)", (ctx) => {
    const root = temp();
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "state.json"), '{"schemaVersion":2,"toolVersion":"1","managedFiles":[],"outputRoots":[]}', "utf8");
    if (!tryLink(path.join(root, "src"), path.join(root, ".arte-git-card"))) {
      process.stderr.write("[symlink-authority] skipping: symlink privilege unavailable\n");
      ctx.skip();
      return;
    }
    expect(readState(root).status).toBe("corrupt");
  });
});

describe("transaction cleanup hardening: race before first apply leaves no orphan journal", () => {
  it("a first-apply failure cleans this transaction's staging + journal (retryable)", () => {
    const root = temp();
    mkdirSync(path.join(root, ".arte-git-card"), { recursive: true });
    const plan = emptyPlan();
    plan.writes.push({ rel: "x.txt", abs: path.join(root, "x.txt"), content: "hello", kind: "card" });
    // Guard: allow prepare (1 call) then DENY the first apply-time invocation —
    // nothing is ever committed, so the transaction must clean up after itself.
    let calls = 0;
    const guard = () => {
      calls += 1;
      return calls <= 1;
    };
    expect(() => runTransaction(plan, { repoRoot: root, command: "race-before-apply", guard })).toThrow(/not managed/);
    expect(existsSync(path.join(root, ".arte-git-card", "txn.json"))).toBe(false); // no orphan journal
    expect(existsSync(path.join(root, "x.txt"))).toBe(false); // nothing applied
    const leftovers = readdirSync(path.join(root, ".arte-git-card")).filter((f) => f !== "txn.json");
    expect(leftovers.every((f) => !f.startsWith(".agc-"))).toBe(true); // no staging residue
  });
});
