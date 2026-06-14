import { resolveEffectiveCalendar } from './calendar/calendar-engine.js';
import { createDefaultCalendar } from './calendar/default-calendars.js';
import { runCpm } from './scheduling/cpm.js';
import { deriveCriticalPath } from './scheduling/critical-path.js';
import { deriveWbsHierarchy } from './scheduling/hierarchy.js';
import { deriveVariance } from './scheduling/variance.js';
import type {
  Calendar,
  ConstraintType,
  CreateProjectInput,
  Dependency,
  Project,
  ProjectInstance,
  ScheduleResult,
  Task,
} from './types.js';
import { toDate } from './utils/date.js';

const DEFAULT_CALENDAR_ID = 'default';

/** Throws if `calendar.hoursPerDay` is out of range, mirroring `createProject`'s message. */
function validateHoursPerDay(calendar: Calendar): void {
  if (!(calendar.hoursPerDay > 0 && calendar.hoursPerDay <= 24)) {
    throw new Error(`Calendar "${calendar.id}" has an invalid hoursPerDay (must be > 0 and <= 24)`);
  }
}

/**
 * Validates a calendar's `inheritsFrom` reference (if set) against the rest
 * of `calendars`: the parent must exist and must not itself have
 * `inheritsFrom` set (multi-level chains not supported).
 */
function validateInheritsFrom(calendars: Calendar[], calendar: Calendar): void {
  if (!calendar.inheritsFrom) return;

  const parentId = calendar.inheritsFrom;
  const parent = calendars.find((c) => c.id === parentId);
  if (!parent) {
    throw new Error(`Calendar "${calendar.id}" inherits from unknown calendar "${parentId}"`);
  }
  if (parent.inheritsFrom) {
    throw new Error(
      `Calendar "${parentId}" cannot be used as a parent because it itself inherits from another calendar (multi-level chains not supported)`,
    );
  }
}

/** Runs the same validation `createProject` runs for a single calendar (used by add/update). */
function validateCalendar(calendars: Calendar[], calendar: Calendar): void {
  validateHoursPerDay(calendar);
  validateInheritsFrom(calendars, calendar);
}

const CONSTRAINT_TYPES: ReadonlySet<ConstraintType> = new Set<ConstraintType>([
  'ASAP',
  'ALAP',
  'MSO',
  'MFO',
  'SNET',
  'SNLT',
  'FNET',
  'FNLT',
]);

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

    if (task.calendarId !== undefined && !calendars.some((c) => c.id === task.calendarId)) {
      throw new Error(`Task "${task.id}" references unknown calendar "${task.calendarId}"`);
    }

    if (task.constraint) {
      const { type, date } = task.constraint;
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new Error(`Task "${task.id}" has an invalid constraint.date`);
      }
      if (!CONSTRAINT_TYPES.has(type)) {
        throw new Error(`Task "${task.id}" has an unknown constraint.type "${String(type)}"`);
      }
    }

    if (task.parentId !== undefined && task.parentId !== null) {
      if (task.parentId === task.id) {
        throw new Error(`Task "${task.id}" cannot be its own parent`);
      }
      if (!tasks.some((t) => t.id === task.parentId)) {
        throw new Error(`Task "${task.id}" references unknown parent task "${task.parentId}"`);
      }
    }
  }

  // Detect cyclic parentId chains (e.g. A -> B -> A). Walking each task's
  // chain individually is O(n x depth), fine for typical WBS tree sizes.
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  for (const task of tasks) {
    const visited = new Set<string>([task.id]);
    let current = task.parentId;
    while (current !== undefined && current !== null) {
      if (visited.has(current)) {
        throw new Error(`Task "${task.id}" has a cyclic parentId chain`);
      }
      visited.add(current);
      current = taskById.get(current)?.parentId;
    }
  }

  for (const calendar of calendars) {
    validateHoursPerDay(calendar);
  }

  // Resolving every calendar's `inheritsFrom` chain at creation time surfaces
  // cycle/missing-parent errors immediately rather than deferring to schedule().
  for (const calendar of calendars) {
    resolveEffectiveCalendar(calendars, calendar.id);
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
      deriveWbsHierarchy(scheduledTasks, project.calendars, project.defaultCalendarId);
      deriveVariance(scheduledTasks, project.calendars, project.defaultCalendarId);
      return { tasks: scheduledTasks, projectFinish, criticalTaskIds };
    },
    addCalendar: (calendar: Calendar): void => {
      validateCalendar(project.calendars, calendar);
      project.calendars.push(calendar);
    },
    updateCalendar: (id: string, patch: Partial<Calendar>): void => {
      const existing = project.calendars.find((c) => c.id === id);
      if (!existing) {
        throw new Error(`Calendar "${id}" not found`);
      }

      const updated: Calendar = { ...existing, ...patch };
      const others = project.calendars.filter((c) => c.id !== id);
      validateCalendar([...others, updated], updated);

      Object.assign(existing, updated);
    },
    removeCalendar: (id: string): void => {
      if (id === project.defaultCalendarId) {
        throw new Error(`Cannot remove the default calendar "${id}"`);
      }

      const referencingTask = project.tasks.find((t) => t.calendarId === id);
      if (referencingTask) {
        throw new Error(
          `Cannot remove calendar "${id}": still referenced by task "${referencingTask.id}"`,
        );
      }

      const dependentCalendar = project.calendars.find((c) => c.inheritsFrom === id);
      if (dependentCalendar) {
        throw new Error(
          `Cannot remove calendar "${id}": calendar "${dependentCalendar.id}" inherits from it`,
        );
      }

      const index = project.calendars.findIndex((c) => c.id === id);
      if (index === -1) {
        throw new Error(`Calendar "${id}" not found`);
      }
      project.calendars.splice(index, 1);
    },
    setBaseline: (taskIds?: string[]): void => {
      for (const task of resolveTasks(project.tasks, taskIds)) {
        if (!task.start || !task.end) {
          throw new Error(
            `Task "${task.id}" has no computed start/end — call schedule() before setBaseline()`,
          );
        }
        task.baseline = { start: task.start, finish: task.end, durationHours: task.durationHours };
      }
    },
    clearBaseline: (taskIds?: string[]): void => {
      for (const task of resolveTasks(project.tasks, taskIds)) {
        delete task.baseline;
        delete task.startVarianceHours;
        delete task.finishVarianceHours;
      }
    },
  };
}

/** Returns the tasks matching `taskIds`, or all of `tasks` if `taskIds` is omitted. Throws if any id is unknown. */
function resolveTasks(tasks: Task[], taskIds?: string[]): Task[] {
  if (!taskIds) return tasks;
  return taskIds.map((id) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      throw new Error(`Task "${id}" not found`);
    }
    return task;
  });
}
