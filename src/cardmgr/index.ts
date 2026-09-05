/**
 * Card lifecycle, RUNTIME driven. `add` enables a registered Display
 * (materializing an absent OPTIONAL block) and regenerates; `remove` disables it
 * and deletes the owned SVG only when unmodified (else preserve + warn). Each
 * mutation is ONE transaction ending with state.json. Identity ALWAYS comes from
 * the compiled ArteRuntime — no display id/filename is hardcoded here.
 */

import path from "node:path";
import type { LoadedConfig, ArteGitCardConfig } from "../config/types.js";
import { resolveFromProject } from "../config/paths.js";
import { cloneConfig } from "../config/registry.js";
import type { ResolvedTheme } from "../theme/resolve.js";
import { planGenerateTxn } from "../generate/manage.js";
import { runTransaction } from "../txn/engine.js";
import type { Effect } from "../txn/engine.js";
import { buildManagedGuard } from "../state/guards.js";
import {
  assertDeletable,
  findEntry,
  readState,
  removeEntry,
  serializeState,
} from "../state/registry.js";
import type { ArteGitcardState } from "../state/registry.js";
import { STATE_REL } from "../managed/paths.js";
import { DEFAULT_RUNTIME } from "../runtime.js";
import type { ArteRuntime } from "../runtime.js";
import { ensureDisplayCardSlice, displayEnabledIn } from "../display/definition.js";

/** Every registered display id (registry order) in the PRODUCTION runtime. */
export const CARD_IDS: readonly string[] = DEFAULT_RUNTIME.cardIds;
export type CardId = string;

export function cardFile(id: CardId): string {
  return `${id}.svg`;
}

export function isCardId(id: string): id is CardId {
  return DEFAULT_RUNTIME.findDisplay(id) !== undefined;
}

function outputDirRel(projectRoot: string, config: ArteGitCardConfig): string {
  const abs = resolveFromProject(projectRoot, config.output.directory);
  return path.relative(projectRoot, abs).replace(/\\/g, "/");
}

export interface CardStatus {
  id: CardId;
  title: string;
  enabled: boolean;
  path: string | null;
  owned: boolean;
}

/**
 * README markdown snippet for enabled cards. Pure + read-only: validates the id
 * is registered and enabled, then returns the `![id card](<output>/<id>.svg)` line.
 */
export function buildCardSnippet(config: ArteGitCardConfig, ids: readonly string[], runtime: ArteRuntime): string[] {
  return ids.map((id) => {
    if (!runtime.findDisplay(id)) throw new Error(`unknown card "${id}"`);
    if (!displayEnabledIn(config, id)) {
      throw new Error(`${id} card is disabled — enable it first with "arte-gitcard add ${id}"`);
    }
    return `![${id} card](${path.posix.join(config.output.directory, cardFile(id))})`;
  });
}

/** README snippets for ALL ENABLED Displays (registry order); an absent/disabled optional Display is simply omitted. */
export function buildAllEnabledSnippets(config: ArteGitCardConfig, runtime: ArteRuntime): string[] {
  const enabledIds = runtime.enabledDisplays(config).map((e) => e.id);
  return buildCardSnippet(config, enabledIds, runtime);
}

export interface CardStatusOptions {
  runtime?: ArteRuntime;
}

export function cardStatusList(projectRoot: string, config: ArteGitCardConfig, opts: CardStatusOptions = {}): CardStatus[] {
  const runtime = opts.runtime ?? DEFAULT_RUNTIME;
  const stateRead = readState(projectRoot);
  const state = stateRead.status === "ok" ? stateRead.state : null;
  const dir = outputDirRel(projectRoot, config);
  return runtime.displays.map((display) => {
    const rel = `${dir}/${cardFile(display.id)}`;
    return {
      id: display.id,
      title: display.title,
      enabled: displayEnabledIn(config, display.id),
      path: rel,
      owned: state ? findEntry(state, rel) !== undefined : false,
    };
  });
}

export interface CardMutationOptions {
  dryRun?: boolean;
  /** compiled runtime driving this lifecycle op (default: production). */
  runtime?: ArteRuntime;
}

export interface CardMutationResult {
  effects: Effect[];
  warnings: string[];
  nextConfig: ArteGitCardConfig;
}

export function addCard(
  projectRoot: string,
  loaded: LoadedConfig,
  theme: ResolvedTheme,
  id: CardId,
  opts: CardMutationOptions = {},
): CardMutationResult {
  const runtime = opts.runtime ?? DEFAULT_RUNTIME;
  const def = runtime.findDisplay(id);
  if (!def) throw new Error(`unknown card "${id}" (available: ${runtime.cardIds.join(", ")})`);
  if (displayEnabledIn(loaded.config, id)) {
    return { effects: [], warnings: [], nextConfig: loaded.config };
  }
  const next = cloneConfig(loaded.config);
  // Materialize an absent OPTIONAL display (enabled:false) before enabling it.
  ensureDisplayCardSlice(next, def);
  const block = (next.cards as Record<string, { enabled: boolean }>)[id]!;
  block.enabled = true;
  return commitConfigAndCards(projectRoot, loaded, next, theme, runtime, opts);
}

export function removeCard(
  projectRoot: string,
  loaded: LoadedConfig,
  theme: ResolvedTheme,
  id: CardId,
  opts: CardMutationOptions = {},
): CardMutationResult {
  const runtime = opts.runtime ?? DEFAULT_RUNTIME;
  const def = runtime.findDisplay(id);
  if (!def) throw new Error(`unknown card "${id}" (available: ${runtime.cardIds.join(", ")})`);
  if (!displayEnabledIn(loaded.config, id)) {
    return { effects: [], warnings: [], nextConfig: loaded.config };
  }
  const next = cloneConfig(loaded.config);
  const block = (next.cards as Record<string, { enabled: boolean }>)[id]!;
  block.enabled = false;
  return commitConfigAndCards(projectRoot, loaded, next, theme, runtime, opts, { removedCard: id });
}

interface InternalOptions {
  removedCard?: CardId;
}

/** One transaction: config write + card artifacts (+ optional owned-card deletion) + state. */
function commitConfigAndCards(
  projectRoot: string,
  loaded: LoadedConfig,
  nextConfig: ArteGitCardConfig,
  theme: ResolvedTheme,
  runtime: ArteRuntime,
  opts: CardMutationOptions,
  internal: InternalOptions = {},
): CardMutationResult {
  const warnings: string[] = [];
  const nextLoaded: LoadedConfig = { ...loaded, config: nextConfig };

  const { plan, state } = planGenerateTxn(projectRoot, nextLoaded, theme, {
    dryRun: opts.dryRun === true,
    writeConfig: true,
    runtime,
  });

  if (internal.removedCard) {
    const removedId = internal.removedCard;
    const oldDir = outputDirRel(projectRoot, loaded.config); // current dir (before this change)
    const rel = `${oldDir}/${cardFile(removedId)}`;
    const entry = findEntry(state, rel);
    if (entry) {
      const status = assertDeletable(projectRoot, entry);
      if (status === "ok") {
        plan.deletes.push({
          rel,
          abs: resolveFromProject(projectRoot, rel),
          kind: "card",
          expectedSha256: entry.sha256,
        });
      } else if (status === "modified") {
        warnings.push(
          `${path.basename(rel)} was modified after generation. The card was disabled, but the file was preserved to avoid deleting user changes.`,
        );
      } else if (status === "unsafe") {
        warnings.push(`${rel} is not safe to delete (symlink/escape) — preserved.`);
      }
      // Drop the entry either way (the file, if any, is no longer a generated card).
      removeEntry(state, rel);
      plan.stateJson = { rel: STATE_REL, content: serializeState(state) };
    }
  }

  const result = runTransaction(plan, {
    repoRoot: projectRoot,
    command: internal.removedCard ? "remove" : "add",
    dryRun: opts.dryRun === true,
    guard: buildManagedGuard(projectRoot, nextConfig, { runtime }),
  });

  return { effects: result.effects, warnings, nextConfig };
}

export type { ArteGitcardState };
