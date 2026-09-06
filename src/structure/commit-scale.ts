/**
 * Card-GLOBAL COMMITS heat scale — GitHub-inspired robust QUARTILE bands.
 *
 * Level 0 is EXACTLY zero (neutral). The calibration samples are every cell in
 * the current activity window with commits > 0 across the NON-ROOT rows (the
 * repo-root row is a whole-repository aggregate and must not distort module
 * comparisons). Upper outliers are pushed aside first (Tukey upper fence
 * Q3 + 1.5·IQR): they only leave the CALIBRATION set — they still render, and
 * because they sit above Q3 they naturally fall into the darkest level.
 *
 * The remaining calibration set yields Q1/Q2(median)/Q3; a commit count maps to
 * <=Q1 → level 1, <=Q2 → level 2, <=Q3 → level 3, >Q3 → level 4. Duplicate
 * quartile boundaries collapse naturally: small samples / repeated values never
 * force four distinct positive shades, the same count always gets the same
 * color, higher counts never drop a level, and any count above Q3 clamps to the
 * darkest level.
 *
 * This is GitHub-INSPIRED, not a full replication: GitHub has not published its
 * complete outlier handling, so the exact fence/quantile method here is ours.
 */

/** Discrete quartile samples do not need interpolation beyond the observed order. */
export interface CommitScale {
  /**
   * Legend / classifier chips. thresholds[0] = 0 (level 0). thresholds[1..] are
   * strictly increasing MINIMUM commit counts, one per shade the current data
   * actually discriminates. levels[i] is the palette level (0..4) of that chip —
   * duplicate quartile boundaries collapse so shades never overlap.
   */
  thresholds: readonly number[];
  /** Palette level (0..4) drawn for each threshold chip (parallel array). */
  levels: readonly number[];
}

/** Type-7 (linear-interpolation) quartile of an ascending-sorted sample. */
function quantileAt(sorted: readonly number[], p: number): number {
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (h - lo) * (sorted[hi]! - sorted[lo]!);
}

/** Smallest integer count strictly greater than quartile `q` (the level boundary). */
const above = (q: number): number => Math.floor(q) + 1;

/**
 * Build the robust quartile scale from the FULL positive NON-ROOT commit
 * distribution of the window (every day-cell with commits > 0). Empty → only
 * the neutral bucket. Level thresholds come from quartiles AFTER upper outliers
 * are excluded, so one outlier day can never stretch the colour bands.
 */
export function buildCommitScale(positiveNonRootCounts: readonly number[]): CommitScale {
  const positives = positiveNonRootCounts.filter((v) => v > 0).sort((a, b) => a - b);
  if (positives.length === 0) return { thresholds: [0], levels: [0] };

  // Tukey upper fence on the FULL positive sample; values above it are excluded
  // from calibration only (they still render, landing above Q3 → darkest).
  const q1Full = quantileAt(positives, 0.25);
  const q3Full = quantileAt(positives, 0.75);
  const upperFence = q3Full + 1.5 * (q3Full - q1Full);
  const calibration = positives.filter((v) => v <= upperFence);

  // Quartiles of the (outlier-free) calibration set drive the level boundaries.
  const source = calibration.length > 0 ? calibration : positives;
  const q1 = quantileAt(source, 0.25);
  const q2 = quantileAt(source, 0.5);
  const q3 = quantileAt(source, 0.75);

  // Positive level minima (palette level L): L=1 starts at 1 (any commit), L>=2
  // starts just past the previous quartile. Non-decreasing; duplicates collapse
  // the shade up to the darker level that shares the boundary.
  const minima = [1, above(q1), above(q2), above(q3)];
  const thresholds: number[] = [0];
  const levels: number[] = [0];
  for (let level = 1; level <= 4; level++) {
    const t = minima[level - 1]!;
    const last = thresholds[thresholds.length - 1]!;
    if (t > last) {
      thresholds.push(t);
      levels.push(level);
    } else {
      levels[levels.length - 1] = level; // collapse: this shade is that much darker
    }
  }

  // Drop any shade whose minimum no observed commit reaches (keeps the top chip
  // only when data — including an upper outlier — actually reaches it).
  const maxPositive = positives[positives.length - 1]!;
  while (thresholds.length > 1 && thresholds[thresholds.length - 1]! > maxPositive) {
    thresholds.pop();
    levels.pop();
  }
  return { thresholds, levels };
}

/**
 * Level (0..4) of a commit count on the shared card scale. count === 0 → 0.
 * Positive counts climb to the highest chip whose minimum they meet (== the
 * quartile mapping), so same-count-same-level, monotone, and anything above the
 * top boundary (upper outliers, the repo-root aggregate) clamps to the darkest
 * rendered level.
 */
export function levelOf(scale: CommitScale, count: number): number {
  if (count <= 0) return 0;
  for (let i = scale.thresholds.length - 1; i >= 0; i--) {
    if (count >= scale.thresholds[i]!) return scale.levels[i]!;
  }
  return 0;
}

/** Legend text from the SAME scale: "0 · t1 · … · top+ commits". */
export function commitScaleLegendText(scale: CommitScale): string {
  if (scale.thresholds.length === 1) return "0 commits";
  const parts = scale.thresholds.map((t, i) =>
    i === scale.thresholds.length - 1 ? `${t}+` : String(t),
  );
  return `${parts.join(" · ")} commits`;
}
