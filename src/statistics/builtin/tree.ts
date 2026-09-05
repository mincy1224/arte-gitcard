/**
 * treeStatistics — the typed directory tree (view-agnostic). No layout.
 * Reuses buildTree unchanged. Depends on repositoryScanStatistic.
 */

import { buildTree } from "../../structure/tree.js";
import type { DirectoryNode } from "../../structure/tree.js";
import { normalizeStructureRoot } from "../../config/root.js";
import type { ScannedFile } from "../../scanner/files.js";
import type { ScanResult } from "../../scanner/index.js";
import { defineStatistic } from "../definition.js";
import { legacyView } from "../legacy-internal.js";
import { repositoryScanStatistic } from "./repository-scan.js";

export interface TreeStatisticsParams {
  /** structure.root semantics: "." / "" = whole repo. */
  root: string;
  maxDepth: number;
}

function filesUnderRoot(files: ScannedFile[], rootRel: string): ScannedFile[] {
  return files
    .filter((f) => f.relative.startsWith(`${rootRel}/`))
    .map((f) => ({ ...f, relative: f.relative.slice(rootRel.length + 1) }));
}

export const treeStatistics = defineStatistic<TreeStatisticsParams, DirectoryNode>({
  id: "tree",
  cacheKey: (params) => `${params.root}|${params.maxDepth}`,
  compute: (ctx, params) => {
    // Internal seam: mutable view for the trusted legacy builder; normalizeStructureRoot resolves/validates "." (read-only).
    const scan = legacyView<ScanResult>(ctx.statistics.get(repositoryScanStatistic));
    const rootRel = normalizeStructureRoot(params.root, ctx.projectRoot);
    const files = rootRel ? filesUnderRoot(scan.files, rootRel) : scan.files;
    return buildTree(files, rootRel ?? ".", params.maxDepth);
  },
});
