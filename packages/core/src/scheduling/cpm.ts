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
    const durationHours = task.durationHours;
    const constraint = task.constraint;

    const candidates: Date[] = [projectStart];
    for (const { dependency, task: predecessorTask } of preds) {
      const lag = dependency.lagHours ?? 0;
      if (!predecessorTask.earlyFinish || !predecessorTask.earlyStart) continue;

      switch (dependency.type) {
        case 'FS':
          candidates.push(addWorkingHours(calendar, predecessorTask.earlyFinish, lag));
          break;
        case 'SS':
          candidates.push(addWorkingHours(calendar, predecessorTask.earlyStart, lag));
          break;
        case 'FF': {
          const finishCandidate = addWorkingHours(calendar, predecessorTask.earlyFinish, lag);
          candidates.push(
            durationHours <= 0
              ? finishCandidate
              : addWorkingHours(calendar, finishCandidate, -durationHours),
          );
          break;
        }
        case 'SF': {
          const finishCandidate = addWorkingHours(calendar, predecessorTask.earlyStart, lag);
          candidates.push(
            durationHours <= 0
              ? finishCandidate
              : addWorkingHours(calendar, finishCandidate, -durationHours),
          );
          break;
        }
      }
    }

    let earlyStart = candidates.reduce(maxDate);

    // Apply this task's own constraint (forward-pass side). FNET is handled
    // below after earlyFinish is computed; SNLT/FNLT/ALAP are handled in the
    // backward pass.
    if (constraint) {
      switch (constraint.type) {
        case 'SNET':
          earlyStart = maxDate(earlyStart, constraint.date);
          break;
        case 'MSO':
          earlyStart = constraint.date;
          break;
        case 'MFO':
          earlyStart =
            durationHours <= 0
              ? constraint.date
              : addWorkingHours(calendar, constraint.date, -durationHours);
          break;
        default:
          break;
      }
    }

    let earlyFinish =
      durationHours <= 0 ? earlyStart : addWorkingHours(calendar, earlyStart, durationHours);

    if (constraint?.type === 'FNET' && earlyFinish < constraint.date) {
      earlyFinish = constraint.date;
      earlyStart =
        durationHours <= 0 ? earlyFinish : addWorkingHours(calendar, earlyFinish, -durationHours);
    }

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
    const durationHours = task.durationHours;
    const constraint = task.constraint;

    const candidates: Date[] = [projectFinish];
    for (const { dependency, task: successorTask } of succs) {
      const lag = dependency.lagHours ?? 0;
      if (!successorTask.lateStart || !successorTask.lateFinish) continue;

      switch (dependency.type) {
        case 'FS':
          candidates.push(addWorkingHours(calendar, successorTask.lateStart, -lag));
          break;
        case 'FF':
          candidates.push(addWorkingHours(calendar, successorTask.lateFinish, -lag));
          break;
        case 'SS': {
          const startCandidate = addWorkingHours(calendar, successorTask.lateStart, -lag);
          candidates.push(
            durationHours <= 0
              ? startCandidate
              : addWorkingHours(calendar, startCandidate, durationHours),
          );
          break;
        }
        case 'SF': {
          const startCandidate = addWorkingHours(calendar, successorTask.lateFinish, -lag);
          candidates.push(
            durationHours <= 0
              ? startCandidate
              : addWorkingHours(calendar, startCandidate, durationHours),
          );
          break;
        }
      }
    }

    let lateFinish = candidates.reduce(minDate);

    // Apply this task's own constraint (backward-pass side). SNLT is handled
    // below after lateStart is computed.
    if (constraint) {
      switch (constraint.type) {
        case 'FNLT':
          lateFinish = minDate(lateFinish, constraint.date);
          break;
        case 'MFO':
          lateFinish = constraint.date;
          break;
        case 'MSO':
          lateFinish =
            durationHours <= 0
              ? constraint.date
              : addWorkingHours(calendar, constraint.date, durationHours);
          break;
        default:
          break;
      }
    }

    let lateStart =
      durationHours <= 0 ? lateFinish : addWorkingHours(calendar, lateFinish, -durationHours);

    if (constraint?.type === 'SNLT' && lateStart > constraint.date) {
      lateStart = constraint.date;
      lateFinish =
        durationHours <= 0 ? lateStart : addWorkingHours(calendar, lateStart, durationHours);
    }

    task.lateStart = lateStart;
    task.lateFinish = lateFinish;
    task.totalFloatHours = task.earlyStart
      ? diffWorkingHours(calendar, task.earlyStart, lateStart)
      : 0;
  }

  // ALAP: after both passes complete, override start/end with the late dates
  // for ALAP-constrained tasks. earlyStart/earlyFinish/totalFloatHours/isCritical
  // remain ASAP-based, so start/end intentionally diverge from
  // earlyStart/earlyFinish for ALAP tasks.
  for (const task of tasks) {
    if (task.constraint?.type === 'ALAP' && task.lateStart && task.lateFinish) {
      task.start = task.lateStart;
      task.end = task.lateFinish;
    }
  }

  return { tasks, projectFinish };
}
