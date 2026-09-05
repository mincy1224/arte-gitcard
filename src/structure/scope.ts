/**
 * Structure tree scope + whole-repository prune index (default-branch pass).
 *
 * Two DIFFERENT notions, kept deliberately apart:
 *
 * 1. `buildStructureScope` — the CURRENT Structure tree under the current
 *    cards.structure.root and scan semantics (for `structure list` and
 *    describe-target visibility). It ignores ONLY the current max_depth — up to
 *    the absolute MAX_STRUCTURE_DEPTH — so deeper directories stay describable.
 *
 * 2. `pruneStructureKeys` — a stable whole-REPO directory-existence index
 *    (tracked + untracked-not-ignored; normal Git/gitignore semantics; only
 *    hard tool-correctness exclusions). Display config (rendered rows, root,
 *    max_depth, list depth, user excludes) is deliberately NOT consulted, so
 *    hiding a directory via configuration NEVER destroys its description; only
 *    a directory genuinely gone from the repository tree is pruned. When the
 *    Git index cannot be built, the prune is UNVERIFIABLE and preserves all
 *    metadata (fail closed).
 */

import path from "node:path";
import { lstatSync } from "node:fs";
import { scanRepository } from "../scanner/index.js";
import { listGitFiles } from "../scanner/git.js";
import { normalizeStructureRoot } from "../config/root.js";
import { buildTree, flattenTree } from "./tree.js";
import { resolveContained, pathHasNoSymlinkComponents } from "../fs/pathguard.js";
import type { ArteGitCardConfig } from "../config/types.js";
import { MAX_STRUCTURE_DEPTH } from "./descriptions.js";

export interface StructureDir {
  /** POSIX path relative to the DISPLAY root (describe/list surface). */
  rel: string;
  /** POSIX path relative to the REPOSITORY root (store key namespace). */
  repoRel: string;
  /** Depth measured from the display root (0 = first level under the root). */
  depth: number;
}

export interface StructureScope {
  /** Resolved `structure.root` ("."/absent ⇒ null). */
  rootRel: string | null;
  /** All directories of the current Structure tree, display-relative. */
  dirs: StructureDir[];
}

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

export function resolveOutputDirRel(projectRoot: string, directory: string): string {
  const abs = path.isAbsolute(directory) ? directory : path.resolve(projectRoot, directory);
  return toPosix(path.relative(projectRoot, abs));
}

/**
 * Current Structure scope: same root normalization, prefix strip and
 * buildTree/flatten as the card, so describe/list match rendering. Depth is
 * capped at the ABSOLUTE supported depth to keep any renderable dir describable.
 */
export function buildStructureScope(projectRoot: string, config: ArteGitCardConfig): StructureScope {
  const rootRel = normalizeStructureRoot(config.cards.structure.root, projectRoot);
  const outputDirRel = resolveOutputDirRel(projectRoot, config.output.directory);
  const scan = scanRepository(projectRoot, { exclude: config.exclude ?? [], outputDirs: [outputDirRel] });
  const files = rootRel
    ? scan.files
        .filter((f) => f.relative.startsWith(`${rootRel}/`))
        .map((f) => ({ ...f, relative: f.relative.slice(rootRel.length + 1) }))
    : scan.files;
  const tree = buildTree(files, rootRel ?? ".", MAX_STRUCTURE_DEPTH);
  const dirs: StructureDir[] = flattenTree(tree).map((n) => ({ rel: n.rel, repoRel: n.repoRel, depth: n.depth }));
  return { rootRel, dirs };
}

export type PruneOutcome =
  | { status: "ok"; pruned: Record<string, string>; removed: string[] }
  | { status: "unverifiable"; pruned: Record<string, string>; removed: string[] };

/** Existence of ONE store key, from the CURRENT working tree (per-key). */
type KeyState = "present" | "absent" | "unverifiable";

function keyState(projectRoot: string, files: string[], key: string): KeyState {
  // Git candidates (tracked + untracked-not-ignored) are a baseline; each is then verified on disk.
  let sawUnverifiable = false;
  let underKey = false;
  const prefix = `${key}/`;
  for (const f of files) {
    if (!f.startsWith(prefix)) continue;
    underKey = true;
    // A symlinked/unreadable/non-regular candidate makes THIS key unverifiable — never other keys.
    if (!resolveContained(projectRoot, f) || !pathHasNoSymlinkComponents(projectRoot, f)) {
      sawUnverifiable = true;
      continue;
    }
    const abs = resolveContained(projectRoot, f)!;
    let st;
    try {
      st = lstatSync(abs);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") continue; // tracked file physically deleted
      sawUnverifiable = true; // EACCES/EPERM/EIO → unverifiable
      continue;
    }
    if (st.isSymbolicLink() || !st.isFile()) {
      sawUnverifiable = true; // tracked symlink / special → cannot verify
      continue;
    }
    return "present"; // a real regular file exists under the key → directory exists
  }
  if (!underKey) return "absent";
  return sawUnverifiable ? "unverifiable" : "absent";
}

/** Prune entries whose repo-relative dir is gone from the CURRENT working tree (a physical `rm` without staging still prunes). Unverifiable keys and an unbuildable Git index preserve everything. */
export function pruneStructureKeys(projectRoot: string, map: Record<string, string>): PruneOutcome {
  const files = listGitFiles(projectRoot);
  if (files === null) return { status: "unverifiable", pruned: map, removed: [] };
  const removed: string[] = [];
  const next: Record<string, string> = {};
  let anyUnverifiable = false;
  for (const key of Object.keys(map)) {
    const state = keyState(projectRoot, files, key);
    if (state === "present") {
      Object.defineProperty(next, key, { value: map[key], enumerable: true, writable: true, configurable: true });
    } else if (state === "absent") {
      removed.push(key);
    } else {
      anyUnverifiable = true;
      Object.defineProperty(next, key, { value: map[key], enumerable: true, writable: true, configurable: true });
    }
  }
  return { status: anyUnverifiable ? "unverifiable" : "ok", pruned: next, removed };
}
