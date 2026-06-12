import { describe, expect, it } from 'vitest';
import {
  addWorkingHours,
  createDefaultCalendar,
  diffWorkingHours,
  isWorkingDay,
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
});
