import type { Task } from '../types.js';

export interface CriticalPathResult {
  /** Ids of tasks where `isCritical === true`, in task order. */
  criticalTaskIds: string[];
}

/**
 * Sets `task.isCritical` for each task based on its `totalFloatHours`
 * (a task is critical when it has zero total float) and returns the ids of
 * the critical tasks.
 */
export function deriveCriticalPath(tasks: Task[]): CriticalPathResult {
  const criticalTaskIds: string[] = [];

  for (const task of tasks) {
    const isCritical = (task.totalFloatHours ?? 0) === 0;
    task.isCritical = isCritical;
    if (isCritical) criticalTaskIds.push(task.id);
  }

  return { criticalTaskIds };
}
