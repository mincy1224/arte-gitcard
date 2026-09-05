/**
 * Transactional, state-recording card generation (P0). Regenerates the ENABLED
 * cards, writes them through the transaction engine (kind path guards applied),
 * records ownership in state.json (written LAST), and unions the current output
 * directory into state.outputRoots for historical activity exclusion.
 *
 * Ownership rule (fail-safe): a file at a managed path may only be overwritten
 * when a state entry proves arte-gitcard owns it (explicit regeneration may
 * reclaim a drifted file). A file that exists WITHOUT an ownership entry is a
 * COLLISION — refused, never overwritten. state.json missing/corrupt ⇒ fail
 * closed; planGenerateTxn never fabricates a state (init/reset/migrate build
 * their fresh state.json themselves from `initialState()`).
 *
 * `planGenerateTxn` is exposed so card add/remove compose config writes,
 * card artifacts and deletions into ONE transaction (never "config changed but
 * SVG failed"). generate NEVER auto-enables/disables — add/remove own enabled.
 */

import path from "node:path";
import { lstatSync } from "node:fs";
import YAML from "yaml";
import type { LoadedConfig } from "../config/types.js";
import { resolveFromProject, CONFIG_FILENAME } from "../config/paths.js";
import { sha256WrittenContent } from "../fs/atomic.js";
import { resolveContained, realpathContained } from "../fs/pathguard.js";
import { runTransaction } from "../txn/engine.js";
import type { Effect, TxnOptions } from "../txn/engine.js";
import { emptyPlan } from "../txn/plan.js";
import type { TxnPlan } from "../txn/plan.js";
import type { ManagedKind, ExpectedBefore } from "../txn/plan.js";
import { buildPreviewHtml } from "../output/preview.js";
import { STATE_REL, PREVIEW_FILENAME, STRUCTURE_DESCRIPTIONS_REL } from "../managed/paths.js";
import {
  CollisionError,
  StateError,
  findEntry,
  readState,
  serializeState,
  upsertEntry,
} from "../state/registry.js";
import type { ArteGitcardState } from "../state/registry.js";
import { buildManagedGuard } from "../state/guards.js";
import type { ResolvedTheme } from "../theme/resolve.js";
import { DEFAULT_RUNTIME } from "../runtime.js";
import type { ArteRuntime } from "../runtime.js";
import { planCardArtifactsInternal } from "./plan.js";
import type { PlanCardArtifactsCore } from "./plan.js";
import { loadDescriptionSnapshot, serializeStructureDescriptions } from "../structure/descriptions.js";
import { pruneStructureKeys } from "../structure/scope.js";
import type { Precondition } from "../txn/plan.js";

export interface GenerateManageOptions {
  dryRun?: boolean;
  now?: Date;
  /** also plan + write preview.html */
  preview?: boolean;
  /** write the config file too (for add/remove so config+cards are one txn) */
  writeConfig?: boolean;
  /** compiled runtime whose displays drive generation (default: production). */
  runtime?: ArteRuntime;
}

export interface GenerateManageResult {
  effects: Effect[];
  state: ArteGitcardState;
  planned: PlanCardArtifactsCore;
}

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Ownership pre-check for one write target (before it enters the txn). Returns
 * the expected-before policy so the caller attaches it to the WriteOp (never
 * probes the target twice):
 *   absent        → { kind: "absent" }  (fresh create — a file that appears after
 *                    preflight is preserved, never silently replaced);
 *   owned regular → undefined           (deliberate regeneration may reclaim an
 *                    owned generated target even if its bytes drifted);
 *   unsafe/unowned → CollisionError (as before).
 */
export function assertWritable(
  projectRoot: string,
  state: ArteGitcardState,
  rel: string,
): ExpectedBefore | undefined {
  const abs = resolveContained(projectRoot, rel);
  if (!abs) throw new CollisionError(`unsafe path: ${rel}`, rel);
  const entry = findEntry(state, rel);
  let st;
  try {
    st = lstatSync(abs);
  } catch (err) {
    // ONLY a true ENOENT is a genuinely absent target (fresh create). An
    // unverifiable target (EACCES / parent is a file / …) is not "absent".
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      throw new CollisionError(`cannot verify write target ${rel} (fail closed, preserving).`, rel);
    }
    return { kind: "absent" };
  }
  if (entry) {
    if (st.isSymbolicLink() || st.isDirectory()) {
      throw new CollisionError(`managed path became a symlink/directory: ${rel}. Refusing to overwrite.`, rel);
    }
    if (!realpathContained(projectRoot, rel)) {
      throw new CollisionError(`managed path escaped the repository: ${rel}. Refusing to overwrite.`, rel);
    }
    return undefined; // owned regular file → deliberate regeneration may reclaim
  }
  throw new CollisionError(
    `cannot overwrite ${rel}: the file exists but arte-gitcard has no ownership record for it. ` +
      `Run "arte-gitcard doctor" or "arte-gitcard reset" to inspect.`,
    rel,
  );
}

/**
 * Build the full TxnPlan (writes + state.json) WITHOUT executing it, so callers
 * can append deletes (remove) or a config write (add/remove) and run one txn.
 */
export function planGenerateTxn(
  projectRoot: string,
  loaded: LoadedConfig,
  theme: ResolvedTheme,
  opts: GenerateManageOptions = {},
): { plan: TxnPlan; state: ArteGitcardState; planned: PlanCardArtifactsCore; prunedDescriptions: number } {
  const stateRead = readState(projectRoot);
  // planGenerateTxn records ownership INTO an existing, provable state. It never
  // fabricates one (init/reset/migrate build their fresh state themselves, and
  // must not reuse a pre-existing state.json to prove ownership of legacy files).
  if (stateRead.status !== "ok") {
    throw new StateError(
      `state.json is ${stateRead.status} — arte-gitcard cannot prove ownership. ` +
        `Run "arte-gitcard doctor" for diagnostics.`,
    );
  }
  const state: ArteGitcardState = stateRead.state;
  const runtime = opts.runtime ?? DEFAULT_RUNTIME;

  // ONE coherent description snapshot for this generation plan: loaded once,
  // pruned once, and the SAME map drives the Structure render overlay AND the
  // store write/delete/precondition below.
  const descriptionSnapshot = loadDescriptionSnapshot(projectRoot);
  const pruneResult = pruneStructureKeys(projectRoot, descriptionSnapshot.map);
  const prunedMap = pruneResult.pruned;

  const planned = planCardArtifactsInternal(loaded, theme, {
    now: opts.now,
    runtime,
    structureDescriptions: prunedMap,
  });
  const artifacts = [...planned.artifacts];
  if (opts.preview) {
    artifacts.push({
      file: PREVIEW_FILENAME,
      content: buildPreviewHtml(
        planned.artifacts.map((a) => ({ file: a.file, svg: a.content })),
      ),
    });
  }

  const outputAbs = resolveFromProject(projectRoot, loaded.config.output.directory);
  const outputDirRel = toPosix(path.relative(projectRoot, outputAbs));

  const txn = emptyPlan();
  if (opts.writeConfig === true) {
    txn.writes.push({
      rel: CONFIG_FILENAME,
      abs: path.join(projectRoot, CONFIG_FILENAME),
      content: YAML.stringify(loaded.config),
      kind: "config",
      // Replaces the EXACT file that was parsed (config precondition pins it too).
      expectedBefore: loaded.sourceSha256 ? { kind: "sha256", sha256: loaded.sourceSha256 } : undefined,
    });
  }

  for (const artifact of artifacts) {
    const kind: ManagedKind = artifact.file === PREVIEW_FILENAME ? "preview" : "card";
    const rel = `${outputDirRel}/${artifact.file}`;
    const expectedBefore = assertWritable(projectRoot, state, rel);
    txn.writes.push({ rel, abs: path.join(outputAbs, artifact.file), content: artifact.content, kind, expectedBefore });
    upsertEntry(state, { path: rel, kind, sha256: sha256WrittenContent(artifact.content) });
  }

  // Description-store prune rides in the SAME transaction as the cards. Only a
  // positively-established removal writes; zero changes ⇒ no store op (a second
  // generation is byte-identical). The optimistic precondition pins the observed
  // store state so a concurrent metadata write can never be silently overwritten.
  if (descriptionSnapshot.present && pruneResult.status === "ok" && pruneResult.removed.length > 0) {
    const storeAbs = path.join(projectRoot, STRUCTURE_DESCRIPTIONS_REL);
    if (Object.keys(prunedMap).length === 0) {
      txn.deletes.push({
        rel: STRUCTURE_DESCRIPTIONS_REL,
        abs: storeAbs,
        kind: "structure-descriptions",
        expectedSha256: descriptionSnapshot.contentHash!,
      });
    } else {
      txn.writes.push({
        rel: STRUCTURE_DESCRIPTIONS_REL,
        abs: storeAbs,
        content: serializeStructureDescriptions(prunedMap),
        kind: "structure-descriptions",
      });
    }
    txn.preconditions!.push(descriptionSnapshot.precondition);
  }

  if (!state.outputRoots.includes(outputDirRel)) {
    state.outputRoots = [...state.outputRoots, outputDirRel];
  }
  // Optimistic read-set from the SAME snapshots this plan was derived from:
  // `loaded` (source bytes parsed once, hashed at load when present) and
  // `stateRead` (the exact state bytes parsed above) — never a later re-read.
  const sourcePre: Precondition[] = [{ kind: "sha256", rel: STATE_REL, expectedSha256: stateRead.sha256 }];
  if (loaded.sourceSha256) {
    sourcePre.unshift({ kind: "sha256", rel: CONFIG_FILENAME, expectedSha256: loaded.sourceSha256 });
  }
  txn.preconditions = [...(txn.preconditions ?? []), ...sourcePre];
  txn.stateJson = { rel: STATE_REL, content: serializeState(state) };
  return { plan: txn, state, planned, prunedDescriptions: pruneResult.removed.length };
}

/** Transactional wrapper: build the plan and run it. */
export function generateEnabledCards(
  projectRoot: string,
  loaded: LoadedConfig,
  theme: ResolvedTheme,
  opts: GenerateManageOptions = {},
): GenerateManageResult {
  const { plan, state, planned } = planGenerateTxn(projectRoot, loaded, theme, opts);
  const guard = buildManagedGuard(projectRoot, loaded.config, { runtime: opts.runtime ?? DEFAULT_RUNTIME });
  const txnOpts: TxnOptions = {
    repoRoot: projectRoot,
    command: "generate",
    dryRun: opts.dryRun === true,
    guard,
  };
  const result = runTransaction(plan, txnOpts);
  return { effects: result.effects, state, planned };
}
