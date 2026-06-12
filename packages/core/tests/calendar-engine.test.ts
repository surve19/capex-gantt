import { describe, expect, it } from 'vitest';
import {
  addWorkingHours,
  convertInstant,
  createDefaultCalendar,
  diffWorkingHours,
  isWorkingDay,
  resolveEffectiveCalendar,
  toISODateString,
} from '../src/index.js';

// 2024-01-01 is a Monday; 2024-01-06/07 is the following Sat/Sun.
const monday = new Date(2024, 0, 1);
const wednesdayAt8 = new Date(2024, 0, 3, 8, 0, 0);
const wednesdayAt4 = new Date(2024, 0, 3, 4, 0, 0);
const thursday = new Date(2024, 0, 4);
const friday = new Date(2024, 0, 5);
const fridayAt8 = new Date(2024, 0, 5, 8, 0, 0);
const saturday = new Date(2024, 0, 6);
const sunday = new Date(2024, 0, 7);
const nextMonday = new Date(2024, 0, 8);
const nextTuesdayAt8 = new Date(2024, 0, 9, 8, 0, 0);

describe('calendar engine', () => {
  const calendar = createDefaultCalendar('default'); // hoursPerDay: 8, Mon-Fri

  describe('isWorkingDay', () => {
    it('treats Mon-Fri as working and Sat/Sun as non-working', () => {
      expect(isWorkingDay(calendar, monday)).toBe(true);
      expect(isWorkingDay(calendar, friday)).toBe(true);
      expect(isWorkingDay(calendar, saturday)).toBe(false);
      expect(isWorkingDay(calendar, sunday)).toBe(false);
    });

    it('a holiday exception overrides a normally working day', () => {
      const withHoliday = {
        ...calendar,
        exceptions: [{ date: toISODateString(monday), isWorking: false }],
      };
      expect(isWorkingDay(withHoliday, monday)).toBe(false);
    });

    it('a working-day exception overrides a normally non-working day', () => {
      const withOverride = {
        ...calendar,
        exceptions: [{ date: toISODateString(saturday), isWorking: true }],
      };
      expect(isWorkingDay(withOverride, saturday)).toBe(true);
    });
  });

  describe('addWorkingHours', () => {
    it('consuming a full working day (24h) lands on the next day at the window end', () => {
      // Mon 00:00 + 24h = Mon(8h) + Tue(8h) + Wed(8h) -> Wed 08:00.
      const result = addWorkingHours(calendar, monday, 24);
      expect(result.getTime()).toBe(wednesdayAt8.getTime());
    });

    it('a zero-lag FS successor rolls a window-end instant to the next working day at 00:00', () => {
      const result = addWorkingHours(calendar, wednesdayAt8, 0);
      expect(result.getTime()).toBe(thursday.getTime());
    });

    it('a sub-day duration stays within the same day', () => {
      const result = addWorkingHours(calendar, monday, 4);
      expect(result.getTime()).toBe(new Date(2024, 0, 1, 4, 0, 0).getTime());
    });

    it('a zero-lag FS successor of a sub-day predecessor starts the same afternoon', () => {
      const mondayAt4 = new Date(2024, 0, 1, 4, 0, 0);
      const result = addWorkingHours(calendar, mondayAt4, 0);
      expect(result.getTime()).toBe(mondayAt4.getTime());
    });

    it('rolls forward over a weekend and a holiday exception', () => {
      const withHoliday = {
        ...calendar,
        exceptions: [{ date: toISODateString(nextMonday), isWorking: false }],
      };
      // Fri 08:00 (window end) + 8h working hours skips Sat/Sun/holiday Mon -> Tue 08:00.
      const result = addWorkingHours(withHoliday, fridayAt8, 8);
      expect(result.getTime()).toBe(nextTuesdayAt8.getTime());
    });

    it('a negative offset (lead/overlap) consumes working hours backward within the day', () => {
      const result = addWorkingHours(calendar, wednesdayAt8, -4);
      expect(result.getTime()).toBe(wednesdayAt4.getTime());
    });
  });

  describe('diffWorkingHours', () => {
    it('counts working hours between two day-aligned instants', () => {
      expect(diffWorkingHours(calendar, monday, thursday)).toBe(24);
      expect(diffWorkingHours(calendar, thursday, monday)).toBe(-24);
      expect(diffWorkingHours(calendar, monday, monday)).toBe(0);
    });
  });

  describe('resolveEffectiveCalendar', () => {
    it('returns an equivalent calendar when there is no inheritsFrom', () => {
      const resolved = resolveEffectiveCalendar([calendar], 'default');
      expect(resolved.id).toBe(calendar.id);
      expect(resolved.name).toBe(calendar.name);
      expect(resolved.workingDays).toEqual(calendar.workingDays);
      expect(resolved.hoursPerDay).toBe(calendar.hoursPerDay);
      expect(resolved.exceptions).toEqual(calendar.exceptions);
      expect(resolved.inheritsFrom).toBeUndefined();
    });

    it('merges parent and child exceptions, with the child winning on date conflicts', () => {
      const parent = {
        ...createDefaultCalendar('parent'),
        exceptions: [
          { date: '2024-01-01', isWorking: false }, // holiday from parent
          { date: '2024-01-08', isWorking: false }, // another parent-only holiday
        ],
      };
      const child = {
        ...createDefaultCalendar('child', 'Child'),
        inheritsFrom: 'parent',
        exceptions: [
          { date: '2024-01-01', isWorking: true }, // child overrides parent's holiday
          { date: '2024-01-15', isWorking: false }, // child-only holiday
        ],
      };

      const resolved = resolveEffectiveCalendar([parent, child], 'child');

      expect(resolved.id).toBe('child');
      expect(resolved.name).toBe('Child');
      expect(resolved.workingDays).toEqual(child.workingDays);
      expect(resolved.hoursPerDay).toBe(child.hoursPerDay);
      expect(resolved.inheritsFrom).toBeUndefined();

      const byDate = new Map(resolved.exceptions.map((e) => [e.date, e.isWorking]));
      expect(byDate.get('2024-01-01')).toBe(true); // child wins
      expect(byDate.get('2024-01-08')).toBe(false); // inherited from parent
      expect(byDate.get('2024-01-15')).toBe(false); // child-only
      expect(resolved.exceptions).toHaveLength(3);
    });

    it('throws when the parent itself has inheritsFrom set (two-level chain)', () => {
      const grandparent = createDefaultCalendar('grandparent');
      const parent = { ...createDefaultCalendar('parent'), inheritsFrom: 'grandparent' };
      const child = { ...createDefaultCalendar('child'), inheritsFrom: 'parent' };

      expect(() => resolveEffectiveCalendar([grandparent, parent, child], 'child')).toThrow(
        /cannot be used as a parent because it itself inherits/,
      );
    });

    it('throws when inheritsFrom references a missing parent', () => {
      const child = { ...createDefaultCalendar('child'), inheritsFrom: 'missing-parent' };

      expect(() => resolveEffectiveCalendar([child], 'child')).toThrow(
        /inherits from unknown calendar "missing-parent"/,
      );
    });

    it('throws when the requested calendar id does not exist', () => {
      expect(() => resolveEffectiveCalendar([calendar], 'does-not-exist')).toThrow(
        /Calendar "does-not-exist" not found/,
      );
    });
  });

  describe('convertInstant', () => {
    it('returns the date unchanged when from.id === to.id', () => {
      const date = new Date(2024, 0, 3, 4, 0, 0);
      const result = convertInstant(calendar, calendar, date);
      expect(result.getTime()).toBe(date.getTime());
    });

    it('converts a window-end instant from an 8h calendar to the window end of a 24h calendar', () => {
      const eightHour = createDefaultCalendar('eight', '8h');
      const twentyFourHour = { ...createDefaultCalendar('full', '24h'), hoursPerDay: 24 };

      const result = convertInstant(eightHour, twentyFourHour, wednesdayAt8);
      expect(result.getTime()).toBe(new Date(2024, 0, 3, 24, 0, 0).getTime());
    });

    it('converts a window-end instant from a 24h calendar to the window end of an 8h calendar', () => {
      const eightHour = createDefaultCalendar('eight', '8h');
      const twentyFourHour = { ...createDefaultCalendar('full', '24h'), hoursPerDay: 24 };

      // A 24h calendar's working window is [00:00, 24:00) i.e. the whole day, so the
      // only representable "window end" instant for a given day is 00:00 of the next
      // day, which decomposes (via toDayTime) to msOfDay === 0 of that next day —
      // below fromWindow (24h) and thus scaled via the Math.round branch. Confirm a
      // day-start instant (msOfDay === 0, the degenerate "window end" of the previous
      // day) maps to the day-start (msOfDay === 0, window end / start) of the target
      // 8h calendar.
      const dayStart24 = thursday; // 2024-01-04T00:00:00, msOfDay === 0
      const result = convertInstant(twentyFourHour, eightHour, dayStart24);
      expect(result.getTime()).toBe(thursday.getTime());
    });

    it('scales a sub-day instant proportionally: 4h of an 8h day -> 12h of a 24h day', () => {
      const eightHour = createDefaultCalendar('eight', '8h');
      const twentyFourHour = { ...createDefaultCalendar('full', '24h'), hoursPerDay: 24 };

      const result = convertInstant(eightHour, twentyFourHour, wednesdayAt4);
      expect(result.getTime()).toBe(new Date(2024, 0, 3, 12, 0, 0).getTime());
    });

    it('scales a sub-day instant proportionally: 12h of a 24h day -> 4h of an 8h day', () => {
      const eightHour = createDefaultCalendar('eight', '8h');
      const twentyFourHour = { ...createDefaultCalendar('full', '24h'), hoursPerDay: 24 };

      const twelveHours = new Date(2024, 0, 3, 12, 0, 0);
      const result = convertInstant(twentyFourHour, eightHour, twelveHours);
      expect(result.getTime()).toBe(wednesdayAt4.getTime());
    });

    it('is an identity when hoursPerDay matches even with different ids', () => {
      const calendarA = createDefaultCalendar('cal-a', 'A');
      const calendarB = createDefaultCalendar('cal-b', 'B');

      const result = convertInstant(calendarA, calendarB, wednesdayAt4);
      expect(result.getTime()).toBe(wednesdayAt4.getTime());
    });
  });
});
