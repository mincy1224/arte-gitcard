/**
 * P0-2 optimistic read-set: config/state are loaded and plans are built BEFORE
 * runTransaction acquires the repo lock, so two arte-gitcard mutations can
 * build stale plans. The optimistic config+state preconditions must make the
 * SECOND stale operation fail with a retry instead of recreating an integration
 * another command just disabled.
 *
 * Deterministic scenario (github disable vs github sync):
 *   - enable, then create OWNERSHIP drift (wrong entry kind, bytes fine) so a
 *     sync plan has real writes;
 *   - build the sync plan FIRST (pre-disable snapshot);
 *   - apply github disable (removes workflow/action/runtime, config auto=false);
 *   - applying the STALE pre-disable sync plan must fail closed (config/state
 *     precondition mismatch) and must NOT recreate the integration.
 */

import { describe, expect, it, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { makeV2Repo } from "../helpers/repo.js";
import { loadConfig } from "../../src/config/load.js";
import { githubEnable, githubDisable, buildGithubSyncPlan } from "../../src/github/manage.js";
import { runTransaction } from "../../src/txn/engine.js";
import { buildManagedGuard } from "../../src/state/guards.js";

const dirs: string[] = [];
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "agc-race-"));
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
function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: ["ignore", "ignore", "ignore"] });
}
function readStateOf(root: string): { github?: { defaultBranch?: string } } {
  return JSON.parse(readFileSync(path.join(root, ".arte-git-card", "state.json"), "utf8"));
}

function makeEnabledRepo(): { work: string; bundle: string } {
  const work = temp();
  const bare = temp();
  git(bare, ["init", "--bare", "-q", "-b", "main"]);
  git(work, ["init", "-q", "-b", "main"]);
  git(work, ["config", "user.email", "t@e.c"]);
  git(work, ["config", "user.name", "T"]);
  mkdirSync(path.join(work, "src"), { recursive: true });
  writeFileSync(path.join(work, "src", "a.ts"), "x\n", "utf8");
  git(work, ["add", "-A"]);
  git(work, ["commit", "-q", "-m", "seed"]);
  git(work, ["remote", "add", "origin", bare]);
  git(work, ["push", "-q", "-u", "origin", "main"]);
  makeV2Repo(work);
  const bundle = path.join(temp(), "main.cjs");
  writeFileSync(bundle, "// runtime-bundle\n", "utf8");
  const cfg = loadConfig(path.join(work, "arte-gitcard.yml"));
  githubEnable(work, cfg, { ciBundlePath: bundle });
  return { work, bundle };
}

describe("P0-2 config/state optimistic read-set prevents stale read-modify-write", () => {
  it("a stale pre-disable sync plan fails with retry and never recreates the integration", () => {
    const { work, bundle: bundleV1 } = makeEnabledRepo();
    // A NEWER runtime bundle gives the sync plan REAL file writes (desired
    // runtime bytes differ from what enable installed) without blocking disable
    // (the on-disk file still matches its ownership hash).
    const bundleV2 = path.join(temp(), "main.cjs");
    writeFileSync(bundleV2, "// runtime-bundle-v2\n", "utf8");

    const enabledCfg = loadConfig(path.join(work, "arte-gitcard.yml"));
    // B builds its stale sync plan from the PRE-disable snapshot (would re-vendor
    // workflow/action/runtime + state to the v2 bundle).
    const sync = buildGithubSyncPlan(work, enabledCfg, { ciBundlePath: bundleV2 });
    expect(sync.changed).toBe(true);

    // A runs first: github disable removes the integration + flips config false.
    githubDisable(work, enabledCfg);
    expect(loadConfig(path.join(work, "arte-gitcard.yml")).config["auto-update"]).toBe(false);
    expect(readStateOf(work).github).toBeUndefined();

    // B tries to apply its stale plan → config/state precondition mismatch → retry.
    expect(() =>
      runTransaction(sync.plan, {
        repoRoot: work,
        command: "stale-sync-apply",
        guard: buildManagedGuard(work, enabledCfg.config),
      }),
    ).toThrow(/changed concurrently|Retry/);

    // The repository is INTERNALLY CONSISTENT: nothing was recreated.
    expect(existsSync(path.join(work, ".github", "workflows", "arte-gitcard.yml"))).toBe(false);
    expect(loadConfig(path.join(work, "arte-gitcard.yml")).config["auto-update"]).toBe(false);
  });
});
