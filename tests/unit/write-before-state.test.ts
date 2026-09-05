/**
 * WriteOp expected-before policy (plan-time → prepare protection).
 *
 * A planned write may carry the before-state observed during manager preflight.
 * The engine verifies it under the repo lock BEFORE staging:
 *  - expected ABSENT  → a file that appeared after preflight is preserved;
 *  - expected sha256  → a file edited after preflight is preserved;
 *  - no expectation   → deliberate regeneration may reclaim/overwrite.
 */

import { describe, expect, it, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runTransaction } from "../../src/txn/engine.js";
import { emptyPlan } from "../../src/txn/plan.js";
import { sha256Content } from "../../src/fs/hash.js";

const dirs: string[] = [];
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "agc-before-"));
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

function mkRepo(): string {
  const root = temp();
  mkdirSync(path.join(root, ".arte-git-card", "themes"), { recursive: true });
  return root;
}

describe("WriteOp expected-before policy", () => {
  it("expected ABSENT but a user file appeared after preflight → preserved, transaction fails", () => {
    const root = mkRepo();
    const rel = ".arte-git-card/themes/foo.yml";
    const plan = emptyPlan();
    plan.writes.push({
      rel,
      abs: path.join(root, rel),
      content: "# theme\n",
      kind: "theme",
      expectedBefore: { kind: "absent" }, // preflight said absent
    });
    // A user creates the file between preflight and transaction start.
    writeFileSync(path.join(root, rel), "# user\n", "utf8");
    expect(() => runTransaction(plan, { repoRoot: root, command: "theme-install" })).toThrow(/appeared after planning/);
    expect(readFileSync(path.join(root, rel), "utf8")).toBe("# user\n"); // preserved
  });

  it("expected sha256 but the file changed after preflight → preserved, transaction fails", () => {
    const root = mkRepo();
    const rel = ".arte-git-card/themes/foo.yml";
    writeFileSync(path.join(root, rel), "# original\n", "utf8");
    const expected = { kind: "sha256" as const, sha256: sha256Content("# original\n") };
    const plan = emptyPlan();
    plan.writes.push({
      rel,
      abs: path.join(root, rel),
      content: "# new\n",
      kind: "theme",
      expectedBefore: expected,
    });
    writeFileSync(path.join(root, rel), "# user-edit\n", "utf8"); // after preflight
    expect(() => runTransaction(plan, { repoRoot: root, command: "theme-install" })).toThrow(/changed after planning/);
    expect(readFileSync(path.join(root, rel), "utf8")).toBe("# user-edit\n");
  });

  it("expected sha256 matching lets the write proceed", () => {
    const root = mkRepo();
    const rel = ".arte-git-card/themes/foo.yml";
    writeFileSync(path.join(root, rel), "# original\n", "utf8");
    const plan = emptyPlan();
    plan.writes.push({
      rel,
      abs: path.join(root, rel),
      content: "# new\n",
      kind: "theme",
      expectedBefore: { kind: "sha256", sha256: sha256Content("# original\n") },
    });
    runTransaction(plan, { repoRoot: root, command: "theme-install" });
    expect(readFileSync(path.join(root, rel), "utf8")).toBe("# new\n");
  });

  it("NO expectation (deliberate regeneration) may overwrite an existing owned target", () => {
    const root = mkRepo();
    const rel = "card.svg";
    writeFileSync(path.join(root, rel), "old\n", "utf8");
    const plan = emptyPlan();
    plan.writes.push({ rel, abs: path.join(root, rel), content: "new\n", kind: "card" }); // no expectedBefore
    runTransaction(plan, { repoRoot: root, command: "regenerate" });
    expect(readFileSync(path.join(root, rel), "utf8")).toBe("new\n");
  });
});
