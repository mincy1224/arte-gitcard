/**
 * Centralized UTC date helpers for the Git-activity window. ONE normalization
 * rule (UTC calendar days) is shared by commit bucketing, the model's day-0, the
 * header labels and the activity window — no scattered ad-hoc date math.
 */

export type ActivityAnchor = "recent" | "last-activity";

/** "YYYY-MM-DD" UTC day of a Date. */
export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add `delta` whole UTC days to a "YYYY-MM-DD" day. */
export function addUtcDays(dateStr: string, delta: number): string {
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  return new Date(t + delta * 86400000).toISOString().slice(0, 10);
}

/** Day of week (0=Sun..6=Sat) of a "YYYY-MM-DD" day. */
export function dayOfWeekUtc(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

/** Whole UTC days between two "YYYY-MM-DD" days (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** The `days` consecutive bucket dates ending at `endDay` (index 0 = start). */
export function bucketDates(endDay: string, days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) out.push(addUtcDays(endDay, i - (days - 1)));
  return out;
}

export interface ActivityWindow {
  anchor: ActivityAnchor;
  days: number;
  /** Window end "YYYY-MM-DD" (today for recent; latest commit day for last-activity). */
  endDate: string;
  /** Window start "YYYY-MM-DD". */
  startDate: string;
  /** The `days` bucket dates, oldest→newest. */
  dates: string[];
}

/**
 * Resolve the shared activity window. `latestCommitDay` is the UTC day of the
 * repository's newest commit (used ONLY by `last-activity`; for `recent` the
 * window always ends on the current day). When `last-activity` has no usable
 * history the window degrades to the recent window (activity is then empty).
 */
export function resolveActivityWindow(
  days: number,
  anchor: ActivityAnchor,
  now: Date,
  latestCommitDay?: string | null,
): ActivityWindow {
  const endDate = anchor === "last-activity" && latestCommitDay ? latestCommitDay : utcDay(now);
  const dates = bucketDates(endDate, days);
  return { anchor, days, endDate, startDate: dates[0]!, dates };
}
