/**
 * doctor offline cached origin/HEAD diagnostic (no misleading remediation).
 *
 * The local `refs/remotes/origin/HEAD` is cache only: after a GitHub default
 * rename (main -> trunk) `github sync` correctly converges state + workflow to
 * the AUTHORITATIVE ls-remote value, but Git's local origin/HEAD may stay stale.
 * doctor must stay HEALTHY, remain offline, and never tell the user that
 * `github sync` can repair Git's own cache.
 */

import { describe, expect, it, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { makeV2Repo } from "../helpers/repo.js";
import { loadConfig } from "../../src/config/load.js";
import { githubEnable, githubSync } from "../../src/github/manage.js";
import { buildDoctorReport } from "../../src/lifecycle/doctor.js";

const dirs: string[] = [];
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "agc-doctor-"));
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

/** Enable on origin default main, then rename the remote default to trunk and sync. */
function renamedToTrunk(): { work: string } {
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
  githubEnable(work, loadConfig(path.join(work, "arte-gitcard.yml")), { ciBundlePath: bundle });

  // GitHub default branch main -> trunk (authoritative HEAD on the bare origin).
  git(work, ["push", "-q", "origin", "HEAD:refs/heads/trunk"]);
  git(bare, ["symbolic-ref", "HEAD", "refs/heads/trunk"]);
  const loaded = loadConfig(path.join(work, "arte-gitcard.yml"));
  githubSync(work, loaded, { ciBundlePath: bundle });
  return { work };
}

const joined = (work: string): string => buildDoctorReport(work).lines.join("\n");
const stateOf = (work: string): string => buildDoctorReport(work).report.state;

describe("doctor cached origin/HEAD diagnostic", () => {
  it("1: snapshot=trunk + stale cache=main → HEALTHY, offline, no `github sync` suggestion", () => {
    const { work } = renamedToTrunk();
    // Local origin/HEAD is stale (still main) — Git cache only.
    git(work, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);

    const doctor = buildDoctorReport(work);
    expect(doctor.report.github.branch).toBe("trunk"); // sync used the authoritative value
    const out = doctor.lines.join("\n");
    expect(stateOf(work)).toBe("HEALTHY");
    expect(out).not.toMatch(/github sync/); // no remediation for an offline Git cache
    expect(out).toMatch(/cache may be stale/); // informational, non-actionable
  });

  it("2: matching cache stays normal", () => {
    const { work } = renamedToTrunk();
    git(work, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/trunk"]);
    const out = joined(work);
    expect(stateOf(work)).toBe("HEALTHY");
    expect(out).not.toMatch(/cache may be stale/);
    expect(out).not.toMatch(/github sync/);
  });

  it("3: absent cached origin/HEAD stays normal", () => {
    const { work } = renamedToTrunk();
    git(work, ["update-ref", "-d", "refs/remotes/origin/HEAD"]);
    const out = joined(work);
    expect(stateOf(work)).toBe("HEALTHY");
    expect(out).not.toMatch(/cache may be stale/);
    expect(out).not.toMatch(/github sync/);
  });
});
