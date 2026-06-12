import { describe, expect, it } from 'vitest';
import type { Task } from '../src/index.js';
import { createProject, toISODateString } from '../src/index.js';

// 2024-01-01 is a Monday.
const START_DATE = new Date(2024, 0, 1);

function dateOf(
  task: Task,
  field: 'start' | 'end' | 'earlyStart' | 'earlyFinish' | 'lateStart' | 'lateFinish',
) {
  const value = task[field];
  return value ? toISODateString(value) : undefined;
}

describe('CPM forward/backward pass', () => {
  it('computes early/late dates, total float, and critical path for a small network', () => {
    // A(24h) -> B(16h) \
    //         \           -> D(16h)
    //           -> C(40h) /
    const project = createProject({
      id: 'p1',
      name: 'Sample Project',
      startDate: START_DATE,
      tasks: [
        { id: 'A', name: 'A', durationHours: 24 },
        { id: 'B', name: 'B', durationHours: 16 },
        { id: 'C', name: 'C', durationHours: 40 },
        { id: 'D', name: 'D', durationHours: 16 },
      ],
      dependencies: [
        { id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS' },
        { id: 'd2', predecessorId: 'A', successorId: 'C', type: 'FS' },
        { id: 'd3', predecessorId: 'B', successorId: 'D', type: 'FS' },
        { id: 'd4', predecessorId: 'C', successorId: 'D', type: 'FS' },
      ],
    });

    const result = project.schedule();
    const byId = new Map(result.tasks.map((t) => [t.id, t]));

    const a = byId.get('A') as Task;
    expect(dateOf(a, 'start')).toBe('2024-01-01');
    expect(dateOf(a, 'end')).toBe('2024-01-03');
    expect(a.totalFloatHours).toBe(0);
    expect(a.isCritical).toBe(true);

    const b = byId.get('B') as Task;
    expect(dateOf(b, 'start')).toBe('2024-01-04');
    expect(dateOf(b, 'end')).toBe('2024-01-05');
    expect(b.totalFloatHours).toBe(24);
    expect(b.isCritical).toBe(false);

    const c = byId.get('C') as Task;
    expect(dateOf(c, 'start')).toBe('2024-01-04');
    expect(dateOf(c, 'end')).toBe('2024-01-10');
    expect(c.totalFloatHours).toBe(0);
    expect(c.isCritical).toBe(true);

    const d = byId.get('D') as Task;
    expect(dateOf(d, 'start')).toBe('2024-01-11');
    expect(dateOf(d, 'end')).toBe('2024-01-12');
    expect(d.totalFloatHours).toBe(0);
    expect(d.isCritical).toBe(true);

    expect(toISODateString(result.projectFinish)).toBe('2024-01-12');
    expect(result.criticalTaskIds).toEqual(['A', 'C', 'D']);
  });

  it('applies positive lag on a finish-to-start dependency', () => {
    // A(16h) -[FS, lag=16h]-> B(8h)
    const project = createProject({
      id: 'p2',
      name: 'Lag Project',
      startDate: START_DATE,
      tasks: [
        { id: 'A', name: 'A', durationHours: 16 },
        { id: 'B', name: 'B', durationHours: 8 },
      ],
      dependencies: [{ id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS', lagHours: 16 }],
    });

    const result = project.schedule();
    const byId = new Map(result.tasks.map((t) => [t.id, t]));

    const a = byId.get('A') as Task;
    const b = byId.get('B') as Task;

    // A: Mon-Tue (16h). EF(A) = Tue 08:00.
    expect(dateOf(a, 'end')).toBe('2024-01-02');
    // B starts 16 working hours after A finishes: Tue08:00 -> Wed00:00 -> +16h -> Thu08:00.
    expect(dateOf(b, 'start')).toBe('2024-01-04');
    // B's 8h duration: Thu08:00 -> Fri08:00.
    expect(dateOf(b, 'end')).toBe('2024-01-05');

    // Two-task chain with no other successors: lag is fully absorbed, both critical.
    expect(a.isCritical).toBe(true);
    expect(b.isCritical).toBe(true);
  });

  it('treats a zero-duration task as a milestone (start === end)', () => {
    const project = createProject({
      id: 'p3',
      name: 'Milestone Project',
      startDate: START_DATE,
      tasks: [
        { id: 'A', name: 'A', durationHours: 24 },
        { id: 'M', name: 'Milestone', durationHours: 0 },
      ],
      dependencies: [{ id: 'd1', predecessorId: 'A', successorId: 'M', type: 'FS' }],
    });

    const result = project.schedule();
    const milestone = result.tasks.find((t) => t.id === 'M') as Task;

    expect(dateOf(milestone, 'start')).toBe(dateOf(milestone, 'end'));
    expect(milestone.isCritical).toBe(true);
  });

  it('chains sub-day tasks within the same working day', () => {
    // A(4h) -> B(4h), both starting Monday: B starts the same afternoon A finishes.
    const project = createProject({
      id: 'p4',
      name: 'Sub-day Project',
      startDate: START_DATE,
      tasks: [
        { id: 'A', name: 'A', durationHours: 4 },
        { id: 'B', name: 'B', durationHours: 4 },
      ],
      dependencies: [{ id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS' }],
    });

    const result = project.schedule();
    const byId = new Map(result.tasks.map((t) => [t.id, t]));

    const a = byId.get('A') as Task;
    const b = byId.get('B') as Task;

    const mon00 = new Date(2024, 0, 1, 0, 0, 0);
    const mon04 = new Date(2024, 0, 1, 4, 0, 0);
    const mon08 = new Date(2024, 0, 1, 8, 0, 0);

    expect(a.earlyStart?.getTime()).toBe(mon00.getTime());
    expect(a.earlyFinish?.getTime()).toBe(mon04.getTime());
    expect(b.earlyStart?.getTime()).toBe(mon04.getTime());
    expect(b.earlyFinish?.getTime()).toBe(mon08.getTime());

    expect(a.totalFloatHours).toBe(0);
    expect(b.totalFloatHours).toBe(0);
    expect(a.isCritical).toBe(true);
    expect(b.isCritical).toBe(true);
  });
});
