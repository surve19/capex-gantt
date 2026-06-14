import { diffWorkingHours, resolveEffectiveCalendar } from '../calendar/calendar-engine.js';
import type { Calendar, Task } from '../types.js';

/**
 * For each task with a `baseline` and computed `start`/`end`, sets
 * `startVarianceHours`/`finishVarianceHours` to the signed working-hour
 * difference between the current schedule and the baseline snapshot
 * (positive = slipped later, negative = pulled earlier, 0 = on track).
 *
 * Tasks without a `baseline` (or without computed `start`/`end`) are left
 * untouched.
 */
export function deriveVariance(
  tasks: Task[],
  calendars: Calendar[],
  defaultCalendarId: string,
): void {
  const effectiveCalendarById = new Map<string, Calendar>();
  const resolveCalendar = (task: Task): Calendar => {
    const id = task.calendarId ?? defaultCalendarId;
    let calendar = effectiveCalendarById.get(id);
    if (!calendar) {
      calendar = resolveEffectiveCalendar(calendars, id);
      effectiveCalendarById.set(id, calendar);
    }
    return calendar;
  };

  for (const task of tasks) {
    if (!task.baseline || !task.start || !task.end) continue;
    const calendar = resolveCalendar(task);
    task.startVarianceHours = diffWorkingHours(calendar, task.baseline.start, task.start);
    task.finishVarianceHours = diffWorkingHours(calendar, task.baseline.finish, task.end);
  }
}
