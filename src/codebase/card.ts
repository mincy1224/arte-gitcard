/**
 * Codebase card data: top metrics, summary/fan fractions and the canonical
 * ranked language list (shared by the Language Bar and the language area).
 */

import type { CodebaseData } from "./analyze.js";
import { rankLanguages } from "./model.js";
import { formatInteger, formatPercent } from "../util/format.js";

export interface LanguageCardItem {
  id: string;
  name: string;
  color: string;
  /** Lines that count toward rank: effective (or effective + comments). */
  counted: number;
  /** counted / totalCounted. */
  fraction: number;
  /** Display string, e.g. "15,147 · 39.2%". */
  value: string;
}

export interface CodebaseCardData {
  total: string;
  effective: string;
  comments: string;
  blank: string;
  /** [effective, comments, blank] as fractions of total lines. */
  summaryFracs: [number, number, number];
  /** Ranked languages with colors + display strings (Bar and rows share this). */
  languages: LanguageCardItem[];
  includeComments: boolean;
}

export function buildCodebaseCard(
  data: CodebaseData,
  includeComments: boolean,
  dataColors: string[],
): CodebaseCardData {
  const { ranked, colorById } = rankLanguages(data.languages, includeComments, dataColors);
  const total = data.totalLines;
  const totalCounted = includeComments
    ? data.effectiveLines + data.commentLines
    : data.effectiveLines;

  const languages: LanguageCardItem[] = ranked.map((s) => {
    const counted = includeComments ? s.effective + s.comments : s.effective;
    const fraction = totalCounted > 0 ? counted / totalCounted : 0;
    return {
      id: s.id,
      name: s.name,
      color: colorById.get(s.id) ?? "#A49E94",
      counted,
      fraction,
      value: `${formatInteger(counted)} · ${formatPercent(fraction)}`,
    };
  });

  const effectiveFrac = total > 0 ? data.effectiveLines / total : 0;
  const commentsFrac = total > 0 ? data.commentLines / total : 0;
  const blankFrac = total > 0 ? data.blankLines / total : 0;

  return {
    total: formatInteger(total),
    effective: `${formatInteger(data.effectiveLines)} · ${formatPercent(effectiveFrac)}`,
    comments: `${formatInteger(data.commentLines)} · ${formatPercent(commentsFrac)}`,
    blank: `${formatInteger(data.blankLines)} · ${formatPercent(blankFrac)}`,
    summaryFracs: [effectiveFrac, commentsFrac, blankFrac],
    languages,
    includeComments,
  };
}
