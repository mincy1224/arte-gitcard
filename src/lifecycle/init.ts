/**
 * `arte-gitcard init` (P0) — UNINITIALIZED only. Config + default theme +
 * enabled default Cards + state.json are ALL planned in memory and committed in
 * ONE transaction. A repo that already has a config/state is refused before this
 * runs (the CLI gates on the repository-state detector).
 *
 * Fail-safe: every write target is preflighted BEFORE any write (unowned file at
 * a destination → ZERO changes); the default theme is materialized only when
 * absent (provenance entry written in the SAME transaction); a pre-existing
 * theme is never overwritten/auto-claimed — cards are planned against the ACTUAL
 * on-disk theme, and an unreadable one fails closed.
 */

import path from "node:path";
import { CONFIG_FILENAME, resolveFromProject } from "../config/paths.js";
import { CONFIG_TEMPLATE } from "../init/templates.js";
import { buildDefaultConfig } from "../config/defaults.js";
import { DEFAULT_THEME } from "../theme/default-theme.js";
import { runTransaction } from "../txn/engine.js";
import type { Effect } from "../txn/engine.js";
import { emptyPlan } from "../txn/plan.js";
import type { TxnPlan } from "../txn/plan.js";
import { buildManagedGuard } from "../state/guards.js";
import { CollisionError, initialState, readState, serializeState, upsertEntry } from "../state/registry.js";
import type { ArteGitcardState } from "../state/registry.js";
import { sha256WrittenContent } from "../fs/atomic.js";
import { pathOccupied } from "../fs/presence.js";
import { STATE_REL } from "../managed/paths.js";
import { DEFAULT_RUNTIME } from "../runtime.js";
import { planCardArtifactsInternal } from "../generate/plan.js";
import { planSelectedTheme } from "./themeplan.js";

export const DEFAULT_THEME_REL = ".arte-git-card/themes/arte-theme.yml";

export interface InitResult {
  created: string[];
  effects: Effect[];
}

/**
 * Build the init plan WITHOUT applying it (test seam). Every observed absence
 * (config absent, state absent, every fresh destination) survives until the
 * transaction lock as a precondition / expected-before: if any target or source
 * appears after planning, the transaction fails with ZERO mutation.
 */
export function buildInitRepositoryPlan(projectRoot: string): { plan: TxnPlan; created: string[] } {
  const created: string[] = [];
  const txn = emptyPlan();
  const configAbs = path.join(projectRoot, CONFIG_FILENAME);

  // UNINITIALIZED-only. If a v2 config already exists, this is NOT an init.
  if (pathOccupied(configAbs)) {
    throw new Error(
      "arte-gitcard is already initialized in this repository.\n\nRun:\n  arte-gitcard status\nTo reinitialize:\n  arte-gitcard reset",
    );
  }

  // RB-4: init must NEVER silently overwrite an orphan state.json. If a state
  // exists (valid/corrupt/incompatible) without a config, refuse with ZERO
  // changes — planCardArtifacts must not read a stale state's outputRoots either.
  const stateRead = readState(projectRoot);
  if (stateRead.status !== "missing") {
    throw new Error(
      "An arte-gitcard state.json already exists but no config exists. " +
        "Inspect it with `arte-gitcard doctor`, back it up, or remove it before init.",
    );
  }

  // ---- default config + default theme (memory only) ----
  const defaultCfg = buildDefaultConfig();
  const defaultLoaded = { config: defaultCfg, projectRoot, configPath: configAbs };

  // Theme rule: materialize when absent (source = arte preset), else use the
  // ACTUAL disk theme. Invalid existing theme → throws (fail closed).
  const themePlan = planSelectedTheme(projectRoot, DEFAULT_THEME_REL, DEFAULT_THEME);

  // Plan the enabled default Card bytes in memory. This runs BEFORE any write.
  const planned = planCardArtifactsInternal(defaultLoaded, themePlan.resolved, { runtime: DEFAULT_RUNTIME });
  const outputDirRel = path.relative(projectRoot, resolveFromProject(projectRoot, defaultCfg.output.directory)).replace(/\\/g, "/");
  const state: ArteGitcardState = initialState();

  // Preflight + writes for every enabled card target. ANY existing entry
  // (regular file, broken symlink, dir) is unowned (init has no ownership
  // registry yet) → abort, ZERO changes.
  for (const artifact of planned.artifacts) {
    const rel = `${outputDirRel}/${artifact.file}`;
    const abs = resolveFromProject(projectRoot, rel);
    if (pathOccupied(abs)) {
      throw new CollisionError(
        `cannot init: ${rel} already exists and is not owned by arte-gitcard. ` +
          `Move or remove it first (it was NOT modified). Run "arte-gitcard doctor" to inspect.`,
        rel,
      );
    }
    txn.writes.push({ rel, abs, content: artifact.content, kind: "card", expectedBefore: { kind: "absent" } });
    upsertEntry(state, { path: rel, kind: "card", sha256: sha256WrittenContent(artifact.content) });
  }

  // Materialized theme → write + provenance entry in the SAME transaction.
  if (themePlan.writeRel !== null && themePlan.writeBytes !== null) {
    txn.writes.push({
      rel: themePlan.writeRel,
      abs: resolveFromProject(projectRoot, themePlan.writeRel),
      content: themePlan.writeBytes,
      kind: "theme",
      expectedBefore: { kind: "absent" },
    });
    upsertEntry(state, { path: themePlan.writeRel, kind: "theme", sha256: sha256WrittenContent(themePlan.writeBytes) });
    created.push(themePlan.writeRel);
  }

  if (!state.outputRoots.includes(outputDirRel)) {
    state.outputRoots = [...state.outputRoots, outputDirRel];
  }

  // Config write (template) + final state in the same plan. Both config and
  // state were observed ABSENT → pin that absence until the lock.
  txn.writes.push({
    rel: CONFIG_FILENAME,
    abs: configAbs,
    content: CONFIG_TEMPLATE,
    kind: "config",
    expectedBefore: { kind: "absent" },
  });
  created.push(CONFIG_FILENAME);
  txn.stateJson = { rel: STATE_REL, content: serializeState(state) };
  txn.preconditions = [
    { kind: "absent", rel: CONFIG_FILENAME },
    { kind: "absent", rel: STATE_REL },
  ];

  return { plan: txn, created };
}

export function initRepository(projectRoot: string, opts: { dryRun?: boolean } = {}): InitResult {
  const { plan, created } = buildInitRepositoryPlan(projectRoot);
  const result = runTransaction(plan, {
    repoRoot: projectRoot,
    command: "init",
    dryRun: opts.dryRun === true,
    guard: buildManagedGuard(projectRoot, buildDefaultConfig()),
  });
  return { created, effects: result.effects };
}
