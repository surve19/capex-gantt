/**
 * Layout constants and calendar-day helpers for rendering.
 *
 * These are intentionally separate from `@capex-gantt/core`'s working-day
 * calendar engine: rendering needs to position bars across *every* calendar
 * day (including weekends/holidays, which are still drawn, just shaded),
 * whereas the core engine only reasons about working days.
 */

export const DEFAULT_ROW_HEIGHT = 36;
export const HEADER_HEIGHT = 50;
export const MIN_PX_PER_DAY = 8;
export const MAX_PX_PER_DAY = 80;
export const DEFAULT_PX_PER_DAY = 32;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Returns a new `Date` truncated to midnight local time. */
export function startOfDay(date: Date): Date {
  const result = new Date(date.getTime());
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Returns a new `Date` `days` calendar days after `date`. */
export function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/** Returns the number of calendar days from `from` to `to` (may be negative). */
export function diffCalendarDays(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/** Returns true if `date` falls on a Saturday or Sunday. */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
