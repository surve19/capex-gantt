import type { Dependency, Task } from '../types.js';

export interface GraphEdge {
  dependency: Dependency;
  task: Task;
}

export interface DependencyGraph {
  /** For each task id, the edges (dependency + predecessor task) feeding into it. */
  predecessors: Map<string, GraphEdge[]>;
  /** For each task id, the edges (dependency + successor task) leading out of it. */
  successors: Map<string, GraphEdge[]>;
  /** Task ids in topological order (predecessors before successors). */
  topoOrder: string[];
}

/**
 * Builds predecessor/successor adjacency maps from `dependencies` and computes
 * a topological order via Kahn's algorithm. Throws if a dependency references
 * an unknown task, or if the graph contains a cycle.
 */
export function buildGraph(tasks: Task[], dependencies: Dependency[]): DependencyGraph {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const predecessors = new Map<string, GraphEdge[]>();
  const successors = new Map<string, GraphEdge[]>();

  for (const task of tasks) {
    predecessors.set(task.id, []);
    successors.set(task.id, []);
  }

  for (const dependency of dependencies) {
    const predecessorTask = taskById.get(dependency.predecessorId);
    const successorTask = taskById.get(dependency.successorId);

    if (!predecessorTask) {
      throw new Error(
        `Dependency "${dependency.id}" references unknown predecessor task "${dependency.predecessorId}"`,
      );
    }
    if (!successorTask) {
      throw new Error(
        `Dependency "${dependency.id}" references unknown successor task "${dependency.successorId}"`,
      );
    }

    predecessors.get(dependency.successorId)?.push({ dependency, task: predecessorTask });
    successors.get(dependency.predecessorId)?.push({ dependency, task: successorTask });
  }

  const inDegree = new Map<string, number>();
  for (const task of tasks) {
    inDegree.set(task.id, predecessors.get(task.id)?.length ?? 0);
  }

  const queue = tasks.filter((task) => inDegree.get(task.id) === 0).map((task) => task.id);
  const topoOrder: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;
    topoOrder.push(id);

    for (const { task: successorTask } of successors.get(id) ?? []) {
      const remaining = (inDegree.get(successorTask.id) ?? 0) - 1;
      inDegree.set(successorTask.id, remaining);
      if (remaining === 0) queue.push(successorTask.id);
    }
  }

  if (topoOrder.length !== tasks.length) {
    const visited = new Set(topoOrder);
    const cyclic = tasks.map((t) => t.id).filter((id) => !visited.has(id));
    throw new Error(`Dependency graph contains a cycle involving tasks: ${cyclic.join(', ')}`);
  }

  return { predecessors, successors, topoOrder };
}
