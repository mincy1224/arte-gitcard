/**
 * `arte-gitcard reset` (P0) — explicit destructive reinitialization as ONE
 * transaction. NEVER force-deletes: only files with PROVEN ownership (state entry
 * + kind guard + hash match) are removed; modified/unsafe/unowned files are
 * preserved and reported. Custom installed themes are preserved WITH provenance.
 * state.json missing/corrupt ⇒ nothing is provably owned, so no deletion happens
 * (config is still reset; leftovers reported).
 *
 * Path-authority invariant (P0): state.outputRoots is OWNERSHIP/ACTIVITY
 * metadata only — it NEVER authorizes a write/delete. Delete authority comes
 * from code-derived fixed paths + the *current strict-valid config's* output dir
 * + the code default output dir. Forged entries (e.g. `src/codebase.svg`) are
 * never deleted, never blocking, never written back. Historical outputRoots are
 * carried forward (deduped) only as Activity-exclusion metadata.
 */

import path from "node:path";
import { lstatSync, readFileSync } from "node:fs";
import YAML from "yaml";
import { pathOccupied } from "../fs/presence.js";
import { CONFIG_FILENAME, resolveFromProject } from "../config/paths.js";
import { CONFIG_TEMPLATE } from "../init/templates.js";
import { DEFAULT_CONFIG_V2, buildDefaultConfig } from "../config/defaults.js";
import { DEFAULT_THEME } from "../theme/default-theme.js";
import { runTransaction } from "../txn/engine.js";
import type { Effect } from "../txn/engine.js";
import { emptyPlan } from "../txn/plan.js";
import type { ManagedKind, Precondition, ExpectedBefore, TxnPlan } from "../txn/plan.js";
import { buildManagedGuard } from "../state/guards.js";
import {
  assertDeletable,
  initialState,
  readState,
  removeEntry,
  serializeState,
  upsertEntry,
} from "../state/registry.js";
import type { ArteGitcardState } from "../state/registry.js";
import { sha256WrittenContent } from "../fs/atomic.js";
import { sha256Content } from "../fs/hash.js";
import { STATE_REL } from "../managed/paths.js";
import { DEFAULT_RUNTIME } from "../runtime.js";
import type { ArteRuntime } from "../runtime.js";
import type { ArteGitCardConfig } from "../config/types.js";
import { planCardArtifactsInternal } from "../generate/plan.js";
import type { PlannedCardArtifact } from "../generate/plan.js";
import { DEFAULT_THEME_REL } from "./init.js";
import { planSelectedTheme } from "./themeplan.js";

const GENERATED_KINDS = new Set<string>(["card", "preview", "workflow", "ci-action", "ci-runtime"]);

export interface ResetResult {
  effects: Effect[];
  warnings: string[];
  preserved: string[];
}

export interface ResetOptions {
  dryRun?: boolean;
  /** compiled runtime whose displays set the card authority (default: production). */
  runtime?: ArteRuntime;
}

function relDir(projectRoot: string, directory: string): string {
  const abs = resolveFromProject(projectRoot, directory);
  return path.relative(projectRoot, abs).split(path.sep).join("/");
}

/** Safe existing regular file (not a symlink/junction/dir). */
function isRegularFile(abs: string): boolean {
  try {
    const st = lstatSync(abs);
    return !st.isSymbolicLink() && st.isFile();
  } catch {
    return false;
  }
}

/** Read a source file ONCE. ENOENT → null (positively absent); any other error
 * (unreadable/directory/special) → fail closed — no trustworthy snapshot exists,
 * and reset must never manufacture one with a later re-read. */
function readRawOnce(abs: string, label: string): Buffer | null {
  try {
    return readFileSync(abs);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return null;
    throw new Error(
      `${label} could not be read/verified (${code ?? "error"}) — reset aborted (fail closed), no trustworthy ` +
        `snapshot could be captured. Run "arte-gitcard doctor" to inspect.`,
    );
  }
}

/** Parse a strict v2 config from EXACT raw bytes under `runtime`; null when the
 * config is damaged/legacy (no trustworthy output-dir authority). */
function parseConfigFromBytes(bytes: Buffer, runtime: ArteRuntime): ArteGitCardConfig | null {
  let value: unknown;
  try {
    value = YAML.parse(bytes.toString("utf8"));
  } catch {
    return null;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const result = runtime.config.v2Schema.safeParse(value);
  return result.success ? result.data : null;
}

export interface ResetPlan {
  plan: TxnPlan;
  warnings: string[];
  preserved: string[];
  guard: (ctx: { kind: string; rel: string }) => boolean;
}

export function buildResetRepositoryPlan(projectRoot: string, opts: ResetOptions = {}): ResetPlan {
  const runtime = opts.runtime ?? DEFAULT_RUNTIME;
  const warnings: string[] = [];
  const preserved: string[] = [];
  const blocking: string[] = [];

  // ---- single-observation source snapshots (read once; never re-read late) ----
  // State: readState reads the exact bytes once — the ok/corrupt/incompatible
  // variants all carry the sha of those bytes (null only when no trustworthy
  // snapshot could be read). This one result drives BOTH the ownership logic
  // below AND the transaction precondition.
  const read = readState(projectRoot);
  const baseState: ArteGitcardState | null = read.status === "ok" ? JSON.parse(JSON.stringify(read.state)) : null;
  const txn = emptyPlan();

  // Authority dirs are CODE-derived, never from state.outputRoots.
  const defaultCfg = buildDefaultConfig();
  const defaultOutputRel = relDir(projectRoot, DEFAULT_CONFIG_V2.output.directory);

  // Config: read the EXACT bytes ONCE. Those same bytes determine whether the
  // config is missing/damaged/valid (and thus the current-config output-dir
  // authority) AND become the transaction precondition — a config that changes
  // after planning fails with ZERO mutation. Damaged bytes are still pinned.
  const configBuf = readRawOnce(path.join(projectRoot, CONFIG_FILENAME), "arte-gitcard.yml");
  let configPre: Precondition;
  let currentOutputRel: string | null = null;
  if (configBuf === null) {
    configPre = { kind: "absent", rel: CONFIG_FILENAME };
  } else {
    configPre = { kind: "sha256", rel: CONFIG_FILENAME, expectedSha256: sha256Content(configBuf) };
    const parsedConfig = parseConfigFromBytes(configBuf, runtime);
    if (parsedConfig) currentOutputRel = relDir(projectRoot, parsedConfig.output.directory);
  }

  // State precondition from the SAME readState result above.
  let statePre: Precondition;
  if (read.status === "ok") {
    statePre = { kind: "sha256", rel: STATE_REL, expectedSha256: read.sha256 };
  } else if (read.status === "missing") {
    statePre = { kind: "absent", rel: STATE_REL };
  } else if (read.sha256 !== null) {
    // corrupt/incompatible: pin the exact bytes that were read.
    statePre = { kind: "sha256", rel: STATE_REL, expectedSha256: read.sha256 };
  } else {
    // corrupt/incompatible with NO trustworthy bytes (unreadable/unsafe) → fail
    // closed; never manufacture a hash with a later re-read.
    throw new Error(
      `state.json is ${read.status} and its bytes could not be read/verified — reset aborted (fail closed), ` +
        `no trustworthy snapshot exists. Run "arte-gitcard doctor" to inspect.`,
    );
  }

  // Theme rule (default arte theme is what the new config selects).
  const themePlan = planSelectedTheme(projectRoot, DEFAULT_THEME_REL, DEFAULT_THEME); // throws → fail closed
  const defaultLoaded = { config: defaultCfg, projectRoot, configPath: path.join(projectRoot, CONFIG_FILENAME) };

  // Plan the default enabled Card bytes in memory BEFORE any write.
  const planned = planCardArtifactsInternal(defaultLoaded, themePlan.resolved, { runtime });
  const regenTargets = new Map<string, PlannedCardArtifact>();
  for (const artifact of planned.artifacts) {
    regenTargets.set(`${defaultOutputRel}/${artifact.file}`, artifact);
  }

  const fixedGuard = buildManagedGuard(projectRoot);
  const extraDirs = currentOutputRel && currentOutputRel !== defaultOutputRel ? [currentOutputRel] : [];
  const deleteGuard = buildManagedGuard(projectRoot, defaultCfg, { outputDirs: extraDirs, runtime });

  // Rebuilt final state. Start from the current state so legitimate theme
  // provenance survives; generated/forged entries are dropped below.
  const state: ArteGitcardState = baseState ?? initialState();

  if (baseState) {
    for (const entry of [...state.managedFiles]) {
      if (entry.kind === "theme") continue; // themes handled below (preserved)
      if (regenTargets.has(entry.path)) continue; // handled by the regen preflight
      if (!deleteGuard({ kind: entry.kind, rel: entry.path })) {
        // Forged / historical path outside authority → preserved, never deleted,
        // never written back into the rebuilt state.
        preserved.push(`${entry.path} — outside arte-gitcard reset authority (preserved, not touched)`);
        removeEntry(state, entry.path);
        continue;
      }
      const status = assertDeletable(projectRoot, entry);
      if (status === "ok") {
        txn.deletes.push({
          rel: entry.path,
          abs: resolveFromProject(projectRoot, entry.path),
          kind: entry.kind as ManagedKind,
          expectedSha256: entry.sha256,
        });
        removeEntry(state, entry.path);
      } else if (status === "modified") {
        blocking.push(`${entry.path} — was modified after generation (preserved, not deleted)`);
      } else if (status === "unsafe") {
        blocking.push(`${entry.path} — unsafe path (preserved, not deleted)`);
      } else {
        removeEntry(state, entry.path); // missing → nothing to delete
      }
    }
  } else if (read.status === "corrupt" || read.status === "incompatible") {
    warnings.push(
      `state.json is ${read.status}; ownership cannot be proven — no generated files will be deleted.`,
    );
  }

  // Regenerated targets (default enabled cards) preflight: only overwrite files
  // we can prove we own (ok); a modified/unsafe/unowned file is a blocker. The
  // observed before-state of each target is captured ONCE and attached to the
  // write (absent → pin; owned+ok → deliberate regeneration reclaim, unset).
  const regenPolicy = new Map<string, ExpectedBefore | undefined>();
  for (const rel of regenTargets.keys()) {
    const abs = resolveFromProject(projectRoot, rel);
    if (!pathOccupied(abs)) {
      regenPolicy.set(rel, { kind: "absent" }); // free → fresh create (pinned)
      continue;
    }
    const entry = baseState?.managedFiles.find((e) => e.path === rel);
    if (!entry) {
      blocking.push(`${rel} — file exists but is not provably owned by arte-gitcard (preserved)`);
      continue;
    }
    const status = assertDeletable(projectRoot, entry);
    if (status === "modified") {
      blocking.push(`${rel} — was modified after generation (preserved, not overwritten)`);
    } else if (status === "unsafe") {
      blocking.push(`${rel} — unsafe path (preserved, not overwritten)`);
    } else {
      regenPolicy.set(rel, undefined); // owned + unchanged → regeneration may reclaim
    }
  }

  if (blocking.length > 0) {
    preserved.push(...blocking);
    throw new Error(
      "reset aborted — NO changes were made.\n" +
        blocking.map((b) => `  - ${b}`).join("\n") +
        "\n\nRun `arte-gitcard doctor`, resolve the files above manually, then retry `arte-gitcard reset`.",
    );
  }

  // ---- rebuild final state ----
  // Keep ONLY legitimate theme entries whose file still exists as a safe file.
  // A pre-existing theme that was never owned stays unowned (no auto-claim).
  state.managedFiles = state.managedFiles.filter(
    (e) => e.kind === "theme" && fixedGuard({ kind: "theme", rel: e.path }) && isRegularFile(resolveFromProject(projectRoot, e.path)),
  );

  // Materialize the default theme when it is absent (write + provenance entry).
  if (themePlan.writeRel !== null && themePlan.writeBytes !== null) {
    txn.writes.push({
      rel: themePlan.writeRel,
      abs: resolveFromProject(projectRoot, themePlan.writeRel),
      content: themePlan.writeBytes,
      kind: "theme",
      expectedBefore: { kind: "absent" },
    });
    upsertEntry(state, {
      path: themePlan.writeRel,
      kind: "theme",
      sha256: sha256WrittenContent(themePlan.writeBytes),
    });
  }

  // Regenerated default cards + their fresh ownership entries.
  for (const [rel, artifact] of regenTargets) {
    txn.writes.push({
      rel,
      abs: resolveFromProject(projectRoot, rel),
      content: artifact.content,
      kind: "card",
      expectedBefore: regenPolicy.get(rel),
    });
    upsertEntry(state, { path: rel, kind: "card", sha256: sha256WrittenContent(artifact.content) });
  }

  // Historical outputRoots = metadata carry-forward (never path authority):
  // previous valid roots ∪ current config output ∪ default output, deduped.
  const roots = new Set<string>(baseState ? baseState.outputRoots : []);
  if (currentOutputRel) roots.add(currentOutputRel);
  roots.add(defaultOutputRel);
  state.outputRoots = [...roots].filter((r) => r !== "").sort();
  // Reset reinitializes: the fresh default config has no github integration.
  state.github = undefined;

  // ---- fresh config + final state ----
  txn.writes.push({
    rel: CONFIG_FILENAME,
    abs: path.join(projectRoot, CONFIG_FILENAME),
    content: CONFIG_TEMPLATE,
    kind: "config",
    expectedBefore:
      configPre.kind === "sha256" ? { kind: "sha256", sha256: configPre.expectedSha256 } : { kind: "absent" },
  });
  txn.stateJson = { rel: STATE_REL, content: serializeState(state) };
  // Optimistic read-set: reset's delete/preserve/regen decisions came from the
  // SINGLE config + state observations above — carry their exact hashes so a
  // plan built from stale config/state fails with a retry instead of applying.
  txn.preconditions = [configPre, statePre];

  return { plan: txn, warnings, preserved, guard: deleteGuard };
}

/** Run the reset plan (built by buildResetRepositoryPlan) in one transaction. */
export function resetRepository(projectRoot: string, opts: ResetOptions = {}): ResetResult {
  const built = buildResetRepositoryPlan(projectRoot, opts);
  const result = runTransaction(built.plan, {
    repoRoot: projectRoot,
    command: "reset",
    dryRun: opts.dryRun === true,
    // Writes target the default config paths; deletes may touch the OLD output
    // dir — which comes from the CURRENT strict-valid config, never from state.
    guard: built.guard,
  });

  return { effects: result.effects, warnings: built.warnings, preserved: built.preserved };
}
