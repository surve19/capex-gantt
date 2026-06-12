import type { DateInput } from '../types.js';

/**
 * Pure date helpers with no calendar awareness. All functions operate on
 * (and return) date-only values at midnight local time.
 */

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a `DateInput` into a `Date` truncated to midnight local time.
 *
 * Plain "YYYY-MM-DD" strings are parsed as local-date components (not UTC),
 * so the result always represents the intended calendar day regardless of
 * the host timezone's offset from UTC.
 */
export function toDate(input: DateInput): Date {
  if (typeof input === 'string') {
    const match = ISO_DATE_ONLY.exec(input);
    if (match) {
      const [, year, month, day] = match as unknown as [string, string, string, string];
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }

  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date input: ${String(input)}`);
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Returns a new `Date` `days` calendar days after `date` (negative `days` moves backward). */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/** Returns true if `a` and `b` represent the same calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Returns -1, 0, or 1 if `a` is before, equal to, or after `b`. */
export function compareDates(a: Date, b: Date): -1 | 0 | 1 {
  const diff = a.getTime() - b.getTime();
  if (diff < 0) return -1;
  if (diff > 0) return 1;
  return 0;
}

/** Returns the later of two dates. */
export function maxDate(a: Date, b: Date): Date {
  return compareDates(a, b) >= 0 ? a : b;
}

/** Returns the earlier of two dates. */
export function minDate(a: Date, b: Date): Date {
  return compareDates(a, b) <= 0 ? a : b;
}

/** Formats a `Date` as an ISO "YYYY-MM-DD" string in local time. */
export function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
