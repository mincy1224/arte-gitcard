/**
 * Statistic definitions (token/definition pattern). A definition is a pure,
 * read-only computation registered statically; Displays never switch on ids.
 */

import type { StatisticsComputeContext } from "./types.js";

export interface StatisticDefinition<P, R> {
  /** Stable diagnostic id; cache/token identity is the StatisticDefinition object. */
  readonly id: string;
  readonly compute: (ctx: StatisticsComputeContext, params: Readonly<P>) => R;
  /** Canonical cache key for parameterized statistics; when omitted, params are canonicalized deterministically. */
  readonly cacheKey?: (params: Readonly<P>) => string;
}

/** Freeze the definition — guards against accidental mutation. */
export function defineStatistic<P, R>(definition: StatisticDefinition<P, R>): StatisticDefinition<P, R> {
  return Object.freeze(definition);
}
