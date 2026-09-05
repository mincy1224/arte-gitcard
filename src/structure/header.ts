/** Activity header labels (F6): labels correspond 1:1 to the underlying daily
 * buckets. 7 days → the actual weekday letter of each bucket date; 14/30 days →
 * the actual calendar day-of-month of each bucket date (month boundaries simply
 * reset at day 1). No assumption that the window starts on Sunday. */

import { dayOfWeekUtc, addUtcDays } from "./dates.js";

const WEEKDAY_BY_DOW = ["S", "M", "T", "W", "T", "F", "S"];

export interface HeaderLabel {
  cellIndex: number;
  label: string;
}

/** Two-digit day-of-month ("03"), matching the requirement's 14/30 label style. */
function dayOfMonthLabel(dateStr: string): string {
  const day = Number(dateStr.slice(8, 10));
  return day < 10 ? `0${day}` : String(day);
}

export function resolveActivityHeader(days: number, startDate: string): HeaderLabel[] {
  const out: HeaderLabel[] = [];
  for (let i = 0; i < days; i++) {
    const date = addUtcDays(startDate, i);
    const label = days <= 7 ? WEEKDAY_BY_DOW[dayOfWeekUtc(date)]! : dayOfMonthLabel(date);
    out.push({ cellIndex: i, label });
  }
  return out;
}
