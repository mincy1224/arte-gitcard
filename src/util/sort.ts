/**
 * Deterministic comparators (plan.md §74). Code-unit comparison is stable
 * across platforms and avoids locale-dependent ordering.
 */

export function compareCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
