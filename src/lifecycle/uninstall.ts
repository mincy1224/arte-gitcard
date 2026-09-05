/**
 * `arte-gitcard uninstall` — safe removal of arte-gitcard from a repository,
 * returning it to (as close as the filesystem allows) UNINITIALIZED.
 *
 * THE ONE RULE: uninstall NEVER deletes, overwrites or modifies any file that
 * arte-gitcard cannot PROVE it owns and that is currently UNCHANGED.
 *
 *   CODE DEFINES PATH AUTHORITY.   STATE ONLY PROVES OWNERSHIP.
 *   DIRECTORIES NEVER GRANT RECURSIVE DELETE AUTHORITY.
 *   (uninstall deletes NO directories at all — U-4.)
 *
 * Only these files are ever removed, and each through the SAME staged +
 * journaled + crash-recoverable transaction engine used everywhere else:
 *   1. generated/managed files (card/preview/workflow/ci-action/ci-runtime)
 *      whose path is inside the CURRENT strict-valid config's authority, whose
 *      state.json entry matches, and whose on-disk SHA-256 still equals the
 *      recorded hash (ok). Modified / unsafe / out-of-authority / unowned are
 *      PRESERVED and reported, never guessed at from a filename or a directory.
 *   2. a BUILTIN theme arte-gitcard materialized (arte-theme / github-theme)
 *      ONLY when its provenance entry exists and its bytes are unchanged.
 *      Custom / user-installed / unowned / modified themes are preserved.
 *   3. arte-gitcard.yml — removed by the EXPLICIT authority of running
 *      `arte-gitcard uninstall`, still gated on a regular, repo-contained,
 *      non-symlink file.
 *   4. .arte-git-card/state.json — LAST (ownership evidence must outlive the
 *      deletes it proves).
 *
 * Crash recovery (U-1): an uninstall delete plan can crash AFTER the config
 * delete but BEFORE state.json/journal cleanup. On the next `uninstall`, the
 * orphan journal is inspected BEFORE the normal (config-required) preconditions
 * run. A journal that is structurally proven to be an uninstall DELETE tail is
 * then completed with a CONFIG-LESS authority: every earlier managed delete must
 * already be ABSENT (if it reappeared/exists, STOP and preserve — the config
 * that defined the output authority is gone), and state.json is only completed
 * when it is the fixed, unchanged regular file matching the recorded hash. The
 * journal is removed only after clean completion. state.outputRoots and arbitrary
 * journal paths are never used as card authority.
 *
 * Preconditions (for a FRESH uninstall, i.e. no orphan tail) are all-or-nothing
 * (fail closed, ZERO writes): a v2 config must exist as a regular file and
 * strict-load, its output directory must be a valid in-repo path, and state.json
 * must be present and valid — otherwise no ownership can be proven and uninstall
 * refuses.
 */

import path from "node:path";
import { lstatSync, readdirSync } from "node:fs";
import { CONFIG_FILENAME, LEGACY_CONFIG_FILENAME, resolveFromProject } from "../config/paths.js";
import { loadConfig } from "../config/load.js";
import type { LoadedConfig } from "../config/types.js";
import { assertOutputDirInside } from "../config/root.js";
import { runTransaction } from "../txn/engine.js";
import { emptyPlan } from "../txn/plan.js";
import type { DeleteOp, ManagedKind, TxnPlan } from "../txn/plan.js";
import { buildManagedGuard } from "../state/guards.js";
import { assertDeletable, readState } from "../state/registry.js";
import type { StateRead } from "../state/registry.js";
import { entryPresence } from "../fs/presence.js";
import { pathHasNoSymlinkComponents } from "../fs/pathguard.js";
import { sha256File } from "../fs/hash.js";
import { atomicRemove } from "../fs/atomic.js";
import { acquireRepoLock } from "../fs/lock.js";
import { inspectJournal, readJournal, removeJournal } from "../txn/journal.js";
import type { TxnJournal } from "../txn/journal.js";
import {
  CI_ACTION_REL,
  CI_RUNTIME_REL,
  JOURNAL_REL,
  LOCK_REL,
  PREVIEW_FILENAME,
  STATE_REL,
  THEMES_DIR_REL,
  WORKFLOW_REL,
} from "../managed/paths.js";
import { isPreset } from "../thememgr/index.js";
import { DEFAULT_RUNTIME } from "../runtime.js";
import type { ArteRuntime } from "../runtime.js";
import { isUninstallTailJournal } from "./uninstall-journal.js";

export type UninstallReason = "modified" | "unowned" | "unsafe" | "custom-theme";

export interface UninstallPreserved {
  path: string;
  reason: UninstallReason;
}

export interface UninstallResult {
  /** repo-relative managed files removed (dry-run: would remove). */
  removed: string[];
  preserved: UninstallPreserved[];
  /** config + state were (or would be) removed → the repo is uninitialized. */
  status: "uninitialized";
}

export interface UninstallOptions {
  dryRun?: boolean;
  /** compiled runtime whose registered card filenames are the authority. */
  runtime?: ArteRuntime;
}

const GENERATED_KINDS = new Set<string>(["card", "preview", "workflow", "ci-action", "ci-runtime"]);
const TOOL_DIR_REL = ".arte-git-card";

/**
 * The tool's own directory must be reached through REAL non-symlink directories.
 * When `.arte-git-card` exists it must be a real directory (never a symlink/
 * junction to user-data or anywhere else). This is checked BEFORE readState,
 * lock acquisition, journal inspection and state deletion — a symlinked tool
 * directory must never make readState/lock/journal/state operate inside its
 * target (P0 ancestor-symlink rule).
 */
function toolDirSafe(projectRoot: string): boolean {
  let st;
  try {
    st = lstatSync(path.join(projectRoot, TOOL_DIR_REL));
  } catch (err) {
    // ONLY a true ENOENT means `.arte-git-card` is genuinely absent (nothing to
    // follow). Any other filesystem error is UNVERIFIABLE → FAIL CLOSED.
    const code = (err as NodeJS.ErrnoException)?.code;
    return code === "ENOENT";
  }
  if (st.isSymbolicLink()) return false;
  if (!st.isDirectory()) return false; // a regular file / special entry at the tool dir path
  return true;
}

/**
 * Compose the strict uninstall authority: the normal code-derived managed guard
 * AND the requirement that every existing path component (repoRoot → target) is
 * a real non-symlink entry. A symlink may NEVER redirect managed-path authority
 * onto a user/project file, even when its target stays inside the repository.
 */
function strictManagedGuard(
  projectRoot: string,
  config: { output: { directory: string } },
  runtime: ArteRuntime,
  baseGuard: (ctx: { kind: string; rel: string }) => boolean,
): (ctx: { kind: string; rel: string }) => boolean {
  return (ctx) => baseGuard(ctx) && pathHasNoSymlinkComponents(projectRoot, ctx.rel);
}

function relDir(projectRoot: string, directory: string): string {
  const abs = resolveFromProject(projectRoot, directory);
  return path.relative(projectRoot, abs).split(path.sep).join("/");
}

function themeNameOf(rel: string): string {
  return path.posix.basename(rel.replace(/\\/g, "/")).replace(/\.yml$/i, "");
}

function readdirIfPresent(abs: string): string[] | null {
  try {
    return readdirSync(abs);
  } catch {
    return null;
  }
}

/**
 * Preconditions for a FRESH uninstall (fail closed, zero writes). Returns the
 * strict-loaded config. A symlink/directory at arte-gitcard.yml, a DAMAGED
 * config, an invalid output directory, or a missing/corrupt/incompatible
 * state.json all REFUSE. NOTE: the orphan uninstall-tail path is handled BEFORE
 * this (config is already gone there).
 */
function assertUninstallable(
  projectRoot: string,
): { loaded: LoadedConfig; stateRead: StateRead & { status: "ok" } } {
  const configAbs = path.join(projectRoot, CONFIG_FILENAME);
  const legacyAbs = path.join(projectRoot, LEGACY_CONFIG_FILENAME);
  const cfgPresence = entryPresence(configAbs);
  const legacyPresence = entryPresence(legacyAbs);

  if (cfgPresence === "absent") {
    if (legacyPresence !== "absent") {
      throw new Error(
        "This repository has a legacy v1 arte-git-card.yml. uninstall removes only the v2 installation and " +
          "never deletes the legacy file. Run `arte-gitcard migrate` first (then remove the legacy file manually).",
      );
    }
    throw new Error("No arte-gitcard.yml found — nothing to uninstall. Run `arte-gitcard init` to set it up.");
  }
  if (cfgPresence !== "file") {
    throw new Error(
      "arte-gitcard.yml is not a regular file (symlink/directory/…) — refusing to uninstall without following it (preserving). " +
        'Run "arte-gitcard doctor" to inspect.',
    );
  }

  // strict v2 load: a DAMAGED config cannot be the output-dir authority. This is
  // the SINGLE config read — its sourceSha256 drives both the config delete's
  // expected sha and the transaction precondition (never a late re-hash).
  const loaded = loadConfig(configAbs);
  // semantic output check: output.directory must be a valid in-repo non-root dir.
  assertOutputDirInside(projectRoot, loaded.config.output.directory);

  const stateRead = readState(projectRoot);
  if (stateRead.status !== "ok") {
    throw new Error(
      `.arte-git-card/state.json is ${stateRead.status} — arte-gitcard cannot prove ownership of generated files, ` +
        "so uninstall aborted with ZERO changes. Run `arte-gitcard doctor` for diagnostics.",
    );
  }
  return { loaded, stateRead };
}

// ---------------------------------------------------------------------------
// U-1: orphan uninstall-tail recovery (config already gone)
// ---------------------------------------------------------------------------

/**
 * Classify what completing the tail would require. Returns blockers (paths that
 * exist and must NOT be deleted on journal evidence alone, because the config —
 * the output-authority source — is gone) and whether state.json is an unchanged
 * regular file that the fixed state authority allows us to remove.
 */
function analyzeTail(projectRoot: string, journal: TxnJournal): { blockers: string[]; removeState: boolean } {
  const blockers: string[] = [];
  let removeState = false;
  for (const op of journal.ops) {
    const abs = path.join(projectRoot, op.rel);
    const presence = entryPresence(abs);
    if (presence === "absent") continue; // already removed → the prefix is complete
    if (op.rel === STATE_REL) {
      // Fixed code-authority path: an unchanged regular file may be completed.
      if (presence === "file" && op.beforeSha256 !== null && sha256File(abs) === op.beforeSha256) removeState = true;
      else blockers.push(op.rel);
      continue;
    }
    // config reappeared, OR any earlier card/theme/workflow/ci target still
    // exists. The config that defined its output authority is gone, so it can
    // never be re-derived — STOP and preserve (never delete on journal evidence).
    blockers.push(op.rel);
  }
  return { blockers, removeState };
}

/**
 * Complete the tail UNDER THE LOCK with fresh per-op checks (TOCTOU-safe).
 * Earlier (non-state) targets must be absent — if any exists we preserve and
 * stop before touching state; state.json is only removed when it is the fixed
 * unchanged regular file. On clean completion the journal is removed.
 */
function completeTailLocked(projectRoot: string, journal: TxnJournal, journalPath: string): string[] {
  const preserved: string[] = [];
  // P0: re-verify the tool directory is still reached through real non-symlink
  // directories before deleting state or the journal (TOCTOU-safe).
  if (!toolDirSafe(projectRoot)) {
    preserved.push(STATE_REL);
    return preserved;
  }
  for (const op of journal.ops) {
    const abs = path.join(projectRoot, op.rel);
    const presence = entryPresence(abs);
    if (presence === "absent") continue;
    if (op.rel === STATE_REL) {
      if (!pathHasNoSymlinkComponents(projectRoot, op.rel)) {
        preserved.push(op.rel);
        break;
      }
      if (presence === "file" && op.beforeSha256 !== null && sha256File(abs) === op.beforeSha256) {
        atomicRemove(abs); // state.json last
        continue;
      }
      preserved.push(op.rel);
      break;
    }
    preserved.push(op.rel);
    break;
  }
  if (preserved.length === 0 && toolDirSafe(projectRoot)) removeJournal(journalPath);
  return preserved;
}

/** Handle a config-absent uninstall-tail journal (U-1). Mutates only on clean completion. */
function recoverUninstallTail(
  projectRoot: string,
  journal: TxnJournal,
  journalPath: string,
  dryRun: boolean,
): UninstallResult {
  const { blockers, removeState } = analyzeTail(projectRoot, journal);
  if (blockers.length > 0) {
    throw new Error(
      "Uninstall cannot complete: an interrupted uninstall was found but a previously-removed file reappeared or " +
        `state.json was modified — preserved: ${blockers.join(", ")}. ` +
        "The config (the output-directory authority) is gone, so arte-gitcard will NOT delete anything on journal " +
        'evidence alone. Run "arte-gitcard doctor" to inspect.',
    );
  }
  if (dryRun) {
    return { removed: removeState ? [STATE_REL] : [], preserved: [], status: "uninitialized" };
  }

  const lockPath = path.join(projectRoot, LOCK_REL);
  const lock = acquireRepoLock(lockPath, "uninstall-recover");
  try {
    const preserved = completeTailLocked(projectRoot, journal, journalPath);
    if (preserved.length > 0) {
      throw new Error(
        "Uninstall interrupted: a file reappeared or state.json changed between planning and recovery — preserved: " +
          `${preserved.join(", ")}. Nothing was deleted. Run "arte-gitcard doctor".`,
      );
    }
  } finally {
    lock.release();
  }
  return { removed: removeState ? [STATE_REL] : [], preserved: [], status: "uninitialized" };
}

// ---------------------------------------------------------------------------
// fresh uninstall planning
// ---------------------------------------------------------------------------

/**
 * Occupied CODE-DERIVED managed candidates that are NOT in the authorized delete
 * plan are reported (unowned / unsafe) so the user is explicitly told they
 * remain after uninstall. No arbitrary repository directory is enumerated.
 */
function reportUnownedCandidates(
  projectRoot: string,
  runtime: ArteRuntime,
  outputRel: string,
  planDeleteRels: Set<string>,
  addPreserved: (rel: string, reason: UninstallReason) => void,
): void {
  const candidates: string[] = [];
  const push = (rel: string): void => {
    if (!candidates.includes(rel)) candidates.push(rel);
  };
  for (const file of runtime.cardFilenames) push(`${outputRel}/${file}`);
  push(`${outputRel}/${PREVIEW_FILENAME}`);
  push(WORKFLOW_REL);
  push(CI_ACTION_REL);
  push(CI_RUNTIME_REL);
  push(`${THEMES_DIR_REL}/arte-theme.yml`);
  push(`${THEMES_DIR_REL}/github-theme.yml`);

  for (const rel of candidates) {
    if (planDeleteRels.has(rel)) continue; // owned + unchanged → already queued for removal
    const abs = resolveFromProject(projectRoot, rel);
    if (entryPresence(abs) === "absent") continue;
    if (!pathHasNoSymlinkComponents(projectRoot, rel)) {
      addPreserved(rel, "unsafe"); // a symlink ancestor redirects authority → unsafe
      continue;
    }
    const presence = entryPresence(abs);
    addPreserved(rel, presence === "file" ? "unowned" : "unsafe");
  }
}

/**
 * Files/special entries under `.arte-git-card/` that will remain after the plan.
 * Regular files → unowned; symlinks / special / unreadable entries → unsafe
 * (never followed, never read through). Never descends into a symlinked dir.
 */
function remainingUnknownDotFiles(
  projectRoot: string,
  excluded: Set<string>,
  alreadyReported: Set<string>,
): UninstallPreserved[] {
  const out: UninstallPreserved[] = [];
  const dotAbs = path.join(projectRoot, ".arte-git-card");
  const walk = (dirAbs: string, dirRel: string): void => {
    const names = readdirIfPresent(dirAbs);
    if (!names) return;
    for (const name of names) {
      const rel = dirRel ? `${dirRel}/${name}` : name;
      if (excluded.has(rel) || alreadyReported.has(rel)) continue;
      const abs = path.join(dirAbs, name);
      let st;
      try {
        st = lstatSync(abs);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) {
        out.push({ path: rel, reason: "unsafe" }); // report the link, never follow it
        continue;
      }
      if (st.isDirectory()) {
        walk(abs, rel);
        continue;
      }
      if (st.isFile()) out.push({ path: rel, reason: "unowned" });
      else out.push({ path: rel, reason: "unsafe" }); // socket/FIFO/device/…
    }
  };
  walk(dotAbs, ".arte-git-card");
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export interface UninstallFreshPlan {
  plan: TxnPlan;
  preserved: UninstallPreserved[];
  guard: (ctx: { kind: string; rel: string }) => boolean;
}

/**
 * Build a FRESH uninstall plan WITHOUT applying it (test seam). Reads config and
 * state EXACTLY ONCE (assertUninstallable). The config delete carries
 * LoadedConfig.sourceSha256 and the state delete carries StateRead.sha256 — the
 * ORIGINAL snapshots, never a late re-hash. Transaction preconditions pin both,
 * so if config/state change after planning began the uninstall fails with ZERO
 * mutation before deleting anything.
 */
export function buildUninstallPlan(projectRoot: string, runtime: ArteRuntime): UninstallFreshPlan {
  const { loaded, stateRead } = assertUninstallable(projectRoot);
  const config = loaded.config;
  const state = stateRead.state;

  const outputRel = relDir(projectRoot, config.output.directory);
  // CODE = lexical path authority; STATE = ownership evidence; FILESYSTEM = the
  // authority must not be redirected through ANY symlink ancestor.
  const baseGuard = buildManagedGuard(projectRoot, config, { runtime });
  const guard = strictManagedGuard(projectRoot, config, runtime, baseGuard);

  const txn = emptyPlan();
  const deletes: DeleteOp[] = [];
  const preserved: UninstallPreserved[] = [];
  const preservedSet = new Set<string>();
  const planDeleteRels = new Set<string>();

  const addPreserved = (rel: string, reason: UninstallReason): void => {
    if (preservedSet.has(rel)) return;
    preservedSet.add(rel);
    preserved.push({ path: rel, reason });
  };
  const queueDelete = (rel: string, kind: ManagedKind, expectedSha256: string): void => {
    deletes.push({ rel, abs: path.join(projectRoot, rel), kind, expectedSha256 });
    planDeleteRels.add(rel);
  };

  // ---- generated / managed files: authority + ownership + hash, one by one ----
  for (const entry of state.managedFiles) {
    if (entry.kind === "theme") continue; // themes handled below (conservative rule)
    if (!GENERATED_KINDS.has(entry.kind)) continue; // defensive; schema forbids others
    if (!guard({ kind: entry.kind, rel: entry.path })) {
      // A state entry at a path that is NOT a managed path for this kind (forged
      // src/index.ts, an old/historical output root, …) grants nothing.
      addPreserved(entry.path, "unsafe");
      continue;
    }
    const status = assertDeletable(projectRoot, entry);
    if (status === "ok") {
      queueDelete(entry.path, entry.kind, entry.sha256);
    } else if (status === "modified") {
      addPreserved(entry.path, "modified");
    } else if (status === "unsafe") {
      addPreserved(entry.path, "unsafe");
    }
    // status === "missing" → the file is already gone; nothing to delete.
  }

  // ---- themes: the MOST conservative rule ----
  for (const entry of state.managedFiles) {
    if (entry.kind !== "theme") continue;
    if (!guard({ kind: "theme", rel: entry.path })) {
      addPreserved(entry.path, "unsafe");
      continue;
    }
    const name = themeNameOf(entry.path);
    if (!isPreset(name)) {
      // Custom / user-installed theme → PRESERVE by default (never remove a
      // user's theme just because uninstall runs).
      addPreserved(entry.path, "custom-theme");
      continue;
    }
    // A builtin preset arte-gitcard MATERIALIZED (artetheme/github-theme): only
    // removable when owned + unchanged.
    const status = assertDeletable(projectRoot, entry);
    if (status === "ok") {
      queueDelete(entry.path, "theme", entry.sha256);
    } else if (status === "modified") {
      addPreserved(entry.path, "modified");
    } else if (status === "unsafe") {
      addPreserved(entry.path, "unsafe");
    }
  }

  // Unowned theme FILES on disk (no ownership entry) → preserved, never claimed.
  // Only enumerate when the themes dir is reached through real directories; a
  // symlinked themes dir is never followed (its candidates are reported unsafe).
  if (pathHasNoSymlinkComponents(projectRoot, THEMES_DIR_REL)) {
    const themesAbs = resolveFromProject(projectRoot, THEMES_DIR_REL);
    for (const file of readdirIfPresent(themesAbs) ?? []) {
      if (!file.endsWith(".yml")) continue;
      const rel = `${THEMES_DIR_REL}/${file}`;
      if (planDeleteRels.has(rel) || preservedSet.has(rel)) continue;
      const presence = entryPresence(resolveFromProject(projectRoot, rel));
      addPreserved(rel, presence === "file" ? "unowned" : "unsafe");
    }
  }

  // ---- arte-gitcard.yml (explicit uninstall authority; the EXACT bytes loaded
  // and parsed by assertUninstallable — never a re-hash near the end) ----
  const cfgSha = loaded.sourceSha256;
  if (!cfgSha) {
    throw new Error(
      `cannot verify arte-gitcard.yml to remove it (config not loaded from disk) — uninstall aborted, preserving it.`,
    );
  }
  queueDelete(CONFIG_FILENAME, "config", cfgSha);

  // ---- state.json LAST (ownership evidence outlives the deletes it proves);
  // expected sha = the EXACT bytes that were read/parsed above ----
  queueDelete(STATE_REL, "state", stateRead.sha256);

  // ---- U-5: every occupied CODE-DERIVED candidate that will remain is reported.
  // The transient lock/journal paths are never reported (tool-internal). ----
  reportUnownedCandidates(projectRoot, runtime, outputRel, planDeleteRels, addPreserved);
  const dotExcluded = new Set(planDeleteRels);
  dotExcluded.add(LOCK_REL);
  dotExcluded.add(JOURNAL_REL);
  const remaining = remainingUnknownDotFiles(projectRoot, dotExcluded, preservedSet);
  for (const r of remaining) addPreserved(r.path, r.reason);

  txn.deletes.push(...deletes);
  // Optimistic read-set: config/state were read once at the start; if either
  // changes after planning, the stale delete plan must fail BEFORE deleting
  // anything (the config is the output-authority source; state is the ownership
  // evidence the plan's deletes were derived from).
  txn.preconditions = [
    loaded.sourceSha256
      ? { kind: "sha256", rel: CONFIG_FILENAME, expectedSha256: loaded.sourceSha256 }
      : { kind: "absent", rel: CONFIG_FILENAME },
    { kind: "sha256", rel: STATE_REL, expectedSha256: stateRead.sha256 },
  ];

  preserved.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { plan: txn, preserved, guard };
}

export function uninstallRepository(projectRoot: string, opts: UninstallOptions = {}): UninstallResult {
  const runtime = opts.runtime ?? DEFAULT_RUNTIME;
  const dryRun = opts.dryRun === true;
  const configAbs = path.join(projectRoot, CONFIG_FILENAME);
  const journalPath = path.join(projectRoot, JOURNAL_REL);

  // ---- P0 ancestor-symlink precondition: the tool's own directory must be a
  // REAL non-symlink directory before ANY read (readState / journal / lock) or
  // delete. A symlinked `.arte-git-card` never redirects tool authority. ----
  if (!toolDirSafe(projectRoot)) {
    throw new Error(
      ".arte-git-card is a symlink/unsafe entry (not a real directory). Refusing to uninstall through it — " +
        "nothing was read, created, modified or deleted (zero changes). Run `arte-gitcard doctor`.",
    );
  }

  // ---- U-1: an orphan uninstall-tail journal (config already gone) is handled
  // BEFORE the normal config-required preconditions, so a crash in the terminal
  // window (after the config delete, before state.json cleanup) can recover. ----
  const inspection = inspectJournal(journalPath, projectRoot);
  if (inspection.present && entryPresence(configAbs) === "absent") {
    if (inspection.state !== "clean") {
      throw new Error(
        `An orphaned transaction journal exists (${inspection.state}) but no config remains — arte-gitcard cannot ` +
          `recover it or continue. Nothing was changed. Run "arte-gitcard doctor" (the journal was preserved).`,
      );
    }
    const journal = readJournal(journalPath);
    if (journal && isUninstallTailJournal(journal)) {
      return recoverUninstallTail(projectRoot, journal, journalPath, dryRun);
    }
    throw new Error(
      "An orphaned arte-gitcard transaction journal exists but this repository has no config, and the journal is " +
        "not a recoverable uninstall tail. Nothing was changed. Run `arte-gitcard doctor`.",
    );
  }

  // ---- fresh uninstall (or a config-present crash: runTransaction recovers) ----
  const fresh = buildUninstallPlan(projectRoot, runtime);

  const result = runTransaction(fresh.plan, {
    repoRoot: projectRoot,
    command: "uninstall",
    dryRun,
    guard: fresh.guard,
  });

  const removed = result.effects
    .filter((e) => e.type === "delete")
    .map((e) => e.rel)
    .sort();

  return { removed, preserved: fresh.preserved, status: "uninitialized" };
}
