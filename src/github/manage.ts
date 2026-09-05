/**
 * GitHub manager (P0, default-branch pass). Writes ONLY to the GitHub default
 * branch (never user config, never the current checkout); every command is ONE
 * transaction reusing the detector/guards/ownership.
 *
 *   enable : authoritative default branch (read-only ls-remote) → preflight all
 *            write targets → config + workflow + action + runtime + state in ONE txn.
 *   disable: ALL-OR-NOTHING — a modified/unowned workflow fails BEFORE config is
 *            written (never leave auto-update=false while a live workflow exists).
 *   sync   : reconcile the COMPLETE desired state every run, repairing all drift
 *            in ONE txn; zero-write no-op when identical. No commit/push/remote
 *            mutation.
 *
 * enable/sync refuse (without editing .gitignore) when a required file is
 * untracked AND git-ignored — GitHub would silently skip it from `git add`.
 */

import path from "node:path";
import { readFileSync, realpathSync } from "node:fs";
import { pathOccupied } from "../fs/presence.js";
import { execFileSync } from "node:child_process";
import YAML from "yaml";
import { cloneConfig } from "../config/registry.js";
import type { ArteGitCardConfig, LoadedConfig } from "../config/types.js";
import { runTransaction } from "../txn/engine.js";
import type { Effect } from "../txn/engine.js";
import { emptyPlan } from "../txn/plan.js";
import type { TxnPlan, ExpectedBefore } from "../txn/plan.js";
import { configSourcePrecondition, stateSourcePrecondition } from "../txn/sources.js";
import { buildManagedGuard } from "../state/guards.js";
import {
  assertDeletable,
  findEntry,
  readState,
  removeEntry,
  serializeState,
  upsertEntry,
} from "../state/registry.js";
import type { ArteGitcardState } from "../state/registry.js";
import { sha256WrittenContent } from "../fs/atomic.js";
import { CI_ACTION_REL, CI_RUNTIME_REL, STATE_REL, WORKFLOW_REL } from "../managed/paths.js";
import { assertBranchRef } from "./branch.js";
import { CI_ACTION_YML, buildWorkflowYaml } from "./workflow.js";
import { resolveDefaultBranch } from "./default-branch.js";
import { integrationIgnoredRels } from "./tracked.js";

/**
 * Where the vendored runtime lives in the INSTALLED package (<pkg>/dist/ci/main.cjs),
 * derived from THIS module's location, never process.argv[1]: on POSIX
 * `npm install -g`, argv[1] is a bin SYMLINK into <prefix>/bin, so basing on it
 * would miss the bundled runtime. The shipped CLI is CJS, so `__dirname` is the
 * real module dir regardless of how it was invoked.
 */
export function ciBundlePathFromCli(): string {
  if (typeof __dirname === "string") return path.join(__dirname, "ci", "main.cjs");
  // Non-CJS fallback (source/test execution only): NEVER trust a raw argv[1]
  // symlink — resolve it to the real CLI file first.
  const script = process.argv[1];
  let real = process.cwd();
  if (script) {
    try {
      real = realpathSync(script);
    } catch {
      real = path.resolve(script);
    }
  }
  return path.join(path.dirname(real), "ci", "main.cjs");
}

export interface GithubTargets {
  workflowRel: string;
  actionRel: string;
  runtimeRel: string;
}

function targets(): GithubTargets {
  return { workflowRel: WORKFLOW_REL, actionRel: CI_ACTION_REL, runtimeRel: CI_RUNTIME_REL };
}

/** enable preflight: expected-before policy so each target is probed once.
 * Absent → {absent}; owned+unchanged → its sha; modified/unsafe/unowned → throw. */
function ensureWritable(projectRoot: string, state: ArteGitcardState, rel: string): ExpectedBefore {
  const abs = path.join(projectRoot, rel);
  // A broken symlink / directory is an OCCUPIED target (never treated as absent).
  if (!pathOccupied(abs)) return { kind: "absent" };
  const entry = findEntry(state, rel);
  if (!entry) {
    throw new Error(`${rel} already exists but is not owned by arte-gitcard — refusing to touch it.`);
  }
  const st = assertDeletable(projectRoot, entry);
  if (st === "modified") {
    throw new Error(`${rel} was modified after generation — preserved. Resolve it manually (arte-gitcard doctor).`);
  }
  if (st === "unsafe") {
    throw new Error(`${rel} is at an unsafe path — preserved.`);
  }
  return { kind: "sha256", sha256: entry.sha256 };
}

/** sync may explicitly RECLAIM owned drift: refuse only unowned/unsafe targets.
 * Absent → {absent}; owned-present (even drifted) → undefined (deliberate reclaim). */
function ensureReclaimable(projectRoot: string, state: ArteGitcardState, rel: string): ExpectedBefore | undefined {
  const abs = path.join(projectRoot, rel);
  if (!pathOccupied(abs)) return { kind: "absent" };
  const entry = findEntry(state, rel);
  if (!entry) {
    throw new Error(`${rel} already exists but is not owned by arte-gitcard — refusing to overwrite it.`);
  }
  if (assertDeletable(projectRoot, entry) === "unsafe") {
    throw new Error(`${rel} is at an unsafe path — preserved.`);
  }
  return undefined;
}

/** Blocking check: an untracked AND git-ignored integration file is skipped by
 * `git add`, so the workflow would never run on GitHub. Tracked files are fine
 * even if a later ignore rule matches. Throws (before any mutation) naming the
 * ignored path and the required `.gitignore` exception; never edits .gitignore. */
export function assertIntegrationTrackable(projectRoot: string): void {
  const ignored = integrationIgnoredRels(projectRoot);
  if (ignored.length > 0) {
    throw new Error(
      "GitHub auto-update would be silently skipped: the following required integration file(s) are " +
        "untracked and git-ignored, so a normal `git add` would never track them:\n" +
        ignored.map((r) => `  - ${r}`).join("\n") +
        "\n\nAdd an exception for these paths to your repository's .gitignore so they can be committed " +
        "(arte-gitcard does not edit .gitignore automatically), then run this command again.",
    );
  }
}

export interface GithubEnableOptions {
  dryRun?: boolean;
  ciBundlePath?: string;
}

/** LF-insensitive read-back comparison (files checked out with CRLF still match). */
function fileContentEquals(projectRoot: string, rel: string, content: string): boolean {
  try {
    const cur = readFileSync(path.join(projectRoot, rel), "utf8").replace(/\r\n/g, "\n");
    return cur === content.replace(/\r\n/g, "\n");
  } catch {
    return false;
  }
}

interface GithubAssets {
  workflowYaml: string;
  actionContent: string;
  runtimeContent: string;
  actionSha256: string;
  runtimeSha256: string;
}

function readCiBundle(ciBundlePath: string): Buffer {
  try {
    return readFileSync(ciBundlePath);
  } catch {
    throw new Error(`vendored CI runtime not found at ${ciBundlePath} — run "npm run build" first.`);
  }
}

function buildGithubAssets(branch: string, ciBundlePath: string): GithubAssets {
  const runtimeBytes = readCiBundle(ciBundlePath);
  const actionContent = CI_ACTION_YML;
  const runtimeContent = runtimeBytes.toString("utf8");
  const actionSha256 = sha256WrittenContent(actionContent);
  const runtimeSha256 = sha256WrittenContent(runtimeContent);
  const workflowYaml = buildWorkflowYaml(branch, { actionSha256, runtimeSha256 });
  return { workflowYaml, actionContent, runtimeContent, actionSha256, runtimeSha256 };
}

function serializeConfig(c: ArteGitCardConfig): string {
  return YAML.stringify(c);
}

/** Build the enable plan WITHOUT applying it (test seam). Preconditions are the
 * EXACT LoadedConfig bytes + the ONE StateRead used; each write target carries
 * its expected-before policy from preflight (absent pin / exact-sha replace). */
export function buildGithubEnablePlan(
  projectRoot: string,
  loaded: LoadedConfig,
  opts: { ciBundlePath?: string } = {},
): { plan: TxnPlan; branch: string } {
  const stateRead = readState(projectRoot);
  if (stateRead.status !== "ok") throw new Error(`state.json is ${stateRead.status} — cannot enable (fail closed).`);
  const state = stateRead.state;

  // Authoritative remote default branch; never the current branch / stale origin/HEAD.
  const { branch } = resolveDefaultBranch(projectRoot);
  assertBranchRef(branch, projectRoot);

  const next = cloneConfig(loaded.config);
  next["auto-update"] = true;

  const bundlePath = opts.ciBundlePath ?? ciBundlePathFromCli();
  const assets = buildGithubAssets(branch, bundlePath);

  const t = targets();
  // An ignored/untracked required file would never reach GitHub — fail first.
  assertIntegrationTrackable(projectRoot);
  const wfPolicy = ensureWritable(projectRoot, state, t.workflowRel);
  const actionPolicy = ensureWritable(projectRoot, state, t.actionRel);
  const runtimePolicy = ensureWritable(projectRoot, state, t.runtimeRel);

  const txn = emptyPlan();
  txn.writes.push({
    rel: "arte-gitcard.yml",
    abs: path.join(projectRoot, "arte-gitcard.yml"),
    content: serializeConfig(next),
    kind: "config",
    expectedBefore: loaded.sourceSha256 ? { kind: "sha256", sha256: loaded.sourceSha256 } : undefined,
  });
  txn.writes.push({ rel: t.workflowRel, abs: path.join(projectRoot, t.workflowRel), content: assets.workflowYaml, kind: "workflow", expectedBefore: wfPolicy });
  txn.writes.push({ rel: t.actionRel, abs: path.join(projectRoot, t.actionRel), content: assets.actionContent, kind: "ci-action", expectedBefore: actionPolicy });
  txn.writes.push({ rel: t.runtimeRel, abs: path.join(projectRoot, t.runtimeRel), content: assets.runtimeContent, kind: "ci-runtime", expectedBefore: runtimePolicy });

  upsertEntry(state, { path: t.workflowRel, kind: "workflow", sha256: sha256WrittenContent(assets.workflowYaml) });
  upsertEntry(state, { path: t.actionRel, kind: "ci-action", sha256: assets.actionSha256 });
  upsertEntry(state, { path: t.runtimeRel, kind: "ci-runtime", sha256: assets.runtimeSha256 });
  state.github = { defaultBranch: branch };
  txn.stateJson = { rel: STATE_REL, content: serializeState(state) };
  // Optimistic read-set: the exact snapshots this plan derived from (the
  // LoadedConfig's bytes + the StateRead above) — never a late re-read.
  txn.preconditions = [...configSourcePrecondition(loaded), stateSourcePrecondition(stateRead)];
  return { plan: txn, branch };
}

export function githubEnable(
  projectRoot: string,
  loaded: LoadedConfig,
  opts: GithubEnableOptions = {},
): { effects: Effect[]; branch: string; warnings: string[] } {
  const { plan, branch } = buildGithubEnablePlan(projectRoot, loaded, { ciBundlePath: opts.ciBundlePath });
  const result = runTransaction(plan, {
    repoRoot: projectRoot,
    command: "github-enable",
    dryRun: opts.dryRun === true,
    guard: buildManagedGuard(projectRoot, loaded.config),
  });
  return { effects: result.effects, branch, warnings: [] };
}

export function githubDisable(projectRoot: string, loaded: LoadedConfig, opts: { dryRun?: boolean } = {}): { effects: Effect[]; warnings: string[] } {
  const loadedConfig = loaded.config;
  const stateRead = readState(projectRoot);
  if (stateRead.status !== "ok") throw new Error(`state.json is ${stateRead.status} — cannot disable safely.`);
  const state = stateRead.state;

  const t = targets();
  const rels = [t.workflowRel, t.actionRel, t.runtimeRel];
  const blockers: string[] = [];

  // ALL-OR-NOTHING preflight. An ABSENT target with a matching managed entry is
  // NOT a blocker — it is a stale entry that disable will drop.
  for (const rel of rels) {
    const abs = path.join(projectRoot, rel);
    const entry = findEntry(state, rel);
    if (!pathOccupied(abs)) continue; // truly absent → fine (entry dropped below if stale)
    if (!entry) {
      blockers.push(`${rel} exists but is not owned by arte-gitcard`);
      continue;
    }
    const st = assertDeletable(projectRoot, entry);
    if (st === "modified") blockers.push(`${rel} was modified after generation (preserved)`);
    else if (st === "unsafe") blockers.push(`${rel} is at an unsafe path`);
  }
  if (blockers.length > 0) {
    throw new Error(
      "github disable ABORTED — no changes were made (config stays enabled):\n" +
        blockers.map((b) => `  - ${b}`).join("\n") +
        "\n\nResolve the files above (arte-gitcard doctor) before disabling.",
    );
  }

  const next = cloneConfig(loadedConfig);
  next["auto-update"] = false;

  const txn = emptyPlan();
  txn.writes.push({
    rel: "arte-gitcard.yml",
    abs: path.join(projectRoot, "arte-gitcard.yml"),
    content: serializeConfig(next),
    kind: "config",
    expectedBefore: loaded.sourceSha256 ? { kind: "sha256", sha256: loaded.sourceSha256 } : undefined,
  });
  for (const rel of rels) {
    const entry = findEntry(state, rel);
    if (!entry) continue;
    const abs = path.join(projectRoot, rel);
    if (pathOccupied(abs)) {
      // Preflight guaranteed this is owned + unmodified.
      txn.deletes.push({ rel, abs, kind: entry.kind, expectedSha256: entry.sha256 });
    }
    removeEntry(state, rel); // drop the entry even when the file is already absent
  }
  state.github = undefined;
  txn.stateJson = { rel: STATE_REL, content: serializeState(state) };
  txn.preconditions = [...configSourcePrecondition(loaded), stateSourcePrecondition(stateRead)];

  const result = runTransaction(txn, {
    repoRoot: projectRoot,
    command: "github-disable",
    dryRun: opts.dryRun === true,
    guard: buildManagedGuard(projectRoot, next),
  });
  return { effects: result.effects, warnings: [] };
}

export interface GithubSyncPlan {
  plan: TxnPlan;
  changed: boolean;
}

/** Build the sync plan WITHOUT applying it (testable): reconcile the COMPLETE
 * desired state every run (default branch → workflow/action/runtime + integrity
 * hashes + ownership + state). No commit/push/remote mutation. Optimistic
 * config+state read-set so a stale plan fails with a retry, never recreating an
 * integration a concurrent disable just removed. */
export function buildGithubSyncPlan(
  projectRoot: string,
  loaded: LoadedConfig,
  opts: { ciBundlePath?: string } = {},
): GithubSyncPlan {
  const stateRead = readState(projectRoot);
  if (stateRead.status !== "ok") throw new Error(`state.json is ${stateRead.status} — cannot sync.`);
  const state = stateRead.state;

  const { branch } = resolveDefaultBranch(projectRoot);
  assertBranchRef(branch, projectRoot);

  const bundlePath = opts.ciBundlePath ?? ciBundlePathFromCli();
  const assets = buildGithubAssets(branch, bundlePath);

  assertIntegrationTrackable(projectRoot);

  const t = targets();
  // Preflight each integration target once; the returned policy is attached to
  // the write (absent → pin; owned present → deliberate sync reclaim, unset).
  const policy = new Map<string, ExpectedBefore | undefined>([
    [t.workflowRel, ensureReclaimable(projectRoot, state, t.workflowRel)],
    [t.actionRel, ensureReclaimable(projectRoot, state, t.actionRel)],
    [t.runtimeRel, ensureReclaimable(projectRoot, state, t.runtimeRel)],
  ]);

  const desired: Array<{ rel: string; kind: "workflow" | "ci-action" | "ci-runtime"; content: string; sha256: string }> = [
    { rel: t.workflowRel, kind: "workflow", content: assets.workflowYaml, sha256: sha256WrittenContent(assets.workflowYaml) },
    { rel: t.actionRel, kind: "ci-action", content: assets.actionContent, sha256: assets.actionSha256 },
    { rel: t.runtimeRel, kind: "ci-runtime", content: assets.runtimeContent, sha256: assets.runtimeSha256 },
  ];

  // Diff the complete desired state against the repository; queue only repairs.
  const writes: Array<{ rel: string; kind: "workflow" | "ci-action" | "ci-runtime"; content: string; sha256: string; expectedBefore: ExpectedBefore | undefined }> = [];
  let changed = state.github?.defaultBranch !== branch;
  for (const d of desired) {
    const entry = findEntry(state, d.rel);
    const diskMatches = fileContentEquals(projectRoot, d.rel, d.content);
    // Ownership reconciliation compares path, KIND and sha — a state entry with
    // the right hash but the WRONG kind (e.g. workflow stored as `ci-runtime`)
    // is drift and must be repaired.
    const entryMatches = entry !== undefined && entry.kind === d.kind && entry.sha256 === d.sha256;
    if (!diskMatches || !entryMatches) {
      writes.push({ ...d, expectedBefore: policy.get(d.rel) });
      upsertEntry(state, { path: d.rel, kind: d.kind, sha256: d.sha256 });
      changed = true;
    }
  }

  if (!changed) {
    return { plan: emptyPlan(), changed: false };
  }

  state.github = { defaultBranch: branch };
  const txn = emptyPlan();
  for (const w of writes) {
    txn.writes.push({ rel: w.rel, abs: path.join(projectRoot, w.rel), content: w.content, kind: w.kind, expectedBefore: w.expectedBefore });
  }
  txn.stateJson = { rel: STATE_REL, content: serializeState(state) };
  // Optimistic read-set: the config snapshot that gates sync + the StateRead the
  // plan was derived from — never a late re-read (a stale plan must not recreate
  // an integration a concurrent disable just removed).
  txn.preconditions = [...configSourcePrecondition(loaded), stateSourcePrecondition(stateRead)];
  return { plan: txn, changed: true };
}

export function githubSync(
  projectRoot: string,
  loaded: LoadedConfig,
  opts: { dryRun?: boolean; ciBundlePath?: string } = {},
): { effects: Effect[]; warnings: string[] } {
  if (loaded.config["auto-update"] !== true) {
    return { effects: [], warnings: ["auto-update is disabled — nothing to synchronize (use `arte-gitcard github enable`)."] };
  }
  const { plan, changed } = buildGithubSyncPlan(projectRoot, loaded, { ciBundlePath: opts.ciBundlePath });
  if (!changed) return { effects: [], warnings: [] };

  const result = runTransaction(plan, {
    repoRoot: projectRoot,
    command: "github-sync",
    dryRun: opts.dryRun === true,
    guard: buildManagedGuard(projectRoot, loaded.config),
  });
  return { effects: result.effects, warnings: [] };
}

export interface GithubStatus {
  enabled: boolean;
  /** The installed default-branch snapshot (state.json), not user config. */
  branch: string | null;
  workflowPresent: boolean;
  workflowOwned: boolean;
  ciPresent: boolean;
  configPath: string | null;
}

export function githubStatus(projectRoot: string): { status: GithubStatus; lines: string[] } {
  const cfgPath = path.join(projectRoot, "arte-gitcard.yml");
  let cfg: ArteGitCardConfig | null = null;
  try {
    cfg = YAML.parse(readFileSync(cfgPath, "utf8")) as ArteGitCardConfig;
  } catch {
    cfg = null;
  }
  const state = readState(projectRoot);
  const st = state.status === "ok" ? state.state : null;
  const enabled = cfg?.["auto-update"] === true;
  const branch = st?.github?.defaultBranch ?? null;
  const wfOwned = st ? findEntry(st, WORKFLOW_REL) !== undefined : false;
  const status: GithubStatus = {
    enabled,
    branch,
    workflowPresent: pathOccupied(path.join(projectRoot, WORKFLOW_REL)),
    workflowOwned: wfOwned,
    ciPresent: pathOccupied(path.join(projectRoot, CI_ACTION_REL)) || pathOccupied(path.join(projectRoot, CI_RUNTIME_REL)),
    configPath: pathOccupied(cfgPath) ? cfgPath : null,
  };
  const lines = [
    `auto-update: ${enabled ? "enabled" : "disabled"}`,
    `default branch: ${branch ?? "n/a"}`,
    `workflow: ${status.workflowPresent ? (wfOwned ? "present (owned)" : "present (NOT owned)") : "absent"}`,
    `ci action/runtime: ${status.ciPresent ? "present" : "absent"}`,
  ];
  return { status, lines };
}
