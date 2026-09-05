/**
 * arte-gitcard CI runtime — vendored to `.arte-git-card/ci/main.cjs`, run as a
 * repository-local JavaScript Action (`runs.using: node24`). Fully bundled
 * (yaml/zod inlined, no commander); `.cjs` so a target `"type":"module"` is
 * irrelevant; no target node_modules / package manager / runner-PATH node.
 *
 * P0 hardening:
 *  - event gate before ANY mutation (ref/ref_name/payload.ref/deleted/
 *    repository.default_branch/after==GITHUB_SHA==HEAD/auto-update);
 *  - state missing/corrupt → fail closed; orphan journal never auto-repaired;
 *  - planGenerateTxn guards/ownership apply; only ENABLED cards generated; no
 *    repo code/scripts/deps/gh/network;
 *  - every git call disables hooks (`-c core.hooksPath=<empty dir>`) and uses
 *    LITERAL pathspecs so `* ? [ :` in a path can never match/stage unrelated
 *    files; enumeration is NUL-safe (`-z`);
 *  - commit uses an explicit allowlist pathspec and the FINAL commit's path set
 *    is read NUL-safely BEFORE any push — any non-allowlist path fails closed;
 *  - stale-remote / push-race handling (pushWithStaleGuard);
 *  - NEVER force/amend/rebase/merge; `[skip ci]` never used.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfig } from "../config/load.js";
import { loadTheme } from "../theme/load.js";
import { resolveTheme } from "../theme/resolve.js";
import { buildManagedGuard } from "../state/guards.js";
import { readState, assertDeletable, removeEntry, serializeState } from "../state/registry.js";
import type { ArteGitcardState } from "../state/registry.js";
import { planGenerateTxn } from "../generate/manage.js";
import { runTransaction } from "../txn/engine.js";
import { CONFIG_FILENAME, resolveFromProject } from "../config/paths.js";
import { JOURNAL_REL, STATE_REL } from "../managed/paths.js";

export const BOT_NAME = "github-actions[bot]";
export const BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";
export const COMMIT_MESSAGE = "chore(arte-gitcard): update cards";

const ZERO_SHA = /^0{40,64}$/;
const FULL_SHA = /^[0-9a-f]{40,64}$/;

export interface CiEnv {
  eventName?: string;
  eventPath?: string;
  ref?: string;
  refName?: string;
  sha?: string;
  workspace?: string;
}

export interface EventVerdict {
  ok: boolean;
  reason?: string;
  /** true when this run is simply not meant for us → exit 0 silently */
  skip?: boolean;
}

/** Pure event gate (testable). GitHub's event payload is an INDEPENDENT authority. */
export function verifyPushEvent(
  env: CiEnv,
  payload: { ref?: unknown; deleted?: unknown; after?: unknown; before?: unknown; repository?: { default_branch?: unknown } },
  branch: string,
  head: string,
): EventVerdict {
  const ref = `refs/heads/${branch}`;
  if (env.eventName !== "push") return { ok: false, skip: true, reason: `event is ${String(env.eventName)}, not push` };
  // STRICT equality — missing/mismatched GITHUB_REF/REF_NAME skips (fail closed), never mutates.
  if (env.ref !== ref) return { ok: false, skip: true, reason: `GITHUB_REF ${String(env.ref)} != ${ref}` };
  if (env.refName !== branch) return { ok: false, skip: true, reason: `GITHUB_REF_NAME ${String(env.refName)} != ${branch}` };
  if (payload.ref !== ref) return { ok: false, skip: true, reason: `payload.ref != ${ref}` };
  if (payload.deleted !== false) return { ok: false, skip: true, reason: "payload.deleted != false" };
  // The event's repository.default_branch must equal the state snapshot — a stale
  // old-default workflow must never act.
  const repoDefault = payload.repository?.default_branch;
  if (repoDefault !== branch) {
    return {
      ok: false,
      skip: true,
      reason: `github.event.repository.default_branch ${String(repoDefault)} != state defaultBranch ${branch}`,
    };
  }
  const after = typeof payload.after === "string" ? payload.after : "";
  if (!FULL_SHA.test(after) || ZERO_SHA.test(after)) return { ok: false, skip: true, reason: "payload.after is not a full non-zero SHA" };
  if (!env.sha || env.sha !== after) return { ok: false, skip: true, reason: "GITHUB_SHA != payload.after" };
  if (env.sha !== head) return { ok: false, skip: true, reason: "GITHUB_SHA != git HEAD (checkout not at the exact push SHA)" };
  return { ok: true };
}

const nul = (s: string): string[] => s.split("\0").filter((p) => p.length > 0);

export interface GitCall {
  out: string;
  code: number;
}

/** Build the hardened argv (testable): literal pathspecs + hooks disabled. */
export function gitArgv(args: string[], hooksDir: string): string[] {
  return ["--literal-pathspecs", "-c", `core.hooksPath=${hooksDir}`, ...args];
}

/**
 * HARDENED git: `--literal-pathspecs` (never glob-interpret a path) and
 * `-c core.hooksPath=<empty-dir>` (never execute repository hooks on commit/push).
 * `hooksDir` MUST be an existing EMPTY directory.
 */
export function git(root: string, args: string[], hooksDir: string, opts: { env?: Record<string, string>; allowFail?: boolean } = {}): GitCall {
  const argv = gitArgv(args, hooksDir);
  try {
    const out = execFileSync("git", argv, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, ...opts.env },
    });
    return { out, code: 0 };
  } catch (err) {
    const e = err as { status?: number };
    if (opts.allowFail) return { out: "", code: e.status ?? 1 };
    throw new Error(`git ${args[0]} failed: ${(err as Error).message}`);
  }
}

/**
 * Remote branch lookup outcome. An ABSENT ref must never be treated as "ok to
 * push" (that would recreate a deleted branch), nor a FAILED lookup:
 *   - ok + ref present → { ok:true, sha }
 *   - ok + ref ABSENT  → { ok:true, sha:null } (deleted)
 *   - lookup FAILED    → { ok:false } (cannot verify)
 */
export type RemoteLookup = { ok: true; sha: string | null } | { ok: false; error: string };

export interface PushHooks {
  runPush(): GitCall;
  lsRemote(): RemoteLookup;
}

/**
 * Pure push decision with stale/deleted-race handling (testable). base = the
 * HEAD SHA we generated on; push requires the remote target ref to be EXACTLY base.
 *   pre-ref absent (deleted) → stale success — a deleted branch is NEVER recreated.
 *   pre lookup failure       → fail closed (code 1), never push.
 *   push failed → re-lookup: lookup failure → REAL error; ref now absent → stale
 *     success (never recreate); moved from base → stale success; still base →
 *     REAL error (protection/ruleset/token).
 *   NEVER retry / force / force-with-lease.
 */
export function pushWithStaleGuard(base: string, hooks: PushHooks): { code: number; reason: string; pushed: boolean } {
  const pre = hooks.lsRemote();
  if (!pre.ok) {
    return {
      code: 1,
      reason: `cannot verify the remote branch before push (ls-remote failed: ${pre.error}) — failing closed, no push.`,
      pushed: false,
    };
  }
  if (pre.sha === null) {
    return {
      code: 0,
      reason: "remote branch is absent (deleted) — a deleted branch is NEVER recreated; skipping stale result",
      pushed: false,
    };
  }
  if (pre.sha !== base) {
    return { code: 0, reason: `remote already moved to ${pre.sha} (base ${base}) — skipping stale result`, pushed: false };
  }
  const push = hooks.runPush();
  if (push.code === 0) return { code: 0, reason: "pushed generated commit", pushed: true };
  const post = hooks.lsRemote();
  if (!post.ok) {
    return {
      code: 1,
      reason: `push rejected and the remote could not be re-verified (ls-remote failed: ${post.error}) — REAL error, no force/merge.`,
      pushed: false,
    };
  }
  if (post.sha === null) {
    return {
      code: 0,
      reason: "push raced: the remote branch is now absent (deleted) — a deleted branch is NEVER recreated; skipping stale result",
      pushed: false,
    };
  }
  if (post.sha !== base) {
    return {
      code: 0,
      reason: `push raced: remote moved to ${post.sha} — skipping stale result (no force/merge)`,
      pushed: false,
    };
  }
  return {
    code: 1,
    reason:
      `push rejected while the remote is still at ${base} — this is a REAL error ` +
      `(branch protection / ruleset / token policy / signed-commit policy). No force push was attempted.`,
    pushed: false,
  };
}

export interface CiRunResult {
  code: number;
  reason: string;
  pushed: boolean;
}

export function runCi(root: string, env: CiEnv): CiRunResult {
  const workspace = env.workspace ? path.resolve(env.workspace) : root;
  // Empty hooks dir → repository Git hooks can never execute.
  const noHooksDir = mkdtempSync(path.join(tmpdir(), "agc-nohooks-"));
  try {
    return runCiBody(workspace, env, noHooksDir);
  } finally {
    // Best-effort cleanup of the CI temp hooks dir (no runner temp residue).
    try {
      rmSync(noHooksDir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
}

function runCiBody(workspace: string, env: CiEnv, noHooksDir: string): CiRunResult {
  const log = (msg: string): void => console.error(msg);
  const g = (args: string[], opts?: { allowFail?: boolean }): GitCall => git(workspace, args, noHooksDir, opts);

  const head = g(["rev-parse", "HEAD"], { allowFail: true }).out.trim();
  if (!head) return { code: 0, reason: "checkout has no commits — nothing to do", pushed: false };
  let event: {
    ref?: unknown;
    deleted?: unknown;
    after?: unknown;
    before?: unknown;
    repository?: { default_branch?: unknown };
  } = {};
  if (env.eventPath) {
    try {
      event = JSON.parse(readFileSync(env.eventPath, "utf8"));
    } catch {
      return { code: 1, reason: "cannot read GITHUB_EVENT_PATH", pushed: false };
    }
  }

  const cfgPath = path.join(workspace, CONFIG_FILENAME);
  if (!existsSync(cfgPath)) return { code: 0, reason: "no arte-gitcard.yml in the checkout — nothing to do", pushed: false };
  let loaded;
  try {
    loaded = loadConfig(cfgPath);
  } catch (err) {
    return { code: 1, reason: `config is damaged (fail closed): ${(err as Error).message}`, pushed: false };
  }
  const config = loaded.config;
  if (config["auto-update"] !== true) return { code: 0, reason: "auto-update is disabled — nothing to do", pushed: false };
  log("arte-gitcard-ci: config validated");

  // state must be ok; it holds the installed default-branch snapshot.
  const stateRead = readState(workspace);
  if (stateRead.status !== "ok") {
    return { code: 1, reason: `state.json is ${stateRead.status} — failing closed, no changes made.`, pushed: false };
  }
  let state: ArteGitcardState = stateRead.state;
  const branch = state.github?.defaultBranch ?? "";
  if (!branch) {
    return {
      code: 1,
      reason:
        "auto-update is enabled but state.json has no default-branch snapshot — run `arte-gitcard github sync`. No changes were made.",
      pushed: false,
    };
  }
  // State is an installation snapshot, not push authority: validate it as a Git ref.
  const refOk = g(["check-ref-format", `refs/heads/${branch}`], { allowFail: true });
  if (refOk.code !== 0) {
    return {
      code: 1,
      reason: `state.json defaultBranch "${branch}" is not a valid git ref (fail closed) — run \`arte-gitcard github sync\`. No changes were made.`,
      pushed: false,
    };
  }

  const verdict = verifyPushEvent({ ...env, workspace }, event, branch, head);
  if (!verdict.ok) return { code: 0, reason: verdict.reason ?? "event not for us", pushed: false };
  log(`arte-gitcard-ci: event accepted: default branch "${branch}" @ ${head.slice(0, 7)}`);

  // Orphan journal → fail closed (never auto-"repair" in CI).
  if (existsSync(path.join(workspace, JOURNAL_REL))) {
    return {
      code: 1,
      reason:
        "an orphaned transaction journal exists (.arte-git-card/txn.json). arte-gitcard will NOT auto-recover in CI — run `arte-gitcard doctor` locally. No changes were made.",
      pushed: false,
    };
  }

  // Snapshot pre-existing staged index (NUL-safe, no rename detection).
  const preStaged = new Set(nul(g(["diff", "--cached", "--name-only", "-z", "--no-renames"], { allowFail: true }).out));

  let theme;
  try {
    theme = resolveTheme(loadTheme(config.theme, workspace));
  } catch (err) {
    return { code: 1, reason: `selected theme is not resolvable (fail closed): ${(err as Error).message}`, pushed: false };
  }
  const { plan, state: plannedState, planned, prunedDescriptions } = planGenerateTxn(workspace, loaded, theme);
  state = plannedState;
  const outputAbs = resolveFromProject(workspace, config.output.directory);
  const outputRel = path.relative(workspace, outputAbs).replace(/\\/g, "/");
  const desired = new Set(planned.artifacts.map((a) => `${outputRel}/${a.file}`));
  for (const entry of [...state.managedFiles]) {
    if (entry.kind !== "card") continue;
    if (desired.has(entry.path)) continue;
    const status = assertDeletable(workspace, entry);
    if (status === "ok") {
      plan.deletes.push({ rel: entry.path, abs: resolveFromProject(workspace, entry.path), kind: "card", expectedSha256: entry.sha256 });
    } else if (status === "modified" || status === "unsafe") {
      log(`warn: ${entry.path} (${status}) — preserved, not removed`);
    }
    removeEntry(state, entry.path);
  }
  plan.stateJson = { rel: STATE_REL, content: serializeState(state) };

  runTransaction(plan, { repoRoot: workspace, command: "ci-generate", guard: buildManagedGuard(workspace, config) });
  log(`arte-gitcard-ci: generated ${planned.artifacts.length} card artifact(s)`);
  if (prunedDescriptions > 0) {
    log(`arte-gitcard-ci: structure descriptions: ${prunedDescriptions} stale pruned`);
  }

  // Exact staging allowlist (literal pathspecs).
  const allowlist = new Set<string>();
  for (const e of plan.writes) allowlist.add(e.rel);
  for (const d of plan.deletes) allowlist.add(d.rel);
  if (plan.stateJson) allowlist.add(plan.stateJson.rel);
  if (allowlist.size === 0) return { code: 0, reason: "no owned changes produced", pushed: false };

  for (const rel of allowlist) g(["add", "--", rel]);

  // `--no-renames`: the path-set validation must never depend on rename
  // detection / config; the allowlist is an exact path set.
  const stagedNow = nul(g(["diff", "--cached", "--name-only", "-z", "--no-renames"], { allowFail: true }).out);
  const ourStaged = stagedNow.filter((p) => allowlist.has(p));
  const unlistedStaged = stagedNow.filter((p) => !allowlist.has(p));
  if (!unlistedStaged.every((p) => preStaged.has(p))) {
    return {
      code: 1,
      reason: `index contains staged files outside the allowlist that were not pre-staged: ${unlistedStaged.join(", ")}`,
      pushed: false,
    };
  }

  if (ourStaged.length === 0) return { code: 0, reason: "no changes to arte-gitcard-owned files", pushed: false };

  log(`arte-gitcard-ci: changed ${ourStaged.length} managed path(s)`);

  // Commit ONLY the allowlist (literal pathspecs + hooks disabled).
  g(["config", "user.name", BOT_NAME]);
  g(["config", "user.email", BOT_EMAIL]);
  const commitCall = g(["commit", "-m", COMMIT_MESSAGE, "--", ...allowlist], { allowFail: true });
  if (commitCall.code !== 0) {
    return { code: 1, reason: `commit failed: ${commitCall.out.trim()}`, pushed: false };
  }
  log(`arte-gitcard-ci: committed ${ourStaged.length} managed path(s)`);

  // Verify the FINAL commit's actual path set ⊆ exact allowlist (fail closed).
  const commitSha = g(["rev-parse", "HEAD"], { allowFail: true }).out.trim();
  const actualCommitted = nul(g(["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", "--no-renames", commitSha], { allowFail: true }).out);
  const foreign = actualCommitted.filter((p) => !allowlist.has(p));
  if (foreign.length > 0) {
    return {
      code: 1,
      reason: `commit contained non-allowlist paths ${foreign.join(", ")} — failing closed, NOT pushing.`,
      pushed: false,
    };
  }

  // Remote lookup MUST distinguish success-absent (deleted branch) from a
  // failed `ls-remote` — neither may ever proceed to a push that recreates a
  // deleted branch.
  const lsRemote = (): RemoteLookup => {
    const call = g(["ls-remote", "origin", `refs/heads/${branch}`], { allowFail: true });
    if (call.code !== 0) return { ok: false, error: `ls-remote exited ${call.code}` };
    const sha = call.out.split(/\s+/)[0] ?? "";
    return { ok: true, sha: sha === "" ? null : sha };
  };
  const runPush = (): GitCall => g(["push", "origin", `HEAD:refs/heads/${branch}`], { allowFail: true });
  const push = pushWithStaleGuard(head, { runPush, lsRemote });
  return { code: push.code, reason: push.reason, pushed: push.pushed };
}

/** CI entrypoint (src/ci/main.ts). Kept import-safe for tests. */
export function ciMain(): void {
  const root = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd());
  const env: CiEnv = {
    eventName: process.env.GITHUB_EVENT_NAME,
    eventPath: process.env.GITHUB_EVENT_PATH,
    ref: process.env.GITHUB_REF,
    refName: process.env.GITHUB_REF_NAME,
    sha: process.env.GITHUB_SHA,
    workspace: root,
  };
  try {
    const result = runCi(root, env);
    if (result.reason) console.error(`arte-gitcard-ci: ${result.reason}`);
    process.exitCode = result.code;
  } catch (err) {
    console.error(`arte-gitcard-ci: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}
