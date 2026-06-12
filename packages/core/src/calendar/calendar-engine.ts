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
 *
 * Phase 2 adds multi-calendar support. `resolveEffectiveCalendar` resolves a
 * calendar's optional `inheritsFrom` parent into a single flat `Calendar`
 * (merging exceptions, child wins on date conflicts) so the rest of this
 * module never needs to be aware of inheritance. `convertInstant` converts an
 * instant computed in one calendar's working-day frame into the equivalent
 * instant in another calendar's frame, preserving the fraction of the
 * working day elapsed — used when chaining dependencies across calendars with
 * different `hoursPerDay`.
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

/**
 * Resolves a calendar's optional `inheritsFrom` parent into a single flat
 * `Calendar` with no `inheritsFrom` of its own.
 *
 * - If `calendarId` has no `inheritsFrom`, it is returned as-is (a shallow
 *   copy).
 * - If it has `inheritsFrom`, the parent calendar is looked up and its
 *   `exceptions` are merged with the child's: effective `exceptions` =
 *   parent's exceptions concatenated with the child's, de-duped by `date`
 *   (the child's entry wins when both specify the same `date`). `id`,
 *   `name`, `workingDays`, and `hoursPerDay` always come from the child,
 *   since these are required fields the child always defines.
 *
 * Throws if `calendarId` is not found, if its `inheritsFrom` parent is not
 * found, or if the parent itself has `inheritsFrom` set (multi-level chains
 * are not supported).
 */
export function resolveEffectiveCalendar(calendars: Calendar[], calendarId: string): Calendar {
  const calendar = calendars.find((c) => c.id === calendarId);
  if (!calendar) {
    throw new Error(`Calendar "${calendarId}" not found`);
  }

  if (!calendar.inheritsFrom) {
    return { ...calendar };
  }

  const parentId = calendar.inheritsFrom;
  const parent = calendars.find((c) => c.id === parentId);
  if (!parent) {
    throw new Error(`Calendar "${calendarId}" inherits from unknown calendar "${parentId}"`);
  }
  if (parent.inheritsFrom) {
    throw new Error(
      `Calendar "${parentId}" cannot be used as a parent because it itself inherits from another calendar (multi-level chains not supported)`,
    );
  }

  const exceptionsByDate = new Map<string, (typeof calendar.exceptions)[number]>();
  for (const exception of parent.exceptions) {
    exceptionsByDate.set(exception.date, exception);
  }
  for (const exception of calendar.exceptions) {
    exceptionsByDate.set(exception.date, exception);
  }

  return {
    id: calendar.id,
    name: calendar.name,
    workingDays: calendar.workingDays,
    hoursPerDay: calendar.hoursPerDay,
    exceptions: Array.from(exceptionsByDate.values()),
  };
}

/**
 * Converts an instant computed in `from`'s calendar frame into the
 * equivalent instant in `to`'s frame, preserving the fraction of the working
 * day elapsed.
 *
 * - If `from.id === to.id`, returns `date` unchanged (fast path).
 * - Otherwise decomposes `date` into its calendar day and milliseconds since
 *   midnight, then rescales `msOfDay` by the ratio of the two calendars'
 *   working-day lengths (`hoursPerDay * MS_PER_HOUR`). An instant exactly at
 *   `from`'s window end maps to exactly `to`'s window end (which then rolls
 *   to the next working day's `00:00` via `forwardSnap` inside
 *   `addWorkingHours`, just like the same-calendar case).
 *
 * When `from.hoursPerDay === to.hoursPerDay`, this formula is an identity
 * regardless of `id` — no special-casing needed.
 *
 * The result is not itself re-snapped to a working day in `to`'s calendar;
 * the caller (`addWorkingHours`) does that via `forwardSnap`/`backwardSnap`.
 */
export function convertInstant(from: Calendar, to: Calendar, date: Date): Date {
  if (from.id === to.id) return date;

  const { day, msOfDay } = toDayTime(date);
  const fromWindow = from.hoursPerDay * MS_PER_HOUR;
  const toWindow = to.hoursPerDay * MS_PER_HOUR;
  const convertedMsOfDay =
    msOfDay >= fromWindow ? toWindow : Math.round(msOfDay * (toWindow / fromWindow));

  return fromDayTime({ day, msOfDay: convertedMsOfDay });
}
