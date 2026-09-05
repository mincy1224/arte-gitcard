/** Structure card data: flattened tree rows each carrying activity. */

import type { DirectoryNode } from "./tree.js";
import { flattenTree } from "./tree.js";
import type { ActivityDay } from "./activity.js";

export interface StructureRow {
  name: string;
  /** POSIX path relative to the display root (after any structure.root strip). */
  rel: string;
  /** POSIX path relative to the repository root (activity lookup key). */
  repoRel: string;
  depth: number;
  descendantDirs: number;
  /** Direct child directories (repo fact, pre-prune). */
  dirs: number;
  /** Direct child files (repo fact, pre-prune). */
  files: number;
  hasChildren: boolean;
  activity: ActivityDay[];
  /**
   * This directory's share (0..1) of the WHOLE repository's counted code lines,
   * under the codebase include-comments policy. Attached by the Structure
   * presenter from the codebase analysis pass; the level-0 repository row is 1
   * (100%) for a whole-repo card.
   */
  codeShare?: number;
  /**
   * Display metadata (NOT repository statistics): a generation-injected
   * description shown to the right of this directory's name. Attached by the
   * Structure presenter from the CLI-managed store by exact `repoRel` match.
   */
  description?: string;
}

export interface StructureData {
  rows: StructureRow[];
  days: number;
  totalCommits: number;
  /** Window day 0 ("YYYY-MM-DD", UTC) — the header/bucket anchor. */
  startDate: string;
}

/** The slice of ActivityMap buildStructureData actually consumes. */
export type StructureActivity = {
  totalCommits: number;
  byDir: Map<string, ActivityDay[]>;
  /** When the window is NOT the default recent window, its day-0 date. */
  startDate?: string;
};

function emptyDays(days: number): ActivityDay[] {
  return Array.from({ length: days }, () => ({ commits: 0, additions: 0, deletions: 0 }));
}

function recentStart(now: Date, days: number): string {
  return new Date(now.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
}

/**
 * Combine the directory tree with per-dir activity into renderable rows.
 *
 * `repoName` (optional) adds a level-0 REPOSITORY row (whole-repo card only):
 * every tree row is pushed one level deeper beneath it, and the repository row
 * carries the repository-root dir/file counts plus the repository-root activity.
 * For a non-default `structure.root` the caller omits `repoName`, keeping the
 * card scoped exactly to that subtree.
 */
export function buildStructureData(
  tree: DirectoryNode,
  activity: StructureActivity | null,
  days: number,
  now: Date,
  repoName?: string | null,
): StructureData {
  const byDir = (repoRel: string): ActivityDay[] => activity?.byDir.get(repoRel) ?? emptyDays(days);
  const rootShift = repoName != null ? 1 : 0;
  const rows: StructureRow[] = [];
  if (repoName != null) {
    rows.push({
      name: repoName,
      rel: ".",
      repoRel: ".",
      depth: 0,
      descendantDirs: tree.descendantDirs,
      dirs: tree.directDirs,
      files: tree.directFiles,
      hasChildren: tree.children.length > 0,
      activity: byDir("."),
    });
  }
  for (const node of flattenTree(tree)) {
    rows.push({
      name: node.name,
      rel: node.rel,
      repoRel: node.repoRel,
      depth: node.depth + rootShift,
      descendantDirs: node.descendantDirs,
      dirs: node.directDirs,
      files: node.directFiles,
      hasChildren: node.children.length > 0,
      activity: byDir(node.repoRel),
    });
  }
  return {
    rows,
    days,
    totalCommits: activity?.totalCommits ?? 0,
    startDate: activity?.startDate ?? recentStart(now, days),
  };
}
