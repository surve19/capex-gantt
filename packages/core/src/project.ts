import { createDefaultCalendar } from './calendar/default-calendars.js';
import { runCpm } from './scheduling/cpm.js';
import { deriveCriticalPath } from './scheduling/critical-path.js';
import type {
  Calendar,
  CreateProjectInput,
  Dependency,
  Project,
  ProjectInstance,
  ScheduleResult,
  Task,
} from './types.js';
import { toDate } from './utils/date.js';

const DEFAULT_CALENDAR_ID = 'default';

/**
 * Creates a project instance from plain task/dependency/calendar data.
 *
 * If `calendars` is omitted, a single default Monday-Friday calendar is
 * created and used as the project's default calendar. Call `.schedule()` to
 * run the CPM forward/backward pass and compute dates, total float, and the
 * critical path.
 */
export function createProject(input: CreateProjectInput): ProjectInstance {
  const hasCustomCalendars = !!input.calendars && input.calendars.length > 0;

  const calendars: Calendar[] = hasCustomCalendars
    ? (input.calendars as Calendar[])
    : [createDefaultCalendar(DEFAULT_CALENDAR_ID)];

  const defaultCalendarId = hasCustomCalendars
    ? (input.defaultCalendarId ?? (calendars[0] as Calendar).id)
    : DEFAULT_CALENDAR_ID;

  if (!calendars.some((c) => c.id === defaultCalendarId)) {
    throw new Error(`defaultCalendarId "${defaultCalendarId}" does not match any calendar id`);
  }

  const tasks: Task[] = input.tasks.map((t) => ({ ...t }));
  const dependencies: Dependency[] = (input.dependencies ?? []).map((d) => ({ ...d }));

  const seenTaskIds = new Set<string>();
  for (const task of tasks) {
    if (seenTaskIds.has(task.id)) {
      throw new Error(`Duplicate task id "${task.id}"`);
    }
    seenTaskIds.add(task.id);

    if (task.durationHours < 0) {
      throw new Error(`Task "${task.id}" has a negative durationHours`);
    }
  }

  for (const calendar of calendars) {
    if (!(calendar.hoursPerDay > 0 && calendar.hoursPerDay <= 24)) {
      throw new Error(
        `Calendar "${calendar.id}" has an invalid hoursPerDay (must be > 0 and <= 24)`,
      );
    }
  }

  const project: Project = {
    id: input.id,
    name: input.name,
    startDate: toDate(input.startDate),
    defaultCalendarId,
    calendars,
    tasks,
    dependencies,
  };

  return {
    getProject: () => project,
    getTasks: () => project.tasks,
    schedule: (): ScheduleResult => {
      const { tasks: scheduledTasks, projectFinish } = runCpm(project);
      const { criticalTaskIds } = deriveCriticalPath(scheduledTasks);
      return { tasks: scheduledTasks, projectFinish, criticalTaskIds };
    },
  };
}
