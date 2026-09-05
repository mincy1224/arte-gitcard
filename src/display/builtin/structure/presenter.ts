/**
 * Structure Display presenter — legacy-backed wrapper. The SVG is produced by
 * the UNCHANGED legacy renderer (renderStructureCard); it reuses
 * codebase/tree/activity statistics, reading them through the readonly boundary
 * via the narrow `legacyView` seam.
 *
 * Directory descriptions are PURE DISPLAY metadata injected at generation time
 * onto the config slice as `descriptions` (never serialized to YAML).
 */

import type { StructureCardConfig } from "../../../config/types.js";
import type { DisplayContext } from "../../types.js";
import { codebaseStatistics, treeStatistics, activityStatistics } from "../../../statistics/index.js";
import { legacyView } from "../../../statistics/legacy-internal.js";
import type { ResolvedTheme } from "../../../theme/resolve.js";
import { buildStructureData } from "../../../structure/model.js";
import type { StructureData } from "../../../structure/model.js";
import { codeShareOf } from "../../../structure/share.js";
import { layoutStructure } from "../../../layout/structure.js";
import { renderStructureCard } from "../../../structure/render.js";

type LegacyTree = Parameters<typeof buildStructureData>[0];
type LegacyActivity = Parameters<typeof buildStructureData>[1];

/** Runtime-only injection: NEVER a persisted config key. */
export interface StructureDisplayRenderConfig extends StructureCardConfig {
  /** repo-relative descriptions map loaded from the CLI store (generation-only). */
  descriptions?: Record<string, string>;
  /** Offline repository display name (generation-only; whole-repo root row). */
  repositoryName?: string;
  /** codebase include-comments policy (generation-only) — the code-share rule. */
  codeIncludeComments?: boolean;
}

function attachCodeShare(
  data: StructureData,
  countedByDir: ReadonlyMap<string, { effective: number; comments: number; blank: number }>,
  includeComments: boolean,
): StructureData {
  for (const row of data.rows) row.codeShare = codeShareOf(countedByDir, row.repoRel, includeComments);
  return data;
}

/**
 * Attach generation-injected directory descriptions as DISPLAY metadata (not
 * statistics). Matching is an EXACT `row.repoRel` (canonical POSIX path relative
 * to the repo root); unmatched keys are ignored. Pure — no filesystem access.
 */
export function attachStructureDescriptions(
  data: StructureData,
  descriptions: Record<string, string> | undefined,
): StructureData {
  if (descriptions) {
    for (const row of data.rows) {
      // Own-property lookup only: a dir named `constructor`/`toString`/`__proto__`
      // must never read Object.prototype.
      if (Object.hasOwn(descriptions, row.repoRel)) {
        row.description = descriptions[row.repoRel];
      }
    }
  }
  return data;
}

export function renderStructureDisplay(ctx: DisplayContext<StructureCardConfig>): string {
  const config = ctx.config as StructureDisplayRenderConfig;
  const anchor = config.activity_anchor ?? "recent";
  // Narrow legacy seams (byte-locked builder expects historical mutable types).
  const tree = legacyView<LegacyTree>(
    ctx.statistics.get(treeStatistics, {
      root: config.root,
      maxDepth: config.max_depth,
    }),
  );
  const activity = legacyView<LegacyActivity>(
    ctx.statistics.get(activityStatistics, { days: config.activity_days, anchor }),
  );
  const theme = legacyView<ResolvedTheme>(ctx.theme);
  // structure.root "." → whole-repo card gets a level-0 repo row named after the repository.
  const wholeRepo = !config.root || config.root.trim() === ".";
  const repoName = wholeRepo && config.repositoryName ? config.repositoryName : null;
  const structureData = buildStructureData(tree, activity, config.activity_days, ctx.now, repoName);
  const codebase = ctx.statistics.get(codebaseStatistics); // single shared analysis pass
  attachCodeShare(structureData, codebase.countedByDir, config.codeIncludeComments === true);
  attachStructureDescriptions(structureData, config.descriptions);
  const layout = layoutStructure(structureData, {
    commits: config.commits.enabled,
    changes: config.changes.enabled,
  });
  return renderStructureCard(layout, theme, codebase.analyzedSourceFiles);
}
