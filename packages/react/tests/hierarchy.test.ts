import type { Task } from '@capex-gantt/core';
import { describe, expect, it } from 'vitest';
import { buildVisibleTasks } from '../src/hierarchy.js';

// Top
// ├─ Mid
// │  └─ Leaf
// └─ Sibling
function buildTasks(): Task[] {
  return [
    { id: 'Top', name: 'Top', durationHours: 0 },
    { id: 'Mid', name: 'Mid', durationHours: 0, parentId: 'Top' },
    { id: 'Leaf', name: 'Leaf', durationHours: 8, parentId: 'Mid' },
    { id: 'Sibling', name: 'Sibling', durationHours: 8, parentId: 'Top' },
  ];
}

describe('buildVisibleTasks', () => {
  it('assigns depth 0/1/2 for top-level/child/grandchild tasks', () => {
    const nodes = buildVisibleTasks(buildTasks(), new Set());
    const depthById = new Map(nodes.map((n) => [n.task.id, n.depth]));

    expect(depthById.get('Top')).toBe(0);
    expect(depthById.get('Mid')).toBe(1);
    expect(depthById.get('Leaf')).toBe(2);
    expect(depthById.get('Sibling')).toBe(1);
  });

  it('returns all tasks when collapsedIds is empty, preserving order', () => {
    const tasks = buildTasks();
    const nodes = buildVisibleTasks(tasks, new Set());

    expect(nodes.map((n) => n.task.id)).toEqual(['Top', 'Mid', 'Leaf', 'Sibling']);
  });

  it('collapsing a task hides its direct children but keeps the task itself visible', () => {
    const nodes = buildVisibleTasks(buildTasks(), new Set(['Mid']));
    const ids = nodes.map((n) => n.task.id);

    expect(ids).toContain('Mid');
    expect(ids).not.toContain('Leaf');
  });

  it('collapsing an ancestor hides grandchildren too', () => {
    const nodes = buildVisibleTasks(buildTasks(), new Set(['Top']));
    const ids = nodes.map((n) => n.task.id);

    expect(ids).toContain('Top');
    expect(ids).not.toContain('Mid');
    expect(ids).not.toContain('Leaf');
    expect(ids).not.toContain('Sibling');
  });
});
