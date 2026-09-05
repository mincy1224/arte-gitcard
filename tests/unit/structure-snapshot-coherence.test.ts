/**
 * Structure-description SNAPSHOT COHERENCE (explicit acceptance).
 *
 * One `planGenerateTxn` must use EXACTLY ONE description snapshot for:
 *   rendering (the Structure artifact overlay),
 *   prune/write/delete planning (the store op it stages),
 *   the optimistic transaction precondition (the sha it asserts on the store).
 *
 * This test simulates the store changing AFTER the plan was built (a concurrent
 * metadata edit between planning and apply): the precondition is the SAME
 * snapshot the render used, so applying must fail with ZERO mutation — the
 * plan can never silently render from version A while its mutation/precondition
 * reflects a different version, and never overwrite version B with version A.
 */

import { describe, expect, it, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { makeV2Repo } from "../helpers/repo.js";
import { loadConfig } from "../../src/config/load.js";
import { loadTheme } from "../../src/theme/load.js";
import { resolveTheme } from "../../src/theme/resolve.js";
import { planGenerateTxn } from "../../src/generate/manage.js";
import { runTransaction } from "../../src/txn/engine.js";
import { buildManagedGuard } from "../../src/state/guards.js";
import { sha256Content } from "../../src/fs/hash.js";
import { serializeStructureDescriptions } from "../../src/structure/descriptions.js";
import { STRUCTURE_DESCRIPTIONS_REL } from "../../src/managed/paths.js";

const dirs: string[] = [];
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "agc-coh-"));
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
function storePath(root: string): string {
  return path.join(root, STRUCTURE_DESCRIPTIONS_REL);
}
function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: ["ignore", "ignore", "ignore"] });
}

describe("planGenerateTxn uses one coherent description snapshot", () => {
  it("render overlay, staged store write and precondition all come from the SAME loaded snapshot; a later store edit is rejected with zero mutation", () => {
    const root = temp();
    git(root, ["init", "-q", "-b", "main"]);
    git(root, ["config", "user.email", "t@e.c"]);
    git(root, ["config", "user.name", "T"]);
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "a.ts"), "x\n", "utf8");
    git(root, ["add", "-A"]);
    git(root, ["commit", "-q", "-m", "seed"]);

    const fixture = makeV2Repo(root); // config/theme/state
    const loaded = loadConfig(fixture.configPath);
    const theme = resolveTheme(loadTheme(loaded.config.theme, loaded.projectRoot));

    // Version A store: "src" exists in the tree (renders); "gone" is STALE (its
    // directory left the repository) so the plan's prune removes it.
    const rawA = '{"schemaVersion":1,"descriptions":{"src":"核心","gone":"stale"}}\n';
    writeFileSync(storePath(root), rawA, "utf8");
    const versionASha = sha256Content(rawA);

    // Build the plan. This loads the snapshot ONCE, prunes it, and stages a
    // store write whose content == the pruned map, guarded by version A's sha.
    const { plan, planned, prunedDescriptions } = planGenerateTxn(root, loaded, theme);
    expect(prunedDescriptions).toBe(1); // "gone" pruned; the count is keys, not store ops

    // 1) store write/delete planning came from the SAME pruned snapshot.
    const storeWrite = plan.writes.find((w) => w.rel === STRUCTURE_DESCRIPTIONS_REL);
    expect(storeWrite).toBeDefined();
    expect(storeWrite!.content).toBe(serializeStructureDescriptions({ src: "核心" })); // "gone" pruned

    // 2) among the plan's optimistic preconditions, the STORE precondition
    //    asserts the OBSERVED version A bytes (config/state preconditions also
    //    exist now — P0-2 — but the store precondition is from this snapshot).
    expect(plan.preconditions).toBeDefined();
    const storePc = plan.preconditions!.find((p) => p.rel === STRUCTURE_DESCRIPTIONS_REL);
    expect(storePc).toEqual({
      kind: "sha256",
      rel: STRUCTURE_DESCRIPTIONS_REL,
      expectedSha256: versionASha,
    });

    // 3) the Structure artifact was rendered from the SAME version A snapshot.
    const structureSvg = planned.artifacts.find((a) => a.file === "structure.svg")!;
    expect(structureSvg.content).toContain("核心");
    expect(structureSvg.content).not.toContain("gone");

    // Simulate a concurrent metadata edit between planning and apply: version B.
    writeFileSync(storePath(root), '{"schemaVersion":1,"descriptions":{"src":"B"}}\n', "utf8");

    // Applying the version-A plan must fail closed — it can never combine a
    // version-A render with a version-B store, and never silently overwrite B.
    expect(() =>
      runTransaction(plan, {
        repoRoot: root,
        command: "coherence-apply",
        guard: buildManagedGuard(root, loaded.config),
      }),
    ).toThrow(/changed concurrently|Retry/);

    // ZERO mutation: nothing was written, version B is untouched.
    expect(existsSync(path.join(root, ".github", "arte-git-card", "structure.svg"))).toBe(false);
    expect(readFileSync(storePath(root), "utf8")).toBe('{"schemaVersion":1,"descriptions":{"src":"B"}}\n');
  });
});
