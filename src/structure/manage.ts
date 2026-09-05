/**
 * `arte-gitcard structure` manager (default-branch pass).
 *
 *   list     — STRICTLY read-only (no store write/prune/txn/diff).
 *   describe — require a canonical structure.root-relative path to be a
 *              directory of the CURRENT scope (ignoring only max_depth, within
 *              the absolute limit), validate the value, prune stale metadata,
 *              then upsert in ONE transaction with an optimistic precondition.
 *   remove   — drop the store entry (no directory requirement); prune stale
 *              metadata; delete the store file when it becomes empty.
 *
 * describe/remove manage METADATA ONLY — callers surface that a changed
 * mutation requires `arte-gitcard generate`.
 */

import path from "node:path";
import { existsSync } from "node:fs";
import { runTransaction } from "../txn/engine.js";
import { isUntrackedAndIgnored } from "../github/tracked.js";
import { emptyPlan } from "../txn/plan.js";
import { buildManagedGuard } from "../state/guards.js";
import { configSourcePrecondition } from "../txn/sources.js";
import { STRUCTURE_DESCRIPTIONS_REL } from "../managed/paths.js";
import { normalizeRelPosix } from "../fs/pathguard.js";
import { normalizeStructureRoot } from "../config/root.js";
import type { ArteGitCardConfig, LoadedConfig } from "../config/types.js";
import {
  descriptionValueError,
  loadDescriptionSnapshot,
  serializeStructureDescriptions,
  MAX_STRUCTURE_DEPTH,
  type DescriptionSnapshot,
} from "./descriptions.js";
import { buildStructureScope, pruneStructureKeys } from "./scope.js";

/** Windows-friendly path normalization for a structure.root-relative argument. */
export function canonicalRelArg(raw: string): string {
  if (!raw || raw.length === 0) throw new Error("expected a path");
  let p = raw.replace(/\\/g, "/");
  if (p.startsWith("//")) throw new Error("UNC paths are not allowed");
  if (p.startsWith("/")) throw new Error("absolute POSIX paths are not allowed");
  if (/^[A-Za-z]:\//.test(p)) throw new Error("Windows drive absolute paths are not allowed");
  p = p.replace(/(^|\/)\.\//g, "$1").replace(/\/+$/, "");
  const norm = normalizeRelPosix(p);
  if (!norm || norm !== p) {
    throw new Error(
      `invalid path "${raw}": use a canonical path relative to structure.root (no .., no //, no trailing /, no empty segments)`,
    );
  }
  return norm;
}

export interface StructureListEntry {
  path: string;
  depth: number;
  description: string;
}

/** Strict depth parse: only a plain non-negative integer token is accepted. */
function parseListDepth(raw: string | undefined, config: ArteGitCardConfig): number {
  if (raw === undefined) return config.cards.structure.max_depth;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`structure list depth must be an integer 1..20, got "${raw}"`);
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 20) {
    throw new Error(`structure list depth must be an integer 1..20, got "${raw}"`);
  }
  return n;
}

export function structureList(
  projectRoot: string,
  config: ArteGitCardConfig,
  rawDepth: string | undefined,
): { root: string; depth: number; entries: StructureListEntry[]; lines: string[] } {
  // Rows satisfy depth < maxDepth (buildTree clears children at depth >= maxDepth),
  // so `list <d>` shows depths 0..d-1 — the exact set a max_depth=d card renders.
  const depth = parseListDepth(rawDepth, config);
  const scope = buildStructureScope(projectRoot, config);
  const store = loadDescriptionSnapshot(projectRoot).map;
  const root = config.cards.structure.root || ".";
  const visible = scope.dirs.filter((d) => d.depth < depth);
  const entries: StructureListEntry[] = visible.map((d) => ({
    path: d.rel,
    depth: d.depth,
    description: Object.hasOwn(store, d.repoRel) ? store[d.repoRel]! : "",
  }));
  const lines: string[] = [];
  for (const e of entries) {
    lines.push(`${"  ".repeat(e.depth)}${e.path}${e.description ? `  (${e.description})` : ""}`);
  }
  return { root, depth, entries, lines };
}

export interface StructureMutationResult {
  /** The description store was written/deleted. */
  changed: boolean;
  /** The described TARGET path itself changed (vs. only a stale prune). */
  targetChanged: boolean;
  /** Cards need regeneration only when the target's own metadata changed. */
  generationRequired: boolean;
  removed: string[];
  /**
   * Non-blocking warning when a CHANGED mutation wrote the store while
   * auto-update is on and the store is untracked AND git-ignored (GitHub
   * auto-update would not receive these descriptions). Never set on a no-op.
   */
  warning?: string;
}

/** Local-only metadata warning (only after a real store write exists). */
function metadataIgnoredWarning(projectRoot: string, config: ArteGitCardConfig): string | undefined {
  if (config["auto-update"] !== true) return undefined;
  if (!existsSync(path.join(projectRoot, STRUCTURE_DESCRIPTIONS_REL))) return undefined;
  if (isUntrackedAndIgnored(projectRoot, STRUCTURE_DESCRIPTIONS_REL)) {
    return (
      `note: ${STRUCTURE_DESCRIPTIONS_REL} is untracked and git-ignored — these descriptions are LOCAL only; ` +
      `GitHub auto-update will not receive them until the path is made trackable/committed.`
    );
  }
  return undefined;
}

/** Repo-relative key for a canonical structure.root-relative path. */
function repoRelOf(projectRoot: string, config: ArteGitCardConfig, rel: string): string {
  const rootRel = normalizeStructureRoot(config.cards.structure.root, projectRoot);
  return rootRel ? `${rootRel}/${rel}` : rel;
}

/** Directory node depth measured from the display root (rel segments - 1). */
function nodeDepthOf(rel: string): number {
  return rel.split("/").length - 1;
}

function storeTxn(
  projectRoot: string,
  loaded: LoadedConfig,
  command: string,
  dryRun: boolean,
  snapshot: DescriptionSnapshot,
  nextMap: Record<string, string>,
): { changed: boolean } {
  const abs = path.join(projectRoot, STRUCTURE_DESCRIPTIONS_REL);
  const plan = emptyPlan();
  if (Object.keys(nextMap).length === 0) {
    // Delete only a positively-present store (never fabricate a delete).
    if (snapshot.present) {
      plan.deletes.push({
        rel: STRUCTURE_DESCRIPTIONS_REL,
        abs,
        kind: "structure-descriptions",
        expectedSha256: snapshot.contentHash!,
      });
    }
  } else {
    plan.writes.push({
      rel: STRUCTURE_DESCRIPTIONS_REL,
      abs,
      content: serializeStructureDescriptions(nextMap),
      kind: "structure-descriptions",
    });
  }
  if (plan.writes.length > 0 || plan.deletes.length > 0) {
    // Semantics come from the config the caller consumed AND the store snapshot —
    // pin BOTH so a stale config or store fails with a retry.
    plan.preconditions = [...configSourcePrecondition(loaded), snapshot.precondition];
    runTransaction(plan, {
      repoRoot: projectRoot,
      command,
      dryRun,
      guard: buildManagedGuard(projectRoot, loaded.config),
    });
    return { changed: true };
  }
  return { changed: false };
}

export function structureDescribe(
  projectRoot: string,
  loaded: LoadedConfig,
  rawPath: string,
  text: string,
  opts: { dryRun?: boolean } = {},
): StructureMutationResult {
  const config: ArteGitCardConfig = loaded.config;
  if (typeof text !== "string" || text.length === 0) throw new Error("expected a description");
  const rel = canonicalRelArg(rawPath);
  const valueErr = descriptionValueError(text);
  if (valueErr) throw new Error(valueErr);
  // A node depth >= MAX_STRUCTURE_DEPTH can never be rendered (rows are depth < max).
  if (nodeDepthOf(rel) >= MAX_STRUCTURE_DEPTH) {
    throw new Error(`cannot describe "${rel}": it is deeper than the supported depth (${MAX_STRUCTURE_DEPTH})`);
  }
  const scope = buildStructureScope(projectRoot, config);
  if (!scope.dirs.some((d) => d.rel === rel)) {
    throw new Error(
      `cannot describe "${rel}": it is not a directory in the current structure scope under ${config.cards.structure.root || "."} ` +
        `(excluded from the scan, or not present in the repository).`,
    );
  }
  const repoRel = scope.rootRel ? `${scope.rootRel}/${rel}` : rel;

  const snapshot = loadDescriptionSnapshot(projectRoot);
  const prune = pruneStructureKeys(projectRoot, snapshot.map);
  const pruned = prune.pruned;

  const already = snapshot.present && Object.hasOwn(snapshot.map, repoRel) && snapshot.map[repoRel] === text;
  if (already && prune.removed.length === 0) {
    return { changed: false, targetChanged: false, generationRequired: false, removed: [] };
  }

  const next = { ...pruned };
  Object.defineProperty(next, repoRel, { value: text, enumerable: true, writable: true, configurable: true });
  const changed = storeTxn(projectRoot, loaded, "structure-describe", opts.dryRun === true, snapshot, next);
  const targetChanged = !already;
  return {
    changed: changed.changed,
    // A prune-only write (target already had this exact value) does NOT claim an update or require regeneration.
    targetChanged,
    generationRequired: targetChanged,
    removed: prune.removed,
    warning: metadataIgnoredWarning(projectRoot, config),
  };
}

export function structureRemove(
  projectRoot: string,
  loaded: LoadedConfig,
  rawPath: string,
  opts: { dryRun?: boolean } = {},
): StructureMutationResult {
  const config: ArteGitCardConfig = loaded.config;
  const rel = canonicalRelArg(rawPath);
  const repoRel = repoRelOf(projectRoot, config, rel);

  const snapshot = loadDescriptionSnapshot(projectRoot);
  const prune = pruneStructureKeys(projectRoot, snapshot.map);
  const pruned = prune.pruned;

  const had = Object.hasOwn(pruned, repoRel);
  const next = { ...pruned };
  if (had) delete next[repoRel];

  if (!had && prune.removed.length === 0) {
    return { changed: false, targetChanged: false, generationRequired: false, removed: [] };
  }
  const changed = storeTxn(projectRoot, loaded, "structure-remove", opts.dryRun === true, snapshot, next);
  return {
    changed: changed.changed,
    // Only removing the TARGET's own entry is a "removed for <target>" change.
    targetChanged: had,
    generationRequired: had,
    removed: prune.removed,
    warning: metadataIgnoredWarning(projectRoot, config),
  };
}
