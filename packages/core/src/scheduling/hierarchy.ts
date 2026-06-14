import { diffWorkingHours, resolveEffectiveCalendar } from '../calendar/calendar-engine.js';
import type { Calendar, Task } from '../types.js';
import { maxDate, minDate } from '../utils/date.js';

export interface WbsHierarchyResult {
  /** Ids of tasks where `isSummary === true`, in task order. */
  summaryTaskIds: string[];
}

/**
 * Assigns `task.wbs` (positional auto-numbering, respecting manual overrides)
 * and `task.isSummary` (true if any other task has `parentId === this.id`),
 * then rolls up summary tasks' `start`/`end`/`isCritical`/`durationHours` from
 * their children's current `start`/`end`/`isCritical`.
 *
 * Must run after `deriveCriticalPath` (so children's `isCritical` is final)
 * and before `deriveVariance` (so variance is computed against the rolled-up
 * summary dates too).
 */
export function deriveWbsHierarchy(
  tasks: Task[],
  calendars: Calendar[],
  defaultCalendarId: string,
): WbsHierarchyResult {
  const childrenByParentId = new Map<string | undefined, Task[]>();
  for (const task of tasks) {
    const key = task.parentId ?? undefined;
    let children = childrenByParentId.get(key);
    if (!children) {
      children = [];
      childrenByParentId.set(key, children);
    }
    children.push(task);
  }

  const summaryTaskIds: string[] = [];
  for (const task of tasks) {
    const isSummary = (childrenByParentId.get(task.id)?.length ?? 0) > 0;
    task.isSummary = isSummary;
    if (isSummary) summaryTaskIds.push(task.id);
  }

  // Positional auto-numbering: each task's index among siblings sharing the
  // same parentId, prefixed with the parent's wbs. A manually-set `wbs` is
  // preserved and still used as the prefix for its own children.
  const assignWbs = (parentId: string | undefined, parentWbs: string | undefined): void => {
    const children = childrenByParentId.get(parentId) ?? [];
    children.forEach((task, index) => {
      if (!task.wbs) {
        task.wbs = parentWbs ? `${parentWbs}.${index + 1}` : `${index + 1}`;
      }
      assignWbs(task.id, task.wbs);
    });
  };
  assignWbs(undefined, undefined);

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

  // Post-order DFS so nested summaries roll up bottom-up: a parent's rollup
  // sees its children's already-rolled-up start/end/isCritical.
  const rollUp = (parentId: string | undefined): void => {
    const children = childrenByParentId.get(parentId) ?? [];
    for (const task of children) {
      rollUp(task.id);
      if (!task.isSummary) continue;

      const taskChildren = childrenByParentId.get(task.id) ?? [];
      const childStarts = taskChildren.map((c) => c.start).filter((d): d is Date => !!d);
      const childEnds = taskChildren.map((c) => c.end).filter((d): d is Date => !!d);
      if (childStarts.length > 0) task.start = childStarts.reduce(minDate);
      if (childEnds.length > 0) task.end = childEnds.reduce(maxDate);
      task.isCritical = taskChildren.some((c) => c.isCritical === true);
      if (task.start && task.end) {
        const calendar = resolveCalendar(task);
        task.durationHours = diffWorkingHours(calendar, task.start, task.end);
      }
    }
  };
  rollUp(undefined);

  return { summaryTaskIds };
}
