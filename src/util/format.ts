/**
 * Deterministic number formatting. No Intl, no locale drift — the same input
 * always yields the same string on every platform (plan.md §73).
 */

/** Round to at most 1 decimal place. The single rounding policy for all layout floats. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Format a non-negative integer with thousands separators, e.g. 48732 → "48,732". */
export function formatInteger(value: number): string {
  const digits = String(Math.trunc(value));
  let out = "";
  let count = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    out = digits.charAt(i) + out;
    count += 1;
    if (count % 3 === 0 && i > 0) out = "," + out;
  }
  return out;
}

/** Format a fraction in [0, 1] as a percentage with one decimal, e.g. 0.793 → "79.3%". */
export function formatPercent(fraction: number): string {
  const percent = round1(fraction * 100);
  return `${percent.toFixed(1)}%`;
}
