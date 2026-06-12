import type { Calendar } from '../types.js';

/** Creates a standard Monday-Friday working calendar with no exceptions. */
export function createDefaultCalendar(id: string, name = 'Standard (Mon-Fri)'): Calendar {
  return {
    id,
    name,
    // Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday
    workingDays: [false, true, true, true, true, true, false],
    exceptions: [],
    hoursPerDay: 8,
  };
}
