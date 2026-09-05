/**
 * Code-share percentage tags (Structure card). A directory's share = its
 * subtree's COUNTED code lines over the WHOLE repository, under the codebase
 * card's exact policy: effective + comments when codebase.include-comments is
 * true, else effective only; blank lines never count. Counts come from the SAME
 * analyzeCodebase pass (countedByDir, accumulated up ancestors) — no second
 * scan, consistent with the codebase card.
 */

export interface DirLineCounts {
  effective: number;
  comments: number;
  blank: number;
}

/** Counted lines of a dir bucket under a comment policy (blank never counted). */
export function countedLines(d: DirLineCounts | undefined, includeComments: boolean): number {
  if (!d) return 0;
  return d.effective + (includeComments ? d.comments : 0);
}

/** Share (0..1) of a dir bucket over the whole-repo counted lines. */
export function codeShareOf(
  countedByDir: ReadonlyMap<string, DirLineCounts>,
  repoRel: string,
  includeComments: boolean,
): number {
  const total = countedLines(countedByDir.get("."), includeComments);
  if (total <= 0) return 0;
  return countedLines(countedByDir.get(repoRel), includeComments) / total;
}

/** Compact stable percent label: "3%" or "12.4%" (one decimal, no trailing .0). */
export function shareLabel(fraction: number): string {
  const p = (Number.isFinite(fraction) ? fraction : 0) * 100;
  const rounded = Math.round(p * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}%`;
}
