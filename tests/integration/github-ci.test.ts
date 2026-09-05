/**
 * GitHub CI integration (Phase 6): temporary git repo + LOCAL BARE REMOTE +
 * simulated GitHub environment. No github.com access, no real token.
 * Exercises the real vendored runtime (node dist/ci/main.cjs) end-to-end:
 * change→push (allowlist-only commit), no-change skip, wrong-branch/deletion/
 * wrong-event skip, remote-advanced skip, push-rejection real error,
 * pre-existing user-staged files excluded, disable all-or-nothing, sync local
 * only, package.json "type":"module".
 */

import { describe, expect, it, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCli, runCliFail, CLI } from "./util.js";

const dirs: string[] = [];
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "agc-github-"));
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

const CI_RUNTIME = path.resolve("dist/ci/main.cjs");

function git(cwd: string, args: string[], env: Record<string, string> = {}): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "ignore"],
  })
    .trim();
}

interface Repo {
  bare: string;
  work: string;
}

function makeRemoteRepo(extraPkgTypeModule = false): Repo {
  const base = temp();
  const bare = path.join(base, "remote.git");
  const work = path.join(base, "work");
  git(base, ["init", "--bare", "-q", "-b", "main", "remote.git"]);
  git(base, ["clone", "-q", "remote.git", "work"]);
  git(work, ["config", "user.email", "dev@example.com"]);
  git(work, ["config", "user.name", "Dev"]);
  mkdirSync(path.join(work, "src"), { recursive: true });
  writeFileSync(path.join(work, "src", "main.ts"), "const x = 1;\n// c\n\n", "utf8");
  if (extraPkgTypeModule) writeFileSync(path.join(work, "package.json"), '{ "type": "module" }\n', "utf8");
  // `enable` resolves the default branch AUTHORITATIVELY via ls-remote, so the
  // origin must already advertise a real default branch (a pushed commit).
  git(work, ["add", "-A"]);
  git(work, ["commit", "-q", "-m", "initial"]);
  git(work, ["push", "-q", "-u", "origin", "main"]);
  return { bare, work };
}

function initAndEnable(r: Repo): string {
  runCli(r.work, "init");
  const out = runCli(r.work, "github", "enable");
  expect(out).toContain("enabled auto-update");
  git(r.work, ["add", "-A"]);
  git(r.work, ["commit", "-q", "-m", "base: init + enable"]);
  git(r.work, ["push", "-q", "origin", "main"]);
  return git(r.work, ["rev-parse", "HEAD"]);
}

function makeChangeCommit(r: Repo, msg: string): string {
  writeFileSync(path.join(r.work, "src", "main.ts"), "const x = 1;\nconst y = 2;\nconst z = 3;\n// c\n\n", "utf8");
  git(r.work, ["add", "-A"]);
  git(r.work, ["commit", "-q", "-m", msg]);
  git(r.work, ["push", "-q", "origin", "main"]);
  return git(r.work, ["rev-parse", "HEAD"]);
}

interface CiResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runCi(
  r: Repo,
  opts: { after?: string; ref?: string; refName?: string; deleted?: boolean; eventName?: string; defaultBranch?: string } = {},
): CiResult {
  const head = opts.after ?? git(r.work, ["rev-parse", "HEAD"]);
  const ref = opts.ref ?? "refs/heads/main";
  const defaultBranch = opts.defaultBranch ?? "main";
  const eventPath = path.join(r.work, ".event.json");
  writeFileSync(
    eventPath,
    JSON.stringify({
      ref,
      deleted: opts.deleted ?? false,
      after: head,
      before: "0".repeat(40),
      repository: { default_branch: defaultBranch },
    }),
    "utf8",
  );
  const sp = spawnSync(process.execPath, [CI_RUNTIME], {
    cwd: r.work,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: opts.eventName ?? "push",
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REF: ref,
      GITHUB_REF_NAME: opts.refName ?? defaultBranch,
      GITHUB_SHA: head,
      GITHUB_WORKSPACE: r.work,
    },
  });
  return { code: sp.status ?? 1, stdout: sp.stdout ?? "", stderr: sp.stderr ?? "" };
}

function remoteHead(r: Repo): string {
  return git(r.work, ["ls-remote", "origin", "refs/heads/main"]).split(/\s+/)[0] ?? "";
}

function lastCommitFiles(r: Repo): string[] {
  const sha = remoteHead(r);
  if (!sha) return [];
  const out = git(r.work, ["--git-dir", r.bare, "show", "--name-only", "--format=", sha]);
  return out.split("\n").filter(Boolean);
}

describe("CI runtime against a local bare remote", () => {
  it("a real change is regenerated and pushed as an allowlist-only bot commit", () => {
    const r = makeRemoteRepo();
    initAndEnable(r);
    const y = makeChangeCommit(r, "feat: add code");
    expect(remoteHead(r)).toBe(y);
    const res = runCi(r, { after: y });
    expect(res.stderr + res.stdout).toContain("pushed");
    expect(res.code).toBe(0);
    // concise phase logs are part of the supported operational behavior
    expect(res.stderr).toContain('arte-gitcard-ci: event accepted: default branch "main"');
    expect(res.stderr).toMatch(/arte-gitcard-ci: generated \d+ card artifact\(s\)/);
    const after = remoteHead(r);
    expect(after).not.toBe(y);
    const files = lastCommitFiles(r);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f === ".arte-git-card/state.json" || f.startsWith(".github/arte-git-card/")).toBe(true);
    }
    expect(git(r.work, ["--git-dir", r.bare, "log", "-1", "--format=%s"])).toBe("chore(arte-gitcard): update cards");
    const author = git(r.work, ["--git-dir", r.bare, "log", "-1", "--format=%an <%ae>"]);
    expect(author).toContain("github-actions[bot]");
  });

  it("no change → no empty commit (remote stays put)", () => {
    const r = makeRemoteRepo();
    initAndEnable(r);
    const y = makeChangeCommit(r, "feat: add code");
    runCi(r, { after: y }); // first run pushes Z
    const z = remoteHead(r);
    const res = runCi(r, { after: z });
    expect(res.code).toBe(0);
    expect(res.stderr + res.stdout).toMatch(/no changes/);
    expect(remoteHead(r)).toBe(z);
  });

  it("wrong branch / deletion / wrong event → skip (exit 0, no push)", () => {
    const r = makeRemoteRepo();
    initAndEnable(r);
    const y = makeChangeCommit(r, "feat: add code");
    const before = remoteHead(r);
    expect(runCi(r, { after: y, ref: "refs/heads/other", refName: "other" }).code).toBe(0);
    expect(runCi(r, { after: y, deleted: true }).code).toBe(0);
    expect(runCi(r, { after: y, eventName: "pull_request" }).code).toBe(0);
    expect(remoteHead(r)).toBe(before);
  });

  it("remote advanced → stale result skipped (no push, no force)", () => {
    const r = makeRemoteRepo();
    initAndEnable(r);
    const y = makeChangeCommit(r, "feat: add code");
    // advance the remote from a second clone so remote != y
    const base = temp();
    git(base, ["clone", "-q", r.bare, "c2"]);
    const c2 = path.join(base, "c2");
    git(c2, ["config", "user.email", "o@e.c"]);
    git(c2, ["config", "user.name", "O"]);
    git(c2, ["commit", "-q", "--allow-empty", "-m", "someone else pushed"]);
    git(c2, ["push", "-q", "origin", "main"]);
    const moved = remoteHead(r);
    expect(moved).not.toBe(y);
    const res = runCi(r, { after: y });
    expect(res.code).toBe(0);
    expect(res.stderr + res.stdout).toMatch(/remote moved|skipping/);
    expect(remoteHead(r)).toBe(moved);
  });

  it("remote branch DELETED is never recreated (stale success, no push)", () => {
    const r = makeRemoteRepo();
    initAndEnable(r);
    const y = makeChangeCommit(r, "feat: add code");
    expect(remoteHead(r)).toBe(y);
    // Simulate the remote branch being deleted (a bare's HEAD cannot be deleted
    // via push, so remove the ref directly — the CI run's pre-push `ls-remote`
    // will then see the target ref ABSENT).
    git(r.work, ["--git-dir", r.bare, "update-ref", "-d", "refs/heads/main"]);
    expect(remoteHead(r)).toBe("");
    const res = runCi(r, { after: y });
    expect(res.code).toBe(0);
    expect(res.stderr + res.stdout).toMatch(/deleted|absent|NEVER recreated/i);
    expect(remoteHead(r)).toBe(""); // the deleted branch was NOT recreated
  });

  it("push rejection (no remote) → real error, fail clearly, never force", () => {
    const r = makeRemoteRepo();
    initAndEnable(r);
    const y = makeChangeCommit(r, "feat: add code");
    git(r.work, ["remote", "remove", "origin"]);
    const res = runCi(r, { after: y });
    expect(res.code).toBe(1);
    // No remote → `ls-remote` FAILS, which is a lookup failure, not an absent
    // ref: arte-gitcard FAILS CLOSED and never attempts a push.
    expect(res.stderr + res.stdout).toMatch(/REAL error|protection|rejected|failing closed|cannot verify|no push/i);
  });

  it("pre-existing user STAGED files are never included in the bot commit", () => {
    const r = makeRemoteRepo();
    initAndEnable(r);
    const y = makeChangeCommit(r, "feat: add code");
    writeFileSync(path.join(r.work, "notes.txt"), "user notes\n", "utf8");
    git(r.work, ["add", "notes.txt"]);
    const res = runCi(r, { after: y });
    expect(res.code).toBe(0);
    const files = lastCommitFiles(r);
    expect(files).not.toContain("notes.txt");
    expect(git(r.work, ["diff", "--cached", "--name-only"]).split("\n").filter(Boolean)).toContain("notes.txt");
  });

  it("package.json 'type':'module' does not break the vendored .cjs runtime", () => {
    const r = makeRemoteRepo(true);
    initAndEnable(r);
    const y = makeChangeCommit(r, "feat: add code");
    const res = runCi(r, { after: y });
    expect(res.code).toBe(0);
    expect(res.stderr + res.stdout).toContain("pushed");
  });
});

describe("github enable/disable/sync via CLI", () => {
  it("enable vendors workflow/action/runtime; disable all-or-nothing refuses a modified workflow", () => {
    const r = makeRemoteRepo();
    runCli(r.work, "init");
    runCli(r.work, "github", "enable");
    const wf = path.join(r.work, ".github", "workflows", "arte-gitcard.yml");
    expect(existsSync(wf)).toBe(true);
    expect(existsSync(path.join(r.work, ".arte-git-card", "ci", "action.yml"))).toBe(true);
    expect(existsSync(path.join(r.work, ".arte-git-card", "ci", "main.cjs"))).toBe(true);

    // all-or-nothing: a user-modified workflow → disable aborts BEFORE config flips
    const original = readFileSync(wf, "utf8");
    writeFileSync(wf, "# user hacked\n" + original, "utf8");
    const fail = spawnSync(process.execPath, [CLI, "github", "disable"], { cwd: r.work, encoding: "utf8" });
    const text = (fail.stdout ?? "") + (fail.stderr ?? "");
    expect(fail.status).not.toBe(0);
    expect(text).toMatch(/aborted|modified/i);
    expect(readFileSync(path.join(r.work, "arte-gitcard.yml"), "utf8")).toContain("auto-update: true");
    expect(existsSync(wf)).toBe(true);

    // clean state → disable removes the workflow + config flips false
    writeFileSync(wf, original, "utf8");
    runCli(r.work, "github", "disable");
    expect(readFileSync(path.join(r.work, "arte-gitcard.yml"), "utf8")).toContain("auto-update: false");
    expect(existsSync(wf)).toBe(false);
  });

  it("github sync repairs owned drift with NO commit / NO push / NO remote mutation", () => {
    const r = makeRemoteRepo();
    runCli(r.work, "init");
    runCli(r.work, "github", "enable");
    // Track the enabled state so the owned files are committed (realistic CI setup).
    git(r.work, ["add", "-A"]);
    git(r.work, ["commit", "-q", "-m", "enable"]);
    git(r.work, ["push", "-q", "origin", "main"]);
    const remoteBefore = git(r.work, ["ls-remote", "origin", "refs/heads/main"]).split(/\s+/)[0] ?? "";
    const localHeadBefore = git(r.work, ["rev-parse", "HEAD"]);
    const wf = path.join(r.work, ".github", "workflows", "arte-gitcard.yml");
    writeFileSync(wf, "# broken\n", "utf8"); // owned drift
    const out = runCli(r.work, "github", "sync");
    expect(out).toContain("wrote");
    expect(readFileSync(wf, "utf8")).not.toBe("# broken\n"); // re-materialized locally
    // sync never commits and never pushes / mutates the remote.
    const remoteAfter = git(r.work, ["ls-remote", "origin", "refs/heads/main"]).split(/\s+/)[0] ?? "";
    expect(remoteAfter).toBe(remoteBefore);
    expect(git(r.work, ["rev-parse", "HEAD"])).toBe(localHeadBefore); // no commit created
  });
});

describe("event payload + state snapshot are independent authorities (default-branch pass)", () => {
  it("tampered state defaultBranch → rejected (no mutation / no push)", () => {
    const r = makeRemoteRepo();
    initAndEnable(r);
    const y = makeChangeCommit(r, "feat: code");
    const remoteBefore = remoteHead(r);
    // State is only an installation snapshot: tampering it must never redirect a push.
    const statePath = path.join(r.work, ".arte-git-card", "state.json");
    const doc = JSON.parse(readFileSync(statePath, "utf8")) as { github?: { defaultBranch?: string } };
    doc.github = { defaultBranch: "trunk" };
    writeFileSync(statePath, JSON.stringify(doc), "utf8");
    const res = runCi(r, { after: y });
    expect(res.code).toBe(0); // rejected → skip (never a mutation)
    expect(res.stderr + res.stdout).toMatch(/!=/);
    expect(remoteHead(r)).toBe(remoteBefore);
    expect(git(r.work, ["rev-parse", "HEAD"])).toBe(y); // no local commit
  });

  it("event repository.default_branch mismatch → rejected (no mutation / no push)", () => {
    const r = makeRemoteRepo();
    initAndEnable(r);
    const y = makeChangeCommit(r, "feat: code");
    const remoteBefore = remoteHead(r);
    // The event says the repo's default branch changed (e.g. renamed), but the
    // installed state still targets main → this stale old-default event must not act.
    const res = runCi(r, { after: y, ref: "refs/heads/main", refName: "main", defaultBranch: "trunk" });
    expect(res.code).toBe(0);
    expect(res.stderr + res.stdout).toMatch(/repository\.default_branch/);
    expect(remoteHead(r)).toBe(remoteBefore);
    expect(git(r.work, ["rev-parse", "HEAD"])).toBe(y);
  });
});

describe("CI fail-closed + hooks hardening", () => {
  it("state missing / corrupt / orphan journal → fail closed (code 1, no commit, no push)", () => {
    const scenarios: Array<{ name: string; breakState: (w: string) => void }> = [
      {
        name: "state missing",
        breakState: (w) => {
          rmSync(path.join(w, ".arte-git-card", "state.json"));
        },
      },
      {
        name: "state corrupt",
        breakState: (w) => {
          writeFileSync(path.join(w, ".arte-git-card", "state.json"), "{ corrupt", "utf8");
        },
      },
      {
        name: "orphan journal",
        breakState: (w) => {
          writeFileSync(path.join(w, ".arte-git-card", "txn.json"), JSON.stringify({ schemaVersion: 1, repoRoot: w, ops: [] }), "utf8");
        },
      },
    ];
    for (const sc of scenarios) {
      const r = makeRemoteRepo();
      initAndEnable(r);
      const y = makeChangeCommit(r, "feat: add code");
      const remoteBefore = remoteHead(r);
      sc.breakState(r.work);
      const res = runCi(r, { after: y });
      expect(res.code, sc.name).toBe(1);
      expect(res.stderr + res.stdout, sc.name).toMatch(/fail|corrupt|journal|state/i);
      expect(remoteHead(r), sc.name).toBe(remoteBefore); // no push
      expect(git(r.work, ["rev-parse", "HEAD"]), sc.name).toBe(y); // no local commit
    }
  });

  it("repository Git hooks never execute (pre-commit/prepare-commit-msg/post-commit/pre-push write NO sentinel)", () => {
    const r = makeRemoteRepo();
    initAndEnable(r);
    const y = makeChangeCommit(r, "feat: add code"); // runtime commits AFTER hooks are installed
    const sentinel = path.join(r.work, "hook-ran.txt");
    const hooksDir = path.join(r.work, ".git", "hooks");
    for (const h of ["pre-commit", "prepare-commit-msg", "post-commit", "pre-push"]) {
      writeFileSync(path.join(hooksDir, h), `#!/bin/sh\necho ran > "${sentinel}"\n`, { mode: 0o755 });
    }
    const res = runCi(r, { after: y });
    expect(res.code).toBe(0); // change pushed fine
    expect(existsSync(sentinel)).toBe(false); // NO hook executed by the hardened runtime
  });
});

describe("GitHub integration requires the actual Git repository root (P1-7)", () => {
  it("--repo pointing at a repo SUBDIRECTORY is rejected with ZERO writes", () => {
    const r = makeRemoteRepo();
    runCli(r.work, "init"); // config + state at the repo ROOT
    const sub = path.join(r.work, "src"); // a subdirectory inside the repo
    expect(existsSync(sub)).toBe(true);
    const fail = runCliFail(r.work, "--repo", sub, "github", "enable");
    expect(fail.stdout + fail.stderr).toContain("GitHub integration requires --repo to point at the Git repository root.");
    // nothing was materialized under the subdir (which git would never treat as a repo workflow)
    expect(existsSync(path.join(sub, ".github"))).toBe(false);
    expect(existsSync(path.join(sub, ".arte-git-card", "state.json"))).toBe(false);
    // the real repo root is untouched and still healthy
    expect(existsSync(path.join(r.work, ".github", "workflows", "arte-gitcard.yml"))).toBe(false);
    expect(runCli(r.work, "status")).toContain("OK");
  });
});
