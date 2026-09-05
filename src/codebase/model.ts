/**
 * Codebase card model: the canonical ranked language list + color assignment.
 * One sorted array is the single source of truth for the bar, the rows and the
 * color assignment, so they can never disagree.
 */

import { compareCodeUnit } from "../util/sort.js";

/** Per-language line statistics (plan.md §64). */
export interface LanguageStat {
  id: string;
  name: string;
  effective: number;
  comments: number;
  files: number;
}

export function countedLines(stat: LanguageStat, includeComments: boolean): number {
  return stat.effective + (includeComments ? stat.comments : 0);
}

/** Canonical ranking comparator: countedLines DESC → name ASC (plan.md §64); name breaks ties deterministically. */
export function compareLanguageRank(
  a: LanguageStat,
  b: LanguageStat,
  includeComments: boolean,
): number {
  const diff = countedLines(b, includeComments) - countedLines(a, includeComments);
  if (diff !== 0) return diff;
  return compareCodeUnit(a.name, b.name);
}

export function sortLanguages(langs: LanguageStat[], includeComments: boolean): LanguageStat[] {
  return [...langs].sort((a, b) => compareLanguageRank(a, b, includeComments));
}

/**
 * Sort and assign colors by rank: the i-th entry of the sorted array receives
 * dataColors[i] (palette tiering, plan.md §46).
 */
export function rankLanguages(
  stats: LanguageStat[],
  includeComments: boolean,
  dataColors: string[],
): { ranked: LanguageStat[]; colorById: Map<string, string> } {
  const ranked = sortLanguages(stats, includeComments);
  const colorById = new Map<string, string>();
  ranked.forEach((stat, i) => {
    const color = dataColors[i % dataColors.length];
    if (color) colorById.set(stat.id, color);
  });
  return { ranked, colorById };
}
