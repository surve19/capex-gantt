import { addWorkingHours, diffWorkingHours } from '../calendar/calendar-engine.js';
import type { Calendar, Project, Task } from '../types.js';
import { maxDate, minDate } from '../utils/date.js';
import { buildGraph } from './graph.js';

export interface CpmResult {
  tasks: Task[];
  projectFinish: Date;
}

/**
 * Runs a calendar-aware CPM forward and backward pass over `project`.
 *
 * Conventions:
 * - All scheduling math operates in working hours (see calendar-engine.ts).
 *   A finish-to-start dependency with `lagHours` L means the successor's
 *   earliest start is `addWorkingHours(calendar, predecessorFinish, L)`: with
 *   L === 0, the successor starts at the exact instant the predecessor
 *   finishes (which may be mid-day for sub-day tasks); positive L adds
 *   working-hour lag, negative L is lead/overlap.
 * - `totalFloatHours` is the number of working hours between a task's early
 *   and late start.
 *
 * Mutates and returns the tasks on `project` with computed schedule fields.
 */
export function runCpm(project: Project): CpmResult {
  const { tasks, dependencies, calendars, defaultCalendarId, startDate } = project;

  const calendarById = new Map(calendars.map((c) => [c.id, c]));
  const resolveCalendar = (task: Task): Calendar => {
    const id = task.calendarId ?? defaultCalendarId;
    const calendar = calendarById.get(id);
    if (!calendar) {
      throw new Error(`Task "${task.id}" references unknown calendar "${id}"`);
    }
    return calendar;
  };

  for (const dependency of dependencies) {
    if (dependency.type !== 'FS') {
      throw new Error(
        `Dependency "${dependency.id}" has unsupported type "${dependency.type}". Phase 1 only supports "FS" dependencies.`,
      );
    }
  }

  const { predecessors, successors, topoOrder } = buildGraph(tasks, dependencies);
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  const defaultCalendar = calendarById.get(defaultCalendarId);
  if (!defaultCalendar) {
    throw new Error(
      `Project "${project.id}" references unknown defaultCalendarId "${defaultCalendarId}"`,
    );
  }
  const projectStart = addWorkingHours(defaultCalendar, startDate, 0);

  // Forward pass: earliest a task can start/finish given its predecessors.
  for (const id of topoOrder) {
    const task = taskById.get(id);
    if (!task) continue;
    const calendar = resolveCalendar(task);
    const preds = predecessors.get(id) ?? [];

    let earlyStart = projectStart;
    for (const { dependency, task: predecessorTask } of preds) {
      const lag = dependency.lagHours ?? 0;
      const predecessorFinish = predecessorTask.earlyFinish;
      if (!predecessorFinish) continue;
      const candidate = addWorkingHours(calendar, predecessorFinish, lag);
      earlyStart = maxDate(earlyStart, candidate);
    }

    const earlyFinish =
      task.durationHours <= 0
        ? earlyStart
        : addWorkingHours(calendar, earlyStart, task.durationHours);

    task.earlyStart = earlyStart;
    task.earlyFinish = earlyFinish;
    task.start = earlyStart;
    task.end = earlyFinish;
  }

  const projectFinish = tasks.reduce(
    (latest, task) => (task.earlyFinish ? maxDate(latest, task.earlyFinish) : latest),
    projectStart,
  );

  // Backward pass: latest a task can start/finish without delaying the project finish.
  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const id = topoOrder[i];
    if (id === undefined) continue;
    const task = taskById.get(id);
    if (!task) continue;
    const calendar = resolveCalendar(task);
    const succs = successors.get(id) ?? [];

    let lateFinish = projectFinish;
    for (const { dependency, task: successorTask } of succs) {
      const lag = dependency.lagHours ?? 0;
      const successorStart = successorTask.lateStart;
      if (!successorStart) continue;
      const candidate = addWorkingHours(calendar, successorStart, -lag);
      lateFinish = minDate(lateFinish, candidate);
    }

    const lateStart =
      task.durationHours <= 0
        ? lateFinish
        : addWorkingHours(calendar, lateFinish, -task.durationHours);

    task.lateStart = lateStart;
    task.lateFinish = lateFinish;
    task.totalFloatHours = task.earlyStart
      ? diffWorkingHours(calendar, task.earlyStart, lateStart)
      : 0;
  }

  return { tasks, projectFinish };
}
