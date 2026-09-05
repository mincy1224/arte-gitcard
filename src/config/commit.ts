/**
 * Config writes go through the transaction engine. `output.directory` changes
 * trigger a FULL artifact relocation transaction (see relocateOutputDirectory);
 * unowned or user-modified files are never moved — preserved with a warning.
 */

import path from "node:path";
import YAML from "yaml";
import type { LoadedConfig, ArteGitCardConfig } from "./types.js";
import { resolveFromProject, CONFIG_FILENAME } from "./paths.js";
import { loadConfig } from "./load.js";
import { DEFAULT_RUNTIME } from "../runtime.js";
import type { ArteRuntime } from "../runtime.js";
import { loadTheme } from "../theme/load.js";
import { resolveTheme } from "../theme/resolve.js";
import type { ResolvedTheme } from "../theme/resolve.js";
import { runTransaction } from "../txn/engine.js";
import type { Effect } from "../txn/engine.js";
import { emptyPlan } from "../txn/plan.js";
import type { ExpectedBefore } from "../txn/plan.js";
import { configSourcePrecondition, stateSourcePrecondition } from "../txn/sources.js";
import { buildManagedGuard } from "../state/guards.js";
import {
  assertDeletable,
  CollisionError,
  findEntry,
  readState,
  removeEntry,
  serializeState,
  upsertEntry,
} from "../state/registry.js";
import type { ArteGitcardState } from "../state/registry.js";
import { sha256WrittenContent } from "../fs/atomic.js";
import { pathOccupied } from "../fs/presence.js";
import { STATE_REL, PREVIEW_FILENAME } from "../managed/paths.js";
import { planCardArtifactsInternal } from "../generate/plan.js";

export interface LoadedProject {
  loaded: LoadedConfig;
  theme: ResolvedTheme;
}

export interface CommitOptions {
  dryRun?: boolean;
  command: string;
  /** Compiled runtime whose schema validates the write (default: production). */
  runtime?: ArteRuntime;
}

export function loadHealthyProject(projectRoot: string): LoadedProject {
  const configPath = path.join(projectRoot, CONFIG_FILENAME);
  const loaded = loadConfig(configPath);
  const theme = resolveTheme(loadTheme(loaded.config.theme, loaded.projectRoot));
  return { loaded, theme };
}

function toRelDir(projectRoot: string, directory: string): string {
  const abs = resolveFromProject(projectRoot, directory);
  return path.relative(projectRoot, abs).replace(/\\/g, "/");
}

function assertValid(runtime: ArteRuntime, next: ArteGitCardConfig): void {
  const res = runtime.config.v2Schema.safeParse(next);
  if (!res.success) {
    throw new Error("internal: refused to write a config that fails the v2 schema");
  }
}

/**
 * Write a (schema-validated) config through the transaction engine. The write's
 * expected-before is `loaded.sourceSha256` — never a late re-read.
 */
export function writeConfigTxn(
  projectRoot: string,
  loaded: LoadedConfig,
  nextConfig: ArteGitCardConfig,
  opts: CommitOptions,
): Effect[] {
  const runtime = opts.runtime ?? DEFAULT_RUNTIME;
  assertValid(runtime, nextConfig);
  const txn = emptyPlan();
  txn.writes.push({
    rel: CONFIG_FILENAME,
    abs: path.join(projectRoot, CONFIG_FILENAME),
    content: YAML.stringify(nextConfig),
    kind: "config",
    expectedBefore: loaded.sourceSha256 ? { kind: "sha256", sha256: loaded.sourceSha256 } : undefined,
  });
  txn.preconditions = configSourcePrecondition(loaded);
  const result = runTransaction(txn, {
    repoRoot: projectRoot,
    command: opts.command,
    dryRun: opts.dryRun === true,
    guard: buildManagedGuard(projectRoot, nextConfig, { runtime }),
  });
  return result.effects;
}

export interface RelocateWarnings {
  preserved: string[];
  message: string;
}

/**
 * Change `output.directory` by FULL regeneration into the new dir, in one
 * transaction: old owned+unmodified artifacts are exact-deleted, old
 * modified/unsafe are preserved (ownership dropped), and a new-dir target that
 * is unowned or user-modified is refused before any write. State is a
 * clone/transform of the current state; only card/preview entries and
 * outputRoots (history, never authority) change.
 */
export function relocateOutputDirectory(
  projectRoot: string,
  loaded: LoadedConfig,
  nextConfig: ArteGitCardConfig,
  opts: CommitOptions,
): { effects: Effect[]; preserved: string[] } {
  const runtime = opts.runtime ?? DEFAULT_RUNTIME;
  assertValid(runtime, nextConfig);
  const oldRel = toRelDir(projectRoot, loaded.config.output.directory);
  const newRel = toRelDir(projectRoot, nextConfig.output.directory);
  const preserved: string[] = [];

  if (oldRel === newRel) {
    // No directory change → plain config write (avoids a same-path delete+write clobber).
    return { effects: writeConfigTxn(projectRoot, loaded, nextConfig, opts), preserved };
  }

  const stateRead = readState(projectRoot);
  if (stateRead.status !== "ok") {
    throw new Error(
      `cannot relocate output: state.json is ${stateRead.status}. Run "arte-gitcard doctor" or "arte-gitcard reset".`,
    );
  }
  // Clone/transform the current state — never rebuild from a fresh state.
  const state: ArteGitcardState = JSON.parse(JSON.stringify(stateRead.state));

  const txn = emptyPlan();
  txn.writes.push({
    rel: CONFIG_FILENAME,
    abs: path.join(projectRoot, CONFIG_FILENAME),
    content: YAML.stringify(nextConfig),
    kind: "config",
    // Replaces the EXACT config file whose output dir this relocation derives from.
    expectedBefore: loaded.sourceSha256 ? { kind: "sha256", sha256: loaded.sourceSha256 } : undefined,
  });

  // Selected theme is the current one (output change does not change theme).
  const theme = resolveTheme(loadTheme(nextConfig.theme, projectRoot));
  const nextLoaded = { ...loaded, config: nextConfig };
  const planned = planCardArtifactsInternal(nextLoaded, theme, { runtime }); // memory only, before any write

  const desired = new Map<string, { content: string }>();
  for (const artifact of planned.artifacts) {
    desired.set(`${newRel}/${artifact.file}`, { content: artifact.content });
  }

  // NEW-dir preflight: capture each target's before-state ONCE (absent → pinned
  // create; owned+ok → reclaim by regeneration). Never overwrite unowned or
  // user-modified files.
  const policy = new Map<string, ExpectedBefore | undefined>();
  for (const [rel, artifact] of desired) {
    const abs = resolveFromProject(projectRoot, rel);
    if (!pathEntryExists(abs)) {
      policy.set(rel, { kind: "absent" }); // free → fresh create (pinned)
      continue;
    }
    const entry = findEntry(state, rel);
    if (!entry) throw new CollisionError(`cannot relocate: ${rel} exists and is not owned.`, rel);
    const st = assertDeletable(projectRoot, entry);
    if (st === "modified") {
      throw new CollisionError(
        `cannot relocate: ${rel} exists and was user-modified — refusing to silently overwrite it. Resolve it first.`,
        rel,
      );
    }
    if (st === "unsafe") {
      throw new CollisionError(`cannot relocate: ${rel} is at an unsafe path (symlink/escape) — refusing.`, rel);
    }
    // ok → regeneration may reclaim it (deliberate overwrite of an owned file).
    policy.set(rel, undefined);
  }

  for (const [rel, artifact] of desired) {
    const abs = resolveFromProject(projectRoot, rel);
    txn.writes.push({ rel, abs, content: artifact.content, kind: "card", expectedBefore: policy.get(rel) });
    upsertEntry(state, { path: rel, kind: "card", sha256: sha256WrittenContent(artifact.content) });
  }

  // OLD-dir artifacts: exact-delete owned+ok; preserve modified/unsafe; always drop the ownership entry.
  const oldPrefix = `${oldRel}/`;
  for (const entry of [...state.managedFiles]) {
    if (entry.kind !== "card" && entry.kind !== "preview") continue;
    if (!entry.path.startsWith(oldPrefix)) continue;
    if (desired.has(entry.path)) continue; // only possible when dirs equal — impossible here
    const abs = resolveFromProject(projectRoot, entry.path);
    const st = assertDeletable(projectRoot, entry);
    if (st === "ok") {
      txn.deletes.push({ rel: entry.path, abs, kind: entry.kind, expectedSha256: entry.sha256 });
      removeEntry(state, entry.path);
    } else if (st === "modified") {
      preserved.push(`${entry.path} — modified after generation (preserved; ownership dropped)`);
      removeEntry(state, entry.path);
    } else if (st === "unsafe") {
      preserved.push(`${entry.path} — unsafe path (preserved; ownership dropped)`);
      removeEntry(state, entry.path);
    } else {
      removeEntry(state, entry.path); // missing → drop the stale entry
    }
  }

  // outputRoots records BOTH roots (history for activity exclusion) — metadata
  // only; older history in the existing roots survives.
  for (const rel of [oldRel, newRel]) {
    if (rel && !state.outputRoots.includes(rel)) state.outputRoots = [...state.outputRoots, rel];
  }
  txn.stateJson = { rel: STATE_REL, content: serializeState(state) };
  // Optimistic read-set from the SAME snapshots this relocation derived from:
  // the LoadedConfig that supplied the old output dir + the StateRead above.
  txn.preconditions = [...configSourcePrecondition(loaded), stateSourcePrecondition(stateRead)];

  const result = runTransaction(txn, {
    repoRoot: projectRoot,
    command: opts.command,
    dryRun: opts.dryRun === true,
    // Allow card/preview writes under the NEW dir AND card/preview deletes under
    // the OLD dir (which comes from the CURRENT strict-valid config — never state).
    guard: buildManagedGuard(projectRoot, nextConfig, { outputDirs: [oldRel], runtime }),
  });
  return { effects: result.effects, preserved };
}

/** True when any entry occupies `abs` (file, dir, or symlink — even broken). */
function pathEntryExists(abs: string): boolean {
  return pathOccupied(abs);
}
