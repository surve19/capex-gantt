import { describe, expect, it } from 'vitest';
import type { Calendar, Task } from '../src/index.js';
import { createProject, toISODateString } from '../src/index.js';

// 2024-01-01 is a Monday.
const START_DATE = new Date(2024, 0, 1);

function dateOf(task: Task, field: 'start' | 'end') {
  const value = task[field];
  return value ? toISODateString(value) : undefined;
}

describe('baselines and variance', () => {
  // A(24h) -> B(16h) \
  //         \           -> D(16h)
  //           -> C(40h) /
  function buildProject() {
    return createProject({
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
  }

  it('setBaseline snapshots start/end/durationHours and variance is zero when unchanged', () => {
    const project = buildProject();
    project.schedule();
    project.setBaseline();

    const result = project.schedule();
    const byId = new Map(result.tasks.map((t) => [t.id, t]));

    for (const id of ['A', 'B', 'C', 'D']) {
      const task = byId.get(id) as Task;
      expect(task.baseline).toBeDefined();
      expect(toISODateString(task.baseline?.start as Date)).toBe(dateOf(task, 'start'));
      expect(toISODateString(task.baseline?.finish as Date)).toBe(dateOf(task, 'end'));
      expect(task.baseline?.durationHours).toBe(task.durationHours);
      expect(task.startVarianceHours).toBe(0);
      expect(task.finishVarianceHours).toBe(0);
    }
  });

  it('setBaseline(taskIds) only baselines the given tasks', () => {
    const project = buildProject();
    project.schedule();
    project.setBaseline(['A']);

    const result = project.schedule();
    const byId = new Map(result.tasks.map((t) => [t.id, t]));

    expect(byId.get('A')?.baseline).toBeDefined();
    expect(byId.get('B')?.baseline).toBeUndefined();
    expect(byId.get('B')?.startVarianceHours).toBeUndefined();
  });

  it('setBaseline before schedule() throws', () => {
    const project = buildProject();
    expect(() => project.setBaseline()).toThrow(/call schedule\(\)/);
  });

  it('setBaseline with an unknown task id throws', () => {
    const project = buildProject();
    project.schedule();
    expect(() => project.setBaseline(['does-not-exist'])).toThrow(/not found/);
  });

  it('clearBaseline removes baseline and variance fields', () => {
    const project = buildProject();
    project.schedule();
    project.setBaseline();
    project.clearBaseline();

    const result = project.schedule();
    const a = result.tasks.find((t) => t.id === 'A') as Task;
    expect(a.baseline).toBeUndefined();
    expect(a.startVarianceHours).toBeUndefined();
    expect(a.finishVarianceHours).toBeUndefined();
  });

  it('a duration increase after baseline produces finish variance without moving start', () => {
    const project = buildProject();
    project.schedule();
    project.setBaseline();

    // B has 24h of float; bumping its duration by 8h (1 working day) slips
    // its finish without affecting its start or the critical path.
    const taskB = project.getProject().tasks.find((t) => t.id === 'B') as Task;
    taskB.durationHours = 24;

    const result = project.schedule();
    const b = result.tasks.find((t) => t.id === 'B') as Task;

    expect(b.startVarianceHours).toBe(0);
    expect(b.finishVarianceHours).toBe(8);
    expect(b.isCritical).toBe(false);

    // D depends on the still-critical C, so it's unaffected by B's slip.
    const d = result.tasks.find((t) => t.id === 'D') as Task;
    expect(d.startVarianceHours).toBe(0);
    expect(d.finishVarianceHours).toBe(0);
  });

  it("computes variance using the task's own calendar", () => {
    const roundTheClock: Calendar = {
      id: '247',
      name: 'Round the clock',
      workingDays: [true, true, true, true, true, true, true],
      exceptions: [],
      hoursPerDay: 24,
    };
    const project = createProject({
      id: 'p2',
      name: 'Cross-calendar project',
      startDate: START_DATE,
      calendars: [
        {
          id: 'default',
          name: 'Default',
          workingDays: [false, true, true, true, true, true, false],
          exceptions: [],
          hoursPerDay: 8,
        },
        roundTheClock,
      ],
      defaultCalendarId: 'default',
      tasks: [{ id: 'E', name: 'E', durationHours: 48, calendarId: '247' }],
    });

    project.schedule();
    project.setBaseline();

    const taskE = project.getProject().tasks.find((t) => t.id === 'E') as Task;
    taskE.durationHours = 72;

    const result = project.schedule();
    const e = result.tasks.find((t) => t.id === 'E') as Task;

    // 24h added on a 24/7 calendar is exactly 24 working hours of slip.
    expect(e.startVarianceHours).toBe(0);
    expect(e.finishVarianceHours).toBe(24);
  });
});
