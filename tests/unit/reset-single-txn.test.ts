/**
 * P1-2 regression: `reset` is ONE transaction. If ANY phase of the plan fails
 * (here: card planning throws), NOTHING may have been committed — config, theme,
 * state and card files stay byte-identical and no lock/journal is left behind.
 * (The old two-transaction reset committed config/theme/state first and only then
 * regenerated cards, so a late generation failure left a half-reset repo.)
 */

import { describe, expect, it, afterEach } from "vitest";
import { vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("../../src/generate/plan.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/generate/plan.js")>();
  return {
    ...actual,
    planCardArtifactsInternal: vi.fn((...args: Parameters<typeof actual.planCardArtifactsInternal>) => {
      if ((globalThis as { __AGC_RESET_BOOM__?: boolean }).__AGC_RESET_BOOM__ === true) {
        throw new Error("boom: injected card-planning failure");
      }
      return actual.planCardArtifactsInternal(...args);
    }),
  };
});

import { resetRepository } from "../../src/lifecycle/reset.js";
import { seedHealthyRepo } from "../helpers/repo.js";

const dirs: string[] = [];
function temp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agc-reset-"));
  dirs.push(dir);
  return dir;
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

function snapshot(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const abs = path.join(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs);
      else if (st.isFile()) out.set(path.relative(root, abs).split(path.sep).join("/"), readFileSync(abs, "utf8"));
    }
  };
  walk(root);
  return out;
}

describe("resetRepository is a single transaction", () => {
  it("injected planning failure → ZERO changes (no half-reset, no lock/journal)", () => {
    const root = temp();
    seedHealthyRepo(root);
    const before = snapshot(root);

    (globalThis as { __AGC_RESET_BOOM__?: boolean }).__AGC_RESET_BOOM__ = true;
    expect(() => resetRepository(root)).toThrow(/boom/);
    (globalThis as { __AGC_RESET_BOOM__?: boolean }).__AGC_RESET_BOOM__ = false;

    // Everything is byte-identical.
    expect(snapshot(root)).toEqual(before);
    // runTransaction was never reached → no lock/journal residue.
    expect(existsSync(path.join(root, ".arte-git-card", ".lock"))).toBe(false);
    expect(existsSync(path.join(root, ".arte-git-card", "txn.json"))).toBe(false);
  });
});
