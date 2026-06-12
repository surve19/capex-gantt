import type { Task } from '../types.js';

export interface CriticalPathResult {
  /** Ids of tasks where `isCritical === true`, in task order. */
  criticalTaskIds: string[];
}

/**
 * Sets `task.isCritical` for each task based on its `totalFloatHours`
 * (a task is critical when it has zero total float) and returns the ids of
 * the critical tasks.
 *
 * Also sets `task.isConstraintViolated`: true when `totalFloatHours < 0`
 * (an infeasible schedule), or when an `MSO`/`MFO` constraint's date doesn't
 * match the computed `earlyStart`/`earlyFinish`.
 */
export function deriveCriticalPath(tasks: Task[]): CriticalPathResult {
  const criticalTaskIds: string[] = [];

  for (const task of tasks) {
    const isCritical = (task.totalFloatHours ?? 0) === 0;
    task.isCritical = isCritical;
    if (isCritical) criticalTaskIds.push(task.id);

    const constraint = task.constraint;
    const isConstraintViolated =
      (task.totalFloatHours ?? 0) < 0 ||
      (constraint?.type === 'MSO' && task.earlyStart?.getTime() !== constraint.date.getTime()) ||
      (constraint?.type === 'MFO' && task.earlyFinish?.getTime() !== constraint.date.getTime());
    task.isConstraintViolated = isConstraintViolated;
  }

  return { criticalTaskIds };
}
