import { describe, expect, it } from 'vitest';
import type { Calendar, Task } from '../src/index.js';
import { createDefaultCalendar, createProject, toISODateString } from '../src/index.js';

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

  it('applies a start-to-start dependency with lag', () => {
    // A(16h) -[SS, lag=8h]-> B(8h)
    const project = createProject({
      id: 'p5',
      name: 'SS Project',
      startDate: START_DATE,
      tasks: [
        { id: 'A', name: 'A', durationHours: 16 },
        { id: 'B', name: 'B', durationHours: 8 },
      ],
      dependencies: [{ id: 'd1', predecessorId: 'A', successorId: 'B', type: 'SS', lagHours: 8 }],
    });

    const result = project.schedule();
    const byId = new Map(result.tasks.map((t) => [t.id, t]));
    const b = byId.get('B') as Task;

    const mon08 = new Date(2024, 0, 1, 8, 0, 0);
    const tue08 = new Date(2024, 0, 2, 8, 0, 0);

    // B's earlyStart = SS(A.earlyStart=Mon00:00, lag=8h) = Mon08:00.
    expect(b.earlyStart?.getTime()).toBe(mon08.getTime());
    // B's 8h duration: Mon08:00 -> Tue08:00.
    expect(b.earlyFinish?.getTime()).toBe(tue08.getTime());
  });

  it('applies a finish-to-finish dependency with lag', () => {
    // A(16h) -[FF, lag=8h]-> B(8h)
    const project = createProject({
      id: 'p6',
      name: 'FF Project',
      startDate: START_DATE,
      tasks: [
        { id: 'A', name: 'A', durationHours: 16 },
        { id: 'B', name: 'B', durationHours: 8 },
      ],
      dependencies: [{ id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FF', lagHours: 8 }],
    });

    const result = project.schedule();
    const byId = new Map(result.tasks.map((t) => [t.id, t]));
    const b = byId.get('B') as Task;

    const wed00 = new Date(2024, 0, 3, 0, 0, 0);
    const wed08 = new Date(2024, 0, 3, 8, 0, 0);

    // A.earlyFinish = Tue08:00. FF finish candidate = Tue08:00 + 8h = Wed08:00.
    // B's 8h duration consumed backward from the finish candidate: Wed08:00 - 8h = Wed00:00.
    expect(b.earlyStart?.getTime()).toBe(wed00.getTime());
    expect(b.earlyFinish?.getTime()).toBe(wed08.getTime());
  });

  it('applies a start-to-finish dependency with lag', () => {
    // A(8h) -[SF, lag=24h]-> B(8h)
    const project = createProject({
      id: 'p7',
      name: 'SF Project',
      startDate: START_DATE,
      tasks: [
        { id: 'A', name: 'A', durationHours: 8 },
        { id: 'B', name: 'B', durationHours: 8 },
      ],
      dependencies: [{ id: 'd1', predecessorId: 'A', successorId: 'B', type: 'SF', lagHours: 24 }],
    });

    const result = project.schedule();
    const byId = new Map(result.tasks.map((t) => [t.id, t]));
    const b = byId.get('B') as Task;

    const wed00 = new Date(2024, 0, 3, 0, 0, 0);
    const wed08 = new Date(2024, 0, 3, 8, 0, 0);

    // A.earlyStart = Mon00:00. SF finish candidate = Mon00:00 + 24h working = Wed08:00.
    // B's 8h duration consumed backward from the finish candidate: Wed08:00 - 8h = Wed00:00.
    expect(b.earlyStart?.getTime()).toBe(wed00.getTime());
    expect(b.earlyFinish?.getTime()).toBe(wed08.getTime());
  });

  it('SNET constraint pushes earlyStart later than projectStart', () => {
    // A(8h), no predecessors, SNET = Wed00:00 (later than projectStart = Mon00:00).
    const wed00 = new Date(2024, 0, 3, 0, 0, 0);
    const wed08 = new Date(2024, 0, 3, 8, 0, 0);

    const project = createProject({
      id: 'p8',
      name: 'SNET Project',
      startDate: START_DATE,
      tasks: [
        {
          id: 'A',
          name: 'A',
          durationHours: 8,
          constraint: { type: 'SNET', date: wed00 },
        },
      ],
    });

    const result = project.schedule();
    const a = result.tasks.find((t) => t.id === 'A') as Task;

    expect(a.earlyStart?.getTime()).toBe(wed00.getTime());
    expect(a.earlyFinish?.getTime()).toBe(wed08.getTime());
  });

  it('FNLT constraint earlier than earlyFinish creates negative float and isConstraintViolated', () => {
    // A(8h), no predecessors/successors. FNLT = Mon00:00, but earlyFinish = Mon08:00.
    const mon00 = new Date(2024, 0, 1, 0, 0, 0);

    const project = createProject({
      id: 'p9',
      name: 'FNLT Project',
      startDate: START_DATE,
      tasks: [
        {
          id: 'A',
          name: 'A',
          durationHours: 8,
          constraint: { type: 'FNLT', date: mon00 },
        },
      ],
    });

    const result = project.schedule();
    const a = result.tasks.find((t) => t.id === 'A') as Task;

    expect(a.totalFloatHours).toBe(-8);
    expect(a.isConstraintViolated).toBe(true);
  });

  it('MSO constraint on a standalone task is feasible (earlyStart equals constraint date)', () => {
    // A(8h), no predecessors/successors. MSO = projectStart (Mon00:00).
    const mon00 = new Date(2024, 0, 1, 0, 0, 0);

    const project = createProject({
      id: 'p10',
      name: 'MSO Feasible Project',
      startDate: START_DATE,
      tasks: [
        {
          id: 'A',
          name: 'A',
          durationHours: 8,
          constraint: { type: 'MSO', date: mon00 },
        },
      ],
    });

    const result = project.schedule();
    const a = result.tasks.find((t) => t.id === 'A') as Task;

    expect(a.earlyStart?.getTime()).toBe(mon00.getTime());
    expect(a.totalFloatHours).toBe(0);
    expect(a.isConstraintViolated).toBe(false);
  });

  it('MSO constraint on a successor that conflicts with predecessor logic causes negative float upstream', () => {
    // A(16h) -[FS]-> B(8h), B has MSO = Mon00:00 (== projectStart).
    // B's MSO hard-overrides its earlyStart to Mon00:00, ignoring A's FS dependency,
    // which makes A infeasible (negative float / isConstraintViolated on A).
    const mon00 = new Date(2024, 0, 1, 0, 0, 0);

    const project = createProject({
      id: 'p11',
      name: 'MSO Infeasible Project',
      startDate: START_DATE,
      tasks: [
        { id: 'A', name: 'A', durationHours: 16 },
        {
          id: 'B',
          name: 'B',
          durationHours: 8,
          constraint: { type: 'MSO', date: mon00 },
        },
      ],
      dependencies: [{ id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS' }],
    });

    const result = project.schedule();
    const byId = new Map(result.tasks.map((t) => [t.id, t]));
    const a = byId.get('A') as Task;
    const b = byId.get('B') as Task;

    // B itself is feasible: MSO is a hard override, so earlyStart === constraint.date.
    expect(b.earlyStart?.getTime()).toBe(mon00.getTime());
    expect(b.isConstraintViolated).toBe(false);

    // A is forced infeasible: B's MSO date is before A can finish via the FS dependency.
    expect(a.totalFloatHours).toBe(-16);
    expect(a.isConstraintViolated).toBe(true);
  });

  it('ALAP task: start/end equal lateStart/lateFinish while earlyStart/earlyFinish remain ASAP', () => {
    // A(8h) -[FS]-> B(8h) (ALAP), A(8h) -[FS]-> C(24h). Neither B nor C has successors.
    const project = createProject({
      id: 'p12',
      name: 'ALAP Project',
      startDate: START_DATE,
      tasks: [
        { id: 'A', name: 'A', durationHours: 8 },
        { id: 'B', name: 'B', durationHours: 8, constraint: { type: 'ALAP', date: START_DATE } },
        { id: 'C', name: 'C', durationHours: 24 },
      ],
      dependencies: [
        { id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS' },
        { id: 'd2', predecessorId: 'A', successorId: 'C', type: 'FS' },
      ],
    });

    const result = project.schedule();
    const b = result.tasks.find((t) => t.id === 'B') as Task;

    const tue00 = new Date(2024, 0, 2, 0, 0, 0);
    const tue08 = new Date(2024, 0, 2, 8, 0, 0);
    const thu00 = new Date(2024, 0, 4, 0, 0, 0);
    const thu08 = new Date(2024, 0, 4, 8, 0, 0);

    // ASAP-based early dates remain unchanged. A finishes exactly at Mon
    // window-end (Mon08:00), so B's FS-derived earlyStart forward-snaps to Tue00:00.
    expect(b.earlyStart?.getTime()).toBe(tue00.getTime());
    expect(b.earlyFinish?.getTime()).toBe(tue08.getTime());

    // Positive float: B can slip from Mon08:00 to Thu00:00.
    expect(b.totalFloatHours).toBe(16);
    expect(b.isCritical).toBe(false);

    // start/end are overridden to the late dates for ALAP, diverging from early dates.
    expect(b.lateStart?.getTime()).toBe(thu00.getTime());
    expect(b.lateFinish?.getTime()).toBe(thu08.getTime());
    expect(b.start?.getTime()).toBe(b.lateStart?.getTime());
    expect(b.end?.getTime()).toBe(b.lateFinish?.getTime());
    expect(b.start?.getTime()).not.toBe(b.earlyStart?.getTime());
    expect(b.end?.getTime()).not.toBe(b.earlyFinish?.getTime());
  });

  describe('cross-calendar dependencies (convertInstant integration)', () => {
    const SITE_CALENDAR: Calendar = createDefaultCalendar('site', 'Site (Mon-Fri, 8h)');
    const PROCUREMENT_CALENDAR: Calendar = {
      id: 'procurement',
      name: 'Procurement (24/7)',
      workingDays: [true, true, true, true, true, true, true],
      exceptions: [],
      hoursPerDay: 24,
    };

    it('FS chain across calendars exercises convertInstant window-end and proportional-scale branches both ways', () => {
      // A(site,8h,dur=8) -FS-> B(procurement,24h,dur=12) -FS-> C(site,8h,dur=8)
      const project = createProject({
        id: 'p13',
        name: 'Cross-Calendar FS Chain',
        startDate: START_DATE,
        calendars: [SITE_CALENDAR, PROCUREMENT_CALENDAR],
        defaultCalendarId: 'site',
        tasks: [
          { id: 'A', name: 'A', durationHours: 8, calendarId: 'site' },
          { id: 'B', name: 'B', durationHours: 12, calendarId: 'procurement' },
          { id: 'C', name: 'C', durationHours: 8, calendarId: 'site' },
        ],
        dependencies: [
          { id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS' },
          { id: 'd2', predecessorId: 'B', successorId: 'C', type: 'FS' },
        ],
      });

      const result = project.schedule();
      const byId = new Map(result.tasks.map((t) => [t.id, t]));
      const a = byId.get('A') as Task;
      const b = byId.get('B') as Task;
      const c = byId.get('C') as Task;

      const mon00 = new Date(2024, 0, 1, 0, 0, 0);
      const mon08 = new Date(2024, 0, 1, 8, 0, 0);
      const tue00 = new Date(2024, 0, 2, 0, 0, 0);
      const tue04 = new Date(2024, 0, 2, 4, 0, 0);
      const tue12 = new Date(2024, 0, 2, 12, 0, 0);
      const wed04 = new Date(2024, 0, 3, 4, 0, 0);

      // A finishes exactly at site's window end (Mon08:00, msOfDay === 8h === fromWindow).
      expect(a.earlyStart?.getTime()).toBe(mon00.getTime());
      expect(a.earlyFinish?.getTime()).toBe(mon08.getTime());

      // window-end branch: A's window-end (8h of an 8h day) maps to B's window-end
      // (24h of a 24h day), which forward-snaps to Tue00:00.
      expect(b.earlyStart?.getTime()).toBe(tue00.getTime());
      expect(b.earlyFinish?.getTime()).toBe(tue12.getTime());

      // proportional-scale branch: B's earlyFinish (12h of a 24h day) scales to
      // 4h of an 8h day -> Tue04:00.
      expect(c.earlyStart?.getTime()).toBe(tue04.getTime());
      expect(c.earlyFinish?.getTime()).toBe(wed04.getTime());

      // Single chain: all three tasks are critical.
      expect(a.isCritical).toBe(true);
      expect(b.isCritical).toBe(true);
      expect(c.isCritical).toBe(true);
      expect(toISODateString(result.projectFinish)).toBe(toISODateString(wed04));
    });

    it('FF dependency with lag across calendars converts both forward- and backward-pass dates', () => {
      // X(site,8h,dur=4) -FF[lag=0]-> Y(procurement,24h,dur=6)
      const project = createProject({
        id: 'p14',
        name: 'Cross-Calendar FF',
        startDate: START_DATE,
        calendars: [SITE_CALENDAR, PROCUREMENT_CALENDAR],
        defaultCalendarId: 'site',
        tasks: [
          { id: 'X', name: 'X', durationHours: 4, calendarId: 'site' },
          { id: 'Y', name: 'Y', durationHours: 6, calendarId: 'procurement' },
        ],
        dependencies: [{ id: 'd1', predecessorId: 'X', successorId: 'Y', type: 'FF' }],
      });

      const result = project.schedule();
      const byId = new Map(result.tasks.map((t) => [t.id, t]));
      const x = byId.get('X') as Task;
      const y = byId.get('Y') as Task;

      const mon00 = new Date(2024, 0, 1, 0, 0, 0);
      const mon04 = new Date(2024, 0, 1, 4, 0, 0);
      const mon06 = new Date(2024, 0, 1, 6, 0, 0);
      const mon12 = new Date(2024, 0, 1, 12, 0, 0);

      expect(x.earlyStart?.getTime()).toBe(mon00.getTime());
      expect(x.earlyFinish?.getTime()).toBe(mon04.getTime());

      // X's earlyFinish (4h of an 8h day) scales to 12h of a 24h day; Y's FF
      // finish candidate is Mon12:00, minus Y's 6h duration -> Mon06:00.
      expect(y.earlyStart?.getTime()).toBe(mon06.getTime());
      expect(y.earlyFinish?.getTime()).toBe(mon12.getTime());

      // Backward pass converts Y.lateFinish (12h of a 24h day) back to 4h of
      // an 8h day, giving X the same lateFinish as its earlyFinish.
      expect(x.lateFinish?.getTime()).toBe(mon04.getTime());
      expect(x.isCritical).toBe(true);
      expect(y.isCritical).toBe(true);
    });
  });
});
