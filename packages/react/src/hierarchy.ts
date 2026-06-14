import type { Task } from '@capex-gantt/core';

export interface TaskTreeNode {
  task: Task;
  /** Ancestor-chain length; top-level tasks have depth 0. */
  depth: number;
}

/**
 * Filters `tasks` down to the rows visible given `collapsedIds` (tasks whose
 * children should be hidden), and annotates each with its depth in the WBS
 * tree.
 *
 * Preserves the order of `tasks` — it does not reorder into DFS order. For a
 * tree to render with each parent immediately followed by its children, the
 * input `tasks` array itself must already be in that order (a data-authoring
 * concern; `deriveWbsHierarchy` does not reorder tasks).
 */
export function buildVisibleTasks(tasks: Task[], collapsedIds: Set<string>): TaskTreeNode[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const depthCache = new Map<string, number>();
  const hiddenCache = new Map<string, boolean>();

  const depthOf = (task: Task): number => {
    const cached = depthCache.get(task.id);
    if (cached !== undefined) return cached;

    const parent = task.parentId ? taskById.get(task.parentId) : undefined;
    const depth = parent ? depthOf(parent) + 1 : 0;
    depthCache.set(task.id, depth);
    return depth;
  };

  const isHidden = (task: Task): boolean => {
    const cached = hiddenCache.get(task.id);
    if (cached !== undefined) return cached;

    const parent = task.parentId ? taskById.get(task.parentId) : undefined;
    const hidden = !!parent && (collapsedIds.has(parent.id) || isHidden(parent));
    hiddenCache.set(task.id, hidden);
    return hidden;
  };

  return tasks.filter((task) => !isHidden(task)).map((task) => ({ task, depth: depthOf(task) }));
}
