/** Statistics API surface (internal, static). */

export { defineStatistic } from "./definition.js";
export type { StatisticDefinition } from "./definition.js";
export { StatisticsSession, createStatisticsSession } from "./session.js";
export type { StatisticsEnvironment } from "./session.js";
export type { StatisticsComputeContext, StatisticsReader } from "./types.js";

export { repositoryScanStatistic } from "./builtin/repository-scan.js";
export { codebaseStatistics } from "./builtin/codebase.js";
export { treeStatistics } from "./builtin/tree.js";
export type { TreeStatisticsParams } from "./builtin/tree.js";
export { activityStatistics } from "./builtin/activity.js";
export type { ActivityStatisticsParams } from "./builtin/activity.js";
