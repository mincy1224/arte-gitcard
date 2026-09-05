/**
 * activityStatistics — git activity for a window (view-agnostic). The framework
 * supplies projectRoot, now, current output dir and the historical
 * state.outputRoots (metadata only — never mutation authority); a Display cannot
 * inject arbitrary outputDirs.
 */

import { runGitActivity } from "../../structure/activity.js";
import type { ActivityMap } from "../../structure/activity.js";
import type { ActivityAnchor } from "../../structure/dates.js";
import { defineStatistic } from "../definition.js";

export interface ActivityStatisticsParams {
  days: number;
  anchor: ActivityAnchor;
}

export const activityStatistics = defineStatistic<ActivityStatisticsParams, ActivityMap | null>({
  id: "activity",
  cacheKey: (params) => `${params.anchor}|${params.days}`,
  compute: (ctx, params) =>
    runGitActivity(ctx.projectRoot, params.days, ctx.now, {
      outputDirs: ctx.activityDirs,
      exclude: ctx.exclude,
    }, params.anchor),
});
