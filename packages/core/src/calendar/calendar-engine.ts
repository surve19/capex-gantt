import type { Calendar } from '../types.js';
import { addDays, toDate, toISODateString } from '../utils/date.js';

/**
 * Working-time date math for a single `Calendar`.
 *
 * All scheduling code (CPM forward/backward pass) routes its date
 * arithmetic through these functions so that future calendar features
 * (shift patterns, multi-calendar inheritance) only need to change this
 * module, not callers.
 *
 * Phase 1.5 works in working-hour granularity. A working day `D` has an
 * implicit working window `[D@00:00, D@00:00 + hoursPerDay hours)` — there is
 * no separate "shift start time" configuration. Internally, instants are
 * decomposed into a `DayTime` (a midnight-truncated day plus milliseconds
 * since that midnight); this lets `addWorkingHours`/`diffWorkingHours` handle
 * `hoursPerDay === 24` without special-casing, via the day-boundary sentinel
 * values used by `forwardSnap`/`backwardSnap`.
 *
 * Known limitation: this arithmetic assumes every calendar day is exactly 24
 * hours, so a DST-transition day combined with `hoursPerDay` near 24 could be
 * off by the DST delta. The day-based engine had no DST handling either, and
 * typical EPC calendars use `hoursPerDay <= 12`.
 */

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Returns true if `date` is a working day per `calendar`, applying exceptions over the weekly pattern. */
export function isWorkingDay(calendar: Calendar, date: Date): boolean {
  const iso = toISODateString(date);
  const exception = calendar.exceptions.find((e) => e.date === iso);
  if (exception) return exception.isWorking;
  return calendar.workingDays[date.getDay()] ?? false;
}

/** A point in time decomposed into its calendar day (midnight) and milliseconds since that midnight. */
interface DayTime {
  day: Date;
  msOfDay: number;
}

function toDayTime(date: Date): DayTime {
  const day = toDate(date);
  return { day, msOfDay: date.getTime() - day.getTime() };
}

function fromDayTime(dt: DayTime): Date {
  return new Date(dt.day.getTime() + dt.msOfDay);
}

function compareDayTime(a: DayTime, b: DayTime): -1 | 0 | 1 {
  const diff = a.day.getTime() + a.msOfDay - (b.day.getTime() + b.msOfDay);
  if (diff < 0) return -1;
  if (diff > 0) return 1;
  return 0;
}

/** Smallest working day strictly after `day`. */
function stepToNextWorkingDay(calendar: Calendar, day: Date): Date {
  let current = addDays(day, 1);
  while (!isWorkingDay(calendar, current)) {
    current = addDays(current, 1);
  }
  return current;
}

/** Largest working day strictly before `day`. */
function stepToPreviousWorkingDay(calendar: Calendar, day: Date): Date {
  let current = addDays(day, -1);
  while (!isWorkingDay(calendar, current)) {
    current = addDays(current, -1);
  }
  return current;
}

/** Finds the earliest working instant on or after `date`. */
function forwardSnap(calendar: Calendar, date: Date): DayTime {
  const window = calendar.hoursPerDay * MS_PER_HOUR;
  let { day, msOfDay } = toDayTime(date);
  while (!(isWorkingDay(calendar, day) && msOfDay < window)) {
    day = addDays(day, 1);
    msOfDay = 0;
  }
  return { day, msOfDay };
}

/** Finds the latest working instant on or before `date`. */
function backwardSnap(calendar: Calendar, date: Date): DayTime {
  const window = calendar.hoursPerDay * MS_PER_HOUR;
  let { day, msOfDay } = toDayTime(date);
  while (!isWorkingDay(calendar, day)) {
    day = addDays(day, -1);
    msOfDay = MS_PER_DAY;
  }
  return { day, msOfDay: Math.min(msOfDay, window) };
}

/**
 * A `DayTime` returned by `addWorkingHours` may land exactly on a working
 * window's end (`msOfDay === hoursPerDay * MS_PER_HOUR`). That instant
 * represents zero working-hours of difference from the start of the next
 * working day, so normalize it to that canonical form before diffing.
 */
function normalize(calendar: Calendar, dt: DayTime): DayTime {
  const window = calendar.hoursPerDay * MS_PER_HOUR;
  if (dt.msOfDay >= window) {
    return { day: stepToNextWorkingDay(calendar, dt.day), msOfDay: 0 };
  }
  return dt;
}

/**
 * Advances `date` by `hours` working hours.
 *
 * - `hours === 0`: snaps forward to the next working instant on/after `date`.
 * - `hours > 0`: snaps forward, then consumes `hours` working hours,
 *   rolling over to the next working day's start (`00:00`) whenever the
 *   current day's working window is exhausted.
 * - `hours < 0`: snaps backward to the previous working instant on/before
 *   `date`, then consumes `-hours` working hours backward, rolling over to
 *   the previous working day's window end whenever the current day's
 *   working window is exhausted.
 *
 * A finish-to-start dependency with `lagHours === 0` therefore lets a
 * successor start at the exact instant its predecessor finishes, including
 * mid-day for sub-day tasks.
 */
export function addWorkingHours(calendar: Calendar, date: Date, hours: number): Date {
  const window = calendar.hoursPerDay * MS_PER_HOUR;

  if (hours === 0) {
    return fromDayTime(forwardSnap(calendar, date));
  }

  if (hours > 0) {
    let { day, msOfDay } = forwardSnap(calendar, date);
    let remainingMs = hours * MS_PER_HOUR;
    while (true) {
      const available = window - msOfDay;
      if (remainingMs <= available) {
        return fromDayTime({ day, msOfDay: msOfDay + remainingMs });
      }
      remainingMs -= available;
      day = stepToNextWorkingDay(calendar, day);
      msOfDay = 0;
    }
  }

  let { day, msOfDay } = backwardSnap(calendar, date);
  let remainingMs = -hours * MS_PER_HOUR;
  while (true) {
    const available = msOfDay;
    if (remainingMs <= available) {
      return fromDayTime({ day, msOfDay: msOfDay - remainingMs });
    }
    remainingMs -= available;
    day = stepToPreviousWorkingDay(calendar, day);
    msOfDay = window;
  }
}

/**
 * Counts working hours from `start` to `end`.
 *
 * Returns a positive number if `end` is after `start` in working-time terms,
 * negative if before, and 0 if they represent the same working-time
 * position (used for total float).
 */
export function diffWorkingHours(calendar: Calendar, start: Date, end: Date): number {
  const window = calendar.hoursPerDay * MS_PER_HOUR;
  let a = normalize(calendar, toDayTime(start));
  let b = normalize(calendar, toDayTime(end));

  const cmp = compareDayTime(a, b);
  if (cmp === 0) return 0;

  const sign = cmp < 0 ? 1 : -1;
  if (sign < 0) {
    const tmp = a;
    a = b;
    b = tmp;
  }

  let totalMs = 0;
  let current = a;
  while (current.day.getTime() !== b.day.getTime()) {
    totalMs += window - current.msOfDay;
    current = { day: stepToNextWorkingDay(calendar, current.day), msOfDay: 0 };
  }
  totalMs += b.msOfDay - current.msOfDay;

  return (sign * totalMs) / MS_PER_HOUR;
}
