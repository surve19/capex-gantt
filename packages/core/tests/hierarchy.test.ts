import { describe, expect, it } from 'vitest';
import type { Task } from '../src/index.js';
import { createProject, toISODateString } from '../src/index.js';

// 2024-01-01 is a Monday.
const START_DATE = new Date(2024, 0, 1);

function dateOf(task: Task, field: 'start' | 'end') {
  const value = task[field];
  return value ? toISODateString(value) : undefined;
}

describe('WBS hierarchy validation (createProject)', () => {
  it('throws when parentId references an unknown task', () => {
    expect(() =>
      createProject({
        id: 'p',
        name: 'p',
        startDate: START_DATE,
        tasks: [{ id: 'A', name: 'A', durationHours: 8, parentId: 'missing' }],
      }),
    ).toThrow(/unknown parent task/);
  });

  it('throws when a task is its own parent', () => {
    expect(() =>
      createProject({
        id: 'p',
        name: 'p',
        startDate: START_DATE,
        tasks: [{ id: 'A', name: 'A', durationHours: 8, parentId: 'A' }],
      }),
    ).toThrow(/cannot be its own parent/);
  });

  it('throws on a 2-cycle (A.parentId = B, B.parentId = A)', () => {
    expect(() =>
      createProject({
        id: 'p',
        name: 'p',
        startDate: START_DATE,
        tasks: [
          { id: 'A', name: 'A', durationHours: 8, parentId: 'B' },
          { id: 'B', name: 'B', durationHours: 8, parentId: 'A' },
        ],
      }),
    ).toThrow(/cyclic parentId chain/);
  });

  it('throws on a longer cycle (A -> B -> C -> A)', () => {
    expect(() =>
      createProject({
        id: 'p',
        name: 'p',
        startDate: START_DATE,
        tasks: [
          { id: 'A', name: 'A', durationHours: 8, parentId: 'C' },
          { id: 'B', name: 'B', durationHours: 8, parentId: 'A' },
          { id: 'C', name: 'C', durationHours: 8, parentId: 'B' },
        ],
      }),
    ).toThrow(/cyclic parentId chain/);
  });

  it('allows a task to declare parentId before its parent is defined later in the array', () => {
    const project = createProject({
      id: 'p',
      name: 'p',
      startDate: START_DATE,
      tasks: [
        { id: 'Child', name: 'Child', durationHours: 8, parentId: 'Parent' },
        { id: 'Parent', name: 'Parent', durationHours: 0 },
      ],
    });

    const { tasks } = project.schedule();
    const byId = new Map(tasks.map((t) => [t.id, t]));
    expect(byId.get('Parent')?.isSummary).toBe(true);
    expect(byId.get('Child')?.parentId).toBe('Parent');
  });

  it('allows parentId: null and parentId: undefined as top-level (no throw)', () => {
    expect(() =>
      createProject({
        id: 'p',
        name: 'p',
        startDate: START_DATE,
        tasks: [
          { id: 'A', name: 'A', durationHours: 8, parentId: null },
          { id: 'B', name: 'B', durationHours: 8 },
        ],
      }),
    ).not.toThrow();
  });
});

// A(24h) -> B(16h) \
//         \           -> D(16h)
//           -> C(40h) /
// P is a summary task (parentId) grouping B and C.
function buildProject() {
  return createProject({
    id: 'p1',
    name: 'Sample Project',
    startDate: START_DATE,
    tasks: [
      { id: 'A', name: 'A', durationHours: 24 },
      { id: 'P', name: 'P', durationHours: 0 },
      { id: 'B', name: 'B', durationHours: 16, parentId: 'P' },
      { id: 'C', name: 'C', durationHours: 40, parentId: 'P' },
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

// A(24h) -> X(8h) (parentId: 'S')
//         -> Y(8h) (parentId: 'S')
//         -> Z(100h)
// S is a summary task grouping X and Y, neither of which is on the critical
// path (Z is much longer and determines the project finish).
function buildNoCriticalChildrenProject() {
  return createProject({
    id: 'p2',
    name: 'No-critical-children Project',
    startDate: START_DATE,
    tasks: [
      { id: 'A', name: 'A', durationHours: 24 },
      { id: 'S', name: 'S', durationHours: 0 },
      { id: 'X', name: 'X', durationHours: 8, parentId: 'S' },
      { id: 'Y', name: 'Y', durationHours: 8, parentId: 'S' },
      { id: 'Z', name: 'Z', durationHours: 100 },
    ],
    dependencies: [
      { id: 'd1', predecessorId: 'A', successorId: 'X', type: 'FS' },
      { id: 'd2', predecessorId: 'A', successorId: 'Y', type: 'FS' },
      { id: 'd3', predecessorId: 'A', successorId: 'Z', type: 'FS' },
    ],
  });
}

// Top (summary) -> Mid (summary) -> Leaf, a 3-level chain with no dependencies.
function buildThreeLevelProject() {
  return createProject({
    id: 'p3',
    name: 'Three-level Project',
    startDate: START_DATE,
    tasks: [
      { id: 'Top', name: 'Top', durationHours: 0 },
      { id: 'Mid', name: 'Mid', durationHours: 0, parentId: 'Top' },
      { id: 'Leaf', name: 'Leaf', durationHours: 8, parentId: 'Mid' },
    ],
  });
}

// Three top-level siblings; B has a manual wbs code.
function buildManualWbsProject() {
  return createProject({
    id: 'p4',
    name: 'Manual WBS Project',
    startDate: START_DATE,
    tasks: [
      { id: 'A', name: 'A', durationHours: 8 },
      { id: 'B', name: 'B', durationHours: 8, wbs: 'CUSTOM' },
      { id: 'C', name: 'C', durationHours: 8 },
    ],
  });
}

describe('WBS auto-numbering (deriveWbsHierarchy via schedule())', () => {
  it('assigns top-level tasks "1", "2", "3" in array order', () => {
    const project = buildProject();
    const { tasks } = project.schedule();
    const byId = new Map(tasks.map((t) => [t.id, t]));

    expect(byId.get('A')?.wbs).toBe('1');
    expect(byId.get('P')?.wbs).toBe('2');
    expect(byId.get('D')?.wbs).toBe('3');
  });

  it('assigns nested children "2.1", "2.2" under parent "2"', () => {
    const project = buildProject();
    const { tasks } = project.schedule();
    const byId = new Map(tasks.map((t) => [t.id, t]));

    expect(byId.get('B')?.wbs).toBe('2.1');
    expect(byId.get('C')?.wbs).toBe('2.2');
  });

  it('assigns three levels deep, e.g. "1.1.1"', () => {
    const project = buildThreeLevelProject();
    const { tasks } = project.schedule();
    const byId = new Map(tasks.map((t) => [t.id, t]));

    expect(byId.get('Top')?.wbs).toBe('1');
    expect(byId.get('Mid')?.wbs).toBe('1.1');
    expect(byId.get('Leaf')?.wbs).toBe('1.1.1');
  });

  it('respects a manually-set wbs and does not overwrite it', () => {
    const project = buildManualWbsProject();
    const { tasks } = project.schedule();
    const byId = new Map(tasks.map((t) => [t.id, t]));

    expect(byId.get('B')?.wbs).toBe('CUSTOM');
  });

  it('a manual wbs on one sibling does not change auto-numbering of other siblings', () => {
    const project = buildManualWbsProject();
    const { tasks } = project.schedule();
    const byId = new Map(tasks.map((t) => [t.id, t]));

    expect(byId.get('A')?.wbs).toBe('1');
    expect(byId.get('C')?.wbs).toBe('3');
  });
});

describe('isSummary and isCritical/dates rollup', () => {
  it('marks a task with children as isSummary: true, leaves leaves as isSummary: false', () => {
    const project = buildProject();
    const { tasks } = project.schedule();
    const byId = new Map(tasks.map((t) => [t.id, t]));

    expect(byId.get('P')?.isSummary).toBe(true);
    expect(byId.get('A')?.isSummary).toBe(false);
    expect(byId.get('B')?.isSummary).toBe(false);
    expect(byId.get('C')?.isSummary).toBe(false);
    expect(byId.get('D')?.isSummary).toBe(false);
  });

  it('rolls up summary start = min(children.start), end = max(children.end)', () => {
    const project = buildProject();
    const { tasks } = project.schedule();
    const byId = new Map(tasks.map((t) => [t.id, t]));

    const p = byId.get('P') as Task;
    const b = byId.get('B') as Task;
    const c = byId.get('C') as Task;

    expect(dateOf(p, 'start')).toBe(dateOf(b, 'start'));
    expect(dateOf(p, 'start')).toBe(dateOf(c, 'start'));
    expect(dateOf(p, 'end')).toBe(dateOf(c, 'end'));
  });

  it('rolls up summary isCritical = true if any child isCritical', () => {
    const project = buildProject();
    const { tasks } = project.schedule();
    const byId = new Map(tasks.map((t) => [t.id, t]));

    // C is on the critical path; B is not.
    expect(byId.get('C')?.isCritical).toBe(true);
    expect(byId.get('B')?.isCritical).toBe(false);
    expect(byId.get('P')?.isCritical).toBe(true);
  });

  it('rolls up summary isCritical = false if no child is critical', () => {
    const project = buildNoCriticalChildrenProject();
    const { tasks } = project.schedule();
    const byId = new Map(tasks.map((t) => [t.id, t]));

    expect(byId.get('X')?.isCritical).toBe(false);
    expect(byId.get('Y')?.isCritical).toBe(false);
    expect(byId.get('S')?.isCritical).toBe(false);
  });

  it('recomputes summary durationHours as the working-hour span of rolled-up start/end', () => {
    const project = buildProject();
    const { tasks } = project.schedule();
    const byId = new Map(tasks.map((t) => [t.id, t]));

    const p = byId.get('P') as Task;
    const c = byId.get('C') as Task;

    // P's span equals C's span (C determines both the start and end bounds).
    expect(p.durationHours).toBe(c.durationHours);
  });

  it('nested summaries roll up bottom-up', () => {
    const project = buildThreeLevelProject();
    const { tasks } = project.schedule();
    const byId = new Map(tasks.map((t) => [t.id, t]));

    const top = byId.get('Top') as Task;
    const mid = byId.get('Mid') as Task;
    const leaf = byId.get('Leaf') as Task;

    expect(dateOf(mid, 'start')).toBe(dateOf(leaf, 'start'));
    expect(dateOf(mid, 'end')).toBe(dateOf(leaf, 'end'));
    expect(dateOf(top, 'start')).toBe(dateOf(leaf, 'start'));
    expect(dateOf(top, 'end')).toBe(dateOf(leaf, 'end'));
    expect(top.durationHours).toBe(leaf.durationHours);
    expect(mid.durationHours).toBe(leaf.durationHours);
  });

  it('totalFloatHours on summary tasks retains its standalone CPM value (unused; grid renders "-")', () => {
    const project = buildProject();
    const { tasks } = project.schedule();
    const p = tasks.find((t) => t.id === 'P') as Task;

    expect(typeof p.totalFloatHours).toBe('number');
  });
});

describe('baseline/variance on summary tasks', () => {
  it("setBaseline() snapshots a summary task's rolled-up start/end/durationHours", () => {
    const project = buildProject();
    project.schedule();
    project.setBaseline();

    const p = project.getProject().tasks.find((t) => t.id === 'P') as Task;
    const c = project.getProject().tasks.find((t) => t.id === 'C') as Task;

    expect(p.baseline).toBeDefined();
    expect(toISODateString(p.baseline?.start as Date)).toBe(dateOf(p, 'start'));
    expect(toISODateString(p.baseline?.finish as Date)).toBe(dateOf(p, 'end'));
    expect(p.baseline?.durationHours).toBe(c.durationHours);
  });

  it("after a child task slips, re-schedule() updates the summary's rolled-up end and finishVarianceHours", () => {
    const project = buildProject();
    const before = project.schedule();
    const pBefore = before.tasks.find((t) => t.id === 'P') as Task;
    const cBefore = before.tasks.find((t) => t.id === 'C') as Task;
    expect(pBefore.end?.getTime()).toBe(cBefore.end?.getTime());
    const pBeforeEndTime = pBefore.end?.getTime();

    project.setBaseline();

    // C is critical; bumping its duration by 8h (1 working day) slips both
    // C's and P's rolled-up end by the same amount.
    const taskC = project.getProject().tasks.find((t) => t.id === 'C') as Task;
    taskC.durationHours += 8;

    const after = project.schedule();
    const pAfter = after.tasks.find((t) => t.id === 'P') as Task;
    const cAfter = after.tasks.find((t) => t.id === 'C') as Task;

    expect(pAfter.end?.getTime()).toBe(cAfter.end?.getTime());
    expect(pAfter.end?.getTime()).toBeGreaterThan(pBeforeEndTime as number);
    expect(pAfter.finishVarianceHours).toBe(8);
  });
});
