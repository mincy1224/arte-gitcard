/**
 * GitHub unit tests (default-branch pass):
 *  - branch validity = git check-ref-format (arbitrary valid Git names OK);
 *  - workflow YAML: static ENCODED literal default-branch trigger, job guard
 *    (event repository.default_branch == ref_name), pinned checkout, hashes,
 *    permissions, local action — verified by PARSING the YAML;
 *  - enable resolves the AUTHORITATIVE remote default branch (never the current
 *    HEAD, never a stale origin/HEAD, never a fallback to main);
 *  - sync reconciles the COMPLETE desired state (drift repair + zero-write no-op);
 *  - disable cleans stale entries and clears the snapshot;
 *  - git-ignored integration files block enable with an actionable error.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import YAML from "yaml";
import {
  branchError,
  assertGitRefFormat,
  githubActionsBranchLiteral,
  yamlQuoteBranch,
} from "../../src/github/branch.js";
import { assertCheckoutPin, buildWorkflowYaml, CI_ACTION_YML, workflowPath } from "../../src/github/workflow.js";
import { ACTIONS_CHECKOUT_SHA } from "../../src/github/pins.js";
import { githubEnable, githubSync, githubDisable } from "../../src/github/manage.js";
import { parseLsRemoteDefaultBranch } from "../../src/github/default-branch.js";
import { detectRepositoryState } from "../../src/repo/detect.js";
import { loadConfig } from "../../src/config/load.js";
import { makeV2Repo } from "../helpers/repo.js";

const H = { actionSha256: "a".repeat(64), runtimeSha256: "b".repeat(64) };

/** Create a BROKEN symlink at `linkAbs` (target created then removed). */
function brokenSymlinkAt(linkAbs: string): boolean {
  try {
    mkdirSync(path.dirname(linkAbs), { recursive: true });
    const real = path.join(path.dirname(linkAbs), `.agc-link-${Math.random().toString(36).slice(2)}`);
    mkdirSync(real, { recursive: true });
    symlinkSync(real, linkAbs, "junction");
    rmSync(real, { recursive: true, force: true }); // break the link
    return lstatSync(linkAbs).isSymbolicLink();
  } catch {
    return false; // no symlink privilege on this host
  }
}

const dirs: string[] = [];
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "agc-gh-"));
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

/**
 * A local work repo whose `origin` is a local bare repo advertising
 * `defaultBranch` as its default branch (a commit is pushed so ls-remote works).
 */
function makeRemoteRepo(defaultBranch: string): { bare: string; work: string } {
  const bare = temp();
  const work = temp();
  git(bare, ["init", "--bare", "-q", "-b", defaultBranch]);
  git(work, ["init", "-q", "-b", defaultBranch]);
  git(work, ["config", "user.email", "t@e.c"]);
  git(work, ["config", "user.name", "T"]);
  writeFileSync(path.join(work, "a.txt"), "x\n", "utf8");
  git(work, ["add", "-A"]);
  git(work, ["commit", "-q", "-m", "init"]);
  git(work, ["remote", "add", "origin", bare]);
  git(work, ["push", "-q", "-u", "origin", defaultBranch]);
  return { bare, work };
}

function dummyBundle(): string {
  const p = path.join(temp(), "main.cjs");
  writeFileSync(p, "// runtime-bundle\n", "utf8");
  return p;
}

function readStateOf(root: string): {
  managedFiles: Array<{ kind: string; path: string; sha256: string }>;
  github?: { defaultBranch?: string };
} {
  return JSON.parse(readFileSync(path.join(root, ".arte-git-card", "state.json"), "utf8"));
}

describe("branch validity = git check-ref-format (no ASCII restriction)", () => {
  it("pure pre-check only guards empty/length; arbitrary valid names pass", () => {
    expect(branchError("main")).toBeNull();
    expect(branchError("feature/x.y-z_1")).toBeNull();
    expect(branchError("release+prod")).toBeNull();
    expect(branchError("!hotfix")).toBeNull();
    expect(branchError("hello-$USER")).toBeNull();
    expect(branchError("生产")).toBeNull();
    expect(branchError("")).not.toBeNull();
  });

  it.each([
    "main",
    "trunk",
    "release+prod",
    "!hotfix",
    "hello-$USER",
    "生产",
    "feature/x.y-z_1",
  ])("git check-ref-format accepts a valid Git name: %s", (b) => {
    const dir = temp();
    expect(() => assertGitRefFormat(b, dir)).not.toThrow();
  });

  it.each(["a..b", "main*", "a b", "a@{x}", "a\\b", "/lead", "trail/", "a.lock"])(
    "git check-ref-format rejects an invalid Git ref: %s",
    (b) => {
      const dir = temp();
      expect(() => assertGitRefFormat(b, dir)).toThrow();
    },
  );
});

describe("githubActionsBranchLiteral + yaml quoting", () => {
  it("escapes Actions glob metacharacters with a literal backslash", () => {
    expect(githubActionsBranchLiteral("release+prod")).toBe("release\\+prod");
    expect(githubActionsBranchLiteral("!hotfix")).toBe("\\!hotfix");
    expect(githubActionsBranchLiteral("main")).toBe("main");
  });

  it("the single-quoted scalar preserves the literal backslashes", () => {
    expect(YAML.parse(yamlQuoteBranch(githubActionsBranchLiteral("release+prod")))).toBe("release\\+prod");
    expect(YAML.parse(yamlQuoteBranch(githubActionsBranchLiteral("main")))).toBe("main");
  });
});

describe("workflow + action assets", () => {
  it("statically limits the trigger to the ENCODED literal default branch", () => {
    const yaml = buildWorkflowYaml("release/main", H);
    expect(yaml).not.toMatch(/(^|\n)on:\s*\n\s*push:\s*\n(?!\s+branches:)/m);
    const doc = YAML.parse(yaml) as { on: { push: { branches: string[] } } };
    expect(doc.on.push.branches).toEqual([githubActionsBranchLiteral("release/main")]);
    expect(yaml).not.toContain("on: push"); // never the bare form
  });

  it("parsed on.push.branches[0] is the literal (Actions-glob-escaped) branch name", () => {
    for (const branch of ["main", "trunk", "release+prod", "!hotfix", "hello-$USER", "生产"]) {
      const yaml = buildWorkflowYaml(branch, H);
      const doc = YAML.parse(yaml) as { on: { push: { branches: string[] } } };
      expect(doc.on.push.branches, branch).toEqual([githubActionsBranchLiteral(branch)]);
    }
  });

  it("workflow carries the full security surface + integrity gate", () => {
    const yaml = buildWorkflowYaml("main", H);
    expect(yaml).toContain("permissions: {}");
    expect(yaml).toContain("timeout-minutes: 10");
    // Job guard requires the event's own default branch to equal the ref name.
    expect(yaml).toContain("github.ref_name == github.event.repository.default_branch");
    expect(yaml).toContain("cancel-in-progress: true");
    expect(yaml).toContain("contents: write");
    expect(yaml).toContain(`actions/checkout@${ACTIONS_CHECKOUT_SHA}`);
    expect(ACTIONS_CHECKOUT_SHA).not.toMatch(/^0+$/);
    expect(yaml).toMatch(/ref: \$\{\{ github\.sha \}\}/);
    expect(yaml).toContain("fetch-depth: 0");
    expect(yaml).toContain("persist-credentials: true");
    // integrity literals are the hashes of the written bytes
    expect(yaml).toContain(H.actionSha256);
    expect(yaml).toContain(H.runtimeSha256);
    // the pre-execution gate runs BEFORE the local action
    expect(yaml.indexOf("sha256sum")).toBeGreaterThan(-1);
    expect(yaml.indexOf("sha256sum")).toBeLessThan(yaml.indexOf("uses: ./.arte-git-card/ci"));
    // no runtime self-hash control and no skip tokens
    expect(yaml).not.toMatch(/skip[ _-]?ci/i);
    expect(yaml).not.toMatch(/run: node/);
  });

  it("action.yml uses node24 + main.cjs", () => {
    expect(CI_ACTION_YML).toContain("using: node24");
    expect(CI_ACTION_YML).toContain("main: main.cjs");
    expect(workflowPath()).toBe(".github/workflows/arte-gitcard.yml");
  });
});

describe("github enable resolves the AUTHORITATIVE remote default branch", () => {
  it("resolves the remote default even when the local HEAD is a different branch", () => {
    const { work } = makeRemoteRepo("trunk");
    // Local HEAD is now a feature branch that is NOT the remote default.
    git(work, ["checkout", "-q", "-b", "feature"]);
    makeV2Repo(work);
    const cfg = loadConfig(path.join(work, "arte-gitcard.yml"));
    const res = githubEnable(work, cfg, { ciBundlePath: dummyBundle() });
    expect(res.branch).toBe("trunk");
    const state = readStateOf(work);
    expect(state.github?.defaultBranch).toBe("trunk");
  });

  it("writes config(no github) + workflow + action + runtime + state in one txn", () => {
    const { work } = makeRemoteRepo("main");
    makeV2Repo(work);
    const cfg = loadConfig(path.join(work, "arte-gitcard.yml"));
    githubEnable(work, cfg, { ciBundlePath: dummyBundle() });
    expect(existsSync(path.join(work, ".github", "workflows", "arte-gitcard.yml"))).toBe(true);
    expect(existsSync(path.join(work, ".arte-git-card", "ci", "action.yml"))).toBe(true);
    expect(existsSync(path.join(work, ".arte-git-card", "ci", "main.cjs"))).toBe(true);
    const state = readStateOf(work);
    expect(state.github?.defaultBranch).toBe("main");
    expect(state.managedFiles.some((e) => e.kind === "workflow")).toBe(true);
    expect(state.managedFiles.some((e) => e.kind === "ci-runtime")).toBe(true);
    // config has NO github key and auto-update is true
    const cfgDoc = YAML.parse(readFileSync(path.join(work, "arte-gitcard.yml"), "utf8")) as Record<string, unknown>;
    expect(cfgDoc["auto-update"]).toBe(true);
    expect(cfgDoc).not.toHaveProperty("github");
  });

  it("fails closed with actionable guidance when the default branch cannot be resolved (never fallback main)", () => {
    const plain = temp();
    makeV2Repo(plain); // no remote origin at all
    const cfg = loadConfig(path.join(plain, "arte-gitcard.yml"));
    expect(() => githubEnable(plain, cfg, { ciBundlePath: dummyBundle() })).toThrow(/Unable to determine the GitHub repository default branch/);
    expect(loadConfig(path.join(plain, "arte-gitcard.yml")).config["auto-update"]).toBe(false);
    expect(existsSync(path.join(plain, ".github", "workflows"))).toBe(false); // nothing materialized
  });
});

describe("parseLsRemoteDefaultBranch", () => {
  it("parses the advertised symref HEAD", () => {
    expect(parseLsRemoteDefaultBranch("ref: refs/heads/trunk\tHEAD\nabc123\tHEAD\n")).toBe("trunk");
    expect(parseLsRemoteDefaultBranch("abc123\tHEAD\n")).toBeNull();
  });
});

describe("github sync reconciles the COMPLETE desired state", () => {
  it("restores a tampered owned runtime and repairs the state hash", () => {
    const { work } = makeRemoteRepo("main");
    makeV2Repo(work);
    const bundle = dummyBundle();
    const cfg = loadConfig(path.join(work, "arte-gitcard.yml"));
    githubEnable(work, cfg, { ciBundlePath: bundle });
    // Tamper the vendored runtime directly (owned drift).
    writeFileSync(path.join(work, ".arte-git-card", "ci", "main.cjs"), "// tampered\n", "utf8");
    const enabledCfg = loadConfig(path.join(work, "arte-gitcard.yml"));
    const { effects } = githubSync(work, enabledCfg, { ciBundlePath: bundle });
    expect(effects.length).toBeGreaterThan(0);
    expect(readFileSync(path.join(work, ".arte-git-card", "ci", "main.cjs"), "utf8")).toBe("// runtime-bundle\n");
    expect(detectRepositoryState(work).state).not.toBe("DRIFTED");
  });

  it("is a zero-write no-op when the desired state is already identical", () => {
    const { work } = makeRemoteRepo("main");
    makeV2Repo(work);
    const bundle = dummyBundle();
    const cfg = loadConfig(path.join(work, "arte-gitcard.yml"));
    githubEnable(work, cfg, { ciBundlePath: bundle });
    const enabledCfg = loadConfig(path.join(work, "arte-gitcard.yml"));
    const { effects } = githubSync(work, enabledCfg, { ciBundlePath: bundle });
    expect(effects).toEqual([]);
  });
});

describe("github disable cleans stale managed entries + clears the snapshot", () => {
  const GH_RELS = [
    ".github/workflows/arte-gitcard.yml",
    ".arte-git-card/ci/action.yml",
    ".arte-git-card/ci/main.cjs",
  ] as const;

  it("an ABSENT owned artifact + matching entry → disable drops the stale entry", () => {
    for (const absentRel of GH_RELS) {
      const { work } = makeRemoteRepo("main");
      makeV2Repo(work);
      const cfg = loadConfig(path.join(work, "arte-gitcard.yml"));
      githubEnable(work, cfg, { ciBundlePath: dummyBundle() });
      // simulate the artifact having been deleted (stale owned entry remains)
      rmSync(path.join(work, absentRel), { force: true });

      const enabledCfg = loadConfig(path.join(work, "arte-gitcard.yml"));
      expect(() => githubDisable(work, enabledCfg)).not.toThrow();
      const state = readStateOf(work);
      for (const rel of GH_RELS) {
        expect(state.managedFiles.some((e) => e.path === rel)).toBe(false);
      }
      expect(state.managedFiles.some((e) => ["workflow", "ci-action", "ci-runtime"].includes(e.kind))).toBe(false);
      expect(state.github).toBeUndefined();
      expect(loadConfig(path.join(work, "arte-gitcard.yml")).config["auto-update"]).toBe(false);
      expect(detectRepositoryState(work).state).not.toBe("DRIFTED");
    }
  });
});

describe("github enable refuses a broken-symlink workflow target (RB-3)", () => {
  it("a broken symlink at the workflow path → enable fails closed, nothing materialized", () => {
    const { work } = makeRemoteRepo("main");
    const wfAbs = path.join(work, ".github", "workflows", "arte-gitcard.yml");
    if (!brokenSymlinkAt(wfAbs)) return; // no symlink privilege on this host
    makeV2Repo(work);
    const cfg = loadConfig(path.join(work, "arte-gitcard.yml"));
    expect(() => githubEnable(work, cfg, { ciBundlePath: dummyBundle() })).toThrow(/not owned|refus/i);
    expect(lstatSync(wfAbs).isSymbolicLink()).toBe(true); // symlink preserved (never replaced)
    expect(loadConfig(path.join(work, "arte-gitcard.yml")).config["auto-update"]).toBe(false);
  });
});

describe("git-ignored required integration files block enable (actionable, no .gitignore edit)", () => {
  it("an untracked + ignored runtime blocks enable and names the path", () => {
    const { work } = makeRemoteRepo("main");
    writeFileSync(path.join(work, ".gitignore"), ".arte-git-card/\n", "utf8");
    makeV2Repo(work);
    const cfg = loadConfig(path.join(work, "arte-gitcard.yml"));
    let msg = "";
    try {
      githubEnable(work, cfg, { ciBundlePath: dummyBundle() });
    } catch (err) {
      msg = (err as Error).message;
    }
    expect(msg).toMatch(/ignored/);
    expect(msg).toContain(".arte-git-card/ci/main.cjs");
    expect(msg).toContain(".gitignore");
    expect(loadConfig(path.join(work, "arte-gitcard.yml")).config["auto-update"]).toBe(false);
    expect(existsSync(path.join(work, ".github", "workflows"))).toBe(false);
  });
});

describe("checkout pin enforcement (F4)", () => {
  it("assertCheckoutPin accepts the exact lowercase 40-hex pin", () => {
    expect(assertCheckoutPin("3d3c42e5aac5ba805825da76410c181273ba90b1")).toBe("3d3c42e5aac5ba805825da76410c181273ba90b1");
  });

  it.each([
    ["floating tag", "v4"],
    ["floating branch", "main"],
    ["short sha", "3d3c42e5aac5"],
    ["uppercase sha", "3D3C42E5AAC5BA805825DA76410C181273BA90B1"],
    ["empty", ""],
  ])("assertCheckoutPin rejects %s", (_label, input) => {
    expect(() => assertCheckoutPin(input)).toThrow(/40-char|hex|pin/i);
    expect(() => buildWorkflowYaml("main", H, input)).toThrow(/40-char|hex|pin/i);
  });

  it("generated workflow embeds the validated real pin (never a floating ref)", () => {
    const wf = buildWorkflowYaml("main", H);
    expect(wf).toContain(`actions/checkout@${ACTIONS_CHECKOUT_SHA}`);
    expect(wf).not.toMatch(/actions\/checkout@v/); // never a tag
  });
});

describe("github sync reconciles ownership KIND (P1-3)", () => {
  it("repairs wrong-kind state entries even when disk bytes are correct; disable then works", () => {
    const { work } = makeRemoteRepo("main");
    makeV2Repo(work);
    const bundle = dummyBundle();
    const cfg = loadConfig(path.join(work, "arte-gitcard.yml"));
    githubEnable(work, cfg, { ciBundlePath: bundle });

    // Tamper only the ownership KIND of the workflow entry (path+sha stay valid).
    const statePath = path.join(work, ".arte-git-card", "state.json");
    const doc = JSON.parse(readFileSync(statePath, "utf8")) as {
      managedFiles: Array<{ path: string; kind: string; sha256: string }>;
    };
    for (const e of doc.managedFiles) {
      if (e.path.endsWith("/workflows/arte-gitcard.yml")) e.kind = "ci-runtime";
    }
    writeFileSync(statePath, JSON.stringify(doc), "utf8");

    const enabledCfg = loadConfig(path.join(work, "arte-gitcard.yml"));
    const { effects } = githubSync(work, enabledCfg, { ciBundlePath: bundle });
    expect(effects.length).toBeGreaterThan(0); // sync repaired the entry (bytes already correct)
    const state = readStateOf(work);
    expect(state.managedFiles.find((e) => e.path.endsWith("/workflows/arte-gitcard.yml"))!.kind).toBe("workflow");

    // With kind repaired, disable is a clean all-or-nothing teardown.
    expect(() => githubDisable(work, enabledCfg)).not.toThrow();
    expect(loadConfig(path.join(work, "arte-gitcard.yml")).config["auto-update"]).toBe(false);
  });
});
