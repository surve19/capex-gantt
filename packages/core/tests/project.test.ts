import { describe, expect, it } from 'vitest';
import { createProject } from '../src/index.js';

const START_DATE = new Date(2024, 0, 1); // Monday

describe('createProject', () => {
  it('creates a default Mon-Fri calendar when none is provided', () => {
    const project = createProject({
      id: 'p1',
      name: 'Project',
      startDate: START_DATE,
      tasks: [{ id: 'A', name: 'A', durationHours: 1 }],
    });

    const definition = project.getProject();
    expect(definition.calendars).toHaveLength(1);
    expect(definition.defaultCalendarId).toBe(definition.calendars[0]?.id);
    expect(definition.calendars[0]?.workingDays).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(definition.calendars[0]?.hoursPerDay).toBe(8);
  });

  it('uses a provided calendar list and defaultCalendarId', () => {
    const project = createProject({
      id: 'p2',
      name: 'Project',
      startDate: START_DATE,
      calendars: [
        {
          id: 'six-day',
          name: 'Six Day Week',
          workingDays: [false, true, true, true, true, true, true],
          exceptions: [],
          hoursPerDay: 8,
        },
      ],
      defaultCalendarId: 'six-day',
      tasks: [{ id: 'A', name: 'A', durationHours: 1 }],
    });

    expect(project.getProject().defaultCalendarId).toBe('six-day');
  });

  it('throws if defaultCalendarId does not match a provided calendar', () => {
    expect(() =>
      createProject({
        id: 'p3',
        name: 'Project',
        startDate: START_DATE,
        calendars: [
          {
            id: 'cal-a',
            name: 'A',
            workingDays: [false, true, true, true, true, true, false],
            exceptions: [],
            hoursPerDay: 8,
          },
        ],
        defaultCalendarId: 'does-not-exist',
        tasks: [{ id: 'A', name: 'A', durationHours: 1 }],
      }),
    ).toThrow(/defaultCalendarId/);
  });

  it('throws on duplicate task ids', () => {
    expect(() =>
      createProject({
        id: 'p4',
        name: 'Project',
        startDate: START_DATE,
        tasks: [
          { id: 'A', name: 'A', durationHours: 1 },
          { id: 'A', name: 'A again', durationHours: 1 },
        ],
      }),
    ).toThrow(/Duplicate task id/);
  });

  it('throws on negative durationHours', () => {
    expect(() =>
      createProject({
        id: 'p5',
        name: 'Project',
        startDate: START_DATE,
        tasks: [{ id: 'A', name: 'A', durationHours: -1 }],
      }),
    ).toThrow(/negative durationHours/);
  });

  it('throws on an invalid hoursPerDay', () => {
    const baseCalendar = {
      id: 'cal-a',
      name: 'A',
      workingDays: [false, true, true, true, true, true, false] as [
        boolean,
        boolean,
        boolean,
        boolean,
        boolean,
        boolean,
        boolean,
      ],
      exceptions: [],
    };

    expect(() =>
      createProject({
        id: 'p9a',
        name: 'Project',
        startDate: START_DATE,
        calendars: [{ ...baseCalendar, hoursPerDay: 0 }],
        defaultCalendarId: 'cal-a',
        tasks: [{ id: 'A', name: 'A', durationHours: 1 }],
      }),
    ).toThrow(/hoursPerDay/);

    expect(() =>
      createProject({
        id: 'p9b',
        name: 'Project',
        startDate: START_DATE,
        calendars: [{ ...baseCalendar, hoursPerDay: 25 }],
        defaultCalendarId: 'cal-a',
        tasks: [{ id: 'A', name: 'A', durationHours: 1 }],
      }),
    ).toThrow(/hoursPerDay/);
  });

  it('schedule() throws on a dependency cycle', () => {
    const project = createProject({
      id: 'p6',
      name: 'Project',
      startDate: START_DATE,
      tasks: [
        { id: 'A', name: 'A', durationHours: 1 },
        { id: 'B', name: 'B', durationHours: 1 },
      ],
      dependencies: [
        { id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS' },
        { id: 'd2', predecessorId: 'B', successorId: 'A', type: 'FS' },
      ],
    });

    expect(() => project.schedule()).toThrow(/cycle/);
  });

  it('schedule() throws on a non-FS dependency type (Phase 1 limitation)', () => {
    const project = createProject({
      id: 'p7',
      name: 'Project',
      startDate: START_DATE,
      tasks: [
        { id: 'A', name: 'A', durationHours: 1 },
        { id: 'B', name: 'B', durationHours: 1 },
      ],
      dependencies: [{ id: 'd1', predecessorId: 'A', successorId: 'B', type: 'SS' }],
    });

    expect(() => project.schedule()).toThrow(/FS/);
  });

  it('getTasks() reflects computed schedule fields after schedule()', () => {
    const project = createProject({
      id: 'p8',
      name: 'Project',
      startDate: START_DATE,
      tasks: [{ id: 'A', name: 'A', durationHours: 1 }],
    });

    expect(project.getTasks()[0]?.start).toBeUndefined();
    project.schedule();
    expect(project.getTasks()[0]?.start).toBeInstanceOf(Date);
  });
});
