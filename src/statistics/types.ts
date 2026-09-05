/**
 * Statistics API types. A StatisticsSession is created once per generation;
 * Displays read statistics ONLY through `StatisticsReader.get`, never by touching
 * the filesystem, git, state.json or config directly.
 */

import type { Registry } from "../languages/registry.js";
import type { StatisticDefinition } from "./definition.js";
import type { DeepReadonly } from "../util/readonly.js";

/** Recursively readonly view — see src/util/readonly.ts. */
export type { DeepReadonly };

/**
 * Everything a statistic compute may read — the ONLY surface a definition
 * sees. No fs/child_process/state/mutation here; statistics get read-only
 * access solely through the audited readers (scanRepository / runGitActivity /
 * analyzeCodebase).
 */
export interface StatisticsComputeContext {
  projectRoot: string;
  /** The deterministic generation instant (a FRESH Date per compute call). */
  now: Date;
  /** Current resolved output directory as a repo-relative POSIX path. */
  outputDirRel: string;
  /** User-editable scan exclusions (scanner applies hard excludes itself). */
  exclude?: string[];
  /**
   * Activity-exclusion dirs = current output dir + every recorded HISTORICAL
   * state.outputRoots entry. Metadata only — NEVER mutation authority.
   */
  activityDirs: string[];
  /** Effective language registry (built-ins merged with config custom rules). */
  registry: Registry;
  /** Dependencies: read another statistic (cached, cycle-checked) inside compute. */
  statistics: StatisticsReader;
}

/**
 * Stable read-only surface for Displays. `get` returns a DeepReadonly view of
 * the SAME cached instance — shared across Displays, never cloned/recomputed —
 * the wrapper being a compile-time guard against accidental mutation.
 */
export interface StatisticsReader {
  get<P, R>(definition: StatisticDefinition<P, R>, params?: Readonly<P>): DeepReadonly<R>;
}
