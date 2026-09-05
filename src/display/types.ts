/**
 * Display context — the ONLY surface a Display template receives: read-only
 * statistics, its own config slice, the resolved theme. NO projectRoot / fs /
 * state / transaction / github / git / child_process.
 *
 * `now` is the DETERMINISTIC generation instant injected by the planner, never
 * wall-clock; a template must not read Date.now()/new Date().
 */

import type { ResolvedTheme } from "../theme/resolve.js";
import type { StatisticsReader } from "../statistics/types.js";
import type { DeepReadonly } from "../util/readonly.js";

export interface DisplayContext<C> {
  statistics: StatisticsReader;
  /** Deep-readonly config slice — a Display must never mutate a shared config object. */
  config: DeepReadonly<C>;
  /** Deep-readonly resolved theme. Legacy renderers reach mutable views only via the internal legacyView seam. */
  theme: DeepReadonly<ResolvedTheme>;
  /** FRESH Date for the deterministic generation instant — never shared, so mutating it affects nothing else. */
  now: Date;
}
