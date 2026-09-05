/**
 * Card-GLOBAL COMMITS heat scale — LOGARITHMIC / GEOMETRIC four positive bands.
 *
 * Level 0 is EXACTLY zero (neutral). Positive levels 1..4 come from geometric
 * thresholds derived from the actual positive commit range of the current
 * window, calibrated on NON-ROOT directory cells only (the repo-root row is a
 * whole-repository aggregate and must not distort module comparisons). Once the
 * scale is built, every cell — including the repo-root row — renders through
 * the SAME classifier, and values above the top threshold use the darkest level.
 *
 * No fixed threshold table, no quantiles, no equal-width linear bands.
 */

/** Thresholds include level 0 (0). thresholds[1..] are the positive minima. */
export interface CommitScale {
  thresholds: readonly number[];
}

const ceilPow = (base: number, exp: number): number => Math.ceil(Math.pow(base, exp));

/**
 * Build the geometric scale from the maximum positive NON-ROOT commit count `M`.
 * Positive thresholds are 1, M^(1/4), M^(1/2), M^(3/4), each ceiled and
 * deduplicated (strictly increasing; small datasets yield only meaningful
 * distinct thresholds). M=0 → only the neutral bucket.
 */
export function buildCommitScale(maxPositive: number): CommitScale {
  if (!(maxPositive >= 1) || !Number.isFinite(maxPositive)) return { thresholds: [0] };
  const M = Math.floor(maxPositive);
  if (M === 0) return { thresholds: [0] };
  const raw = [1, ceilPow(M, 0.25), ceilPow(M, 0.5), ceilPow(M, 0.75)];
  const pos: number[] = [];
  for (const v of raw) {
    const n = Math.max(1, Math.min(M, Math.floor(v)));
    if (n > (pos[pos.length - 1] ?? 0)) pos.push(n);
  }
  if (pos.length === 0) pos.push(1);
  return { thresholds: [0, ...pos] };
}

/**
 * Level (0..4) of a commit count. count===0 → 0. Positive counts are ranked by
 * the thresholds; when the data only supports fewer than four distinct bands,
 * the top of the dataset still reaches the strongest positive color (levels are
 * compressed upward toward 4 so the largest observed activity is always darkest).
 */
export function levelOf(scale: CommitScale, count: number): number {
  if (count <= 0) return 0;
  const k = scale.thresholds.length - 1; // number of positive thresholds
  if (k === 0) return 0;
  let idx = 0;
  for (let i = 1; i <= k; i++) {
    if (count >= scale.thresholds[i]!) idx = i;
  }
  if (idx === 0) idx = 1; // positive but below t1 (shouldn't happen)
  return Math.min(4, idx + (4 - k));
}

/** Legend text from the SAME scale: "0 · t1 · … · top+ commits". */
export function commitScaleLegendText(scale: CommitScale): string {
  if (scale.thresholds.length === 1) return "0 commits";
  const parts = scale.thresholds.map((t, i) =>
    i === scale.thresholds.length - 1 ? `${t}+` : String(t),
  );
  return `${parts.join(" · ")} commits`;
}
