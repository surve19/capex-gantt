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

  it('throws when a task references an unknown calendarId', () => {
    expect(() =>
      createProject({
        id: 'p10',
        name: 'Project',
        startDate: START_DATE,
        tasks: [{ id: 'A', name: 'A', durationHours: 1, calendarId: 'does-not-exist' }],
      }),
    ).toThrow(/Task "A" references unknown calendar "does-not-exist"/);
  });

  it('throws when a calendar inheritsFrom an unknown calendar', () => {
    expect(() =>
      createProject({
        id: 'p11',
        name: 'Project',
        startDate: START_DATE,
        calendars: [
          {
            id: 'cal-a',
            name: 'A',
            workingDays: [false, true, true, true, true, true, false],
            exceptions: [],
            hoursPerDay: 8,
            inheritsFrom: 'missing-parent',
          },
        ],
        defaultCalendarId: 'cal-a',
        tasks: [{ id: 'A', name: 'A', durationHours: 1 }],
      }),
    ).toThrow(/inherits from unknown calendar "missing-parent"/);
  });

  it('throws when a calendar inheritsFrom a calendar that itself has inheritsFrom', () => {
    expect(() =>
      createProject({
        id: 'p12',
        name: 'Project',
        startDate: START_DATE,
        calendars: [
          {
            id: 'grandparent',
            name: 'Grandparent',
            workingDays: [false, true, true, true, true, true, false],
            exceptions: [],
            hoursPerDay: 8,
          },
          {
            id: 'parent',
            name: 'Parent',
            workingDays: [false, true, true, true, true, true, false],
            exceptions: [],
            hoursPerDay: 8,
            inheritsFrom: 'grandparent',
          },
          {
            id: 'child',
            name: 'Child',
            workingDays: [false, true, true, true, true, true, false],
            exceptions: [],
            hoursPerDay: 8,
            inheritsFrom: 'parent',
          },
        ],
        defaultCalendarId: 'child',
        tasks: [{ id: 'A', name: 'A', durationHours: 1 }],
      }),
    ).toThrow(/cannot be used as a parent because it itself inherits/);
  });
});

describe('calendar CRUD', () => {
  function buildProject() {
    return createProject({
      id: 'pc1',
      name: 'Project',
      startDate: START_DATE,
      calendars: [
        {
          id: 'default',
          name: 'Default',
          workingDays: [false, true, true, true, true, true, false],
          exceptions: [],
          hoursPerDay: 8,
        },
      ],
      defaultCalendarId: 'default',
      tasks: [{ id: 'A', name: 'A', durationHours: 1 }],
    });
  }

  /** Like buildProject, but task "B" references the "site" calendar from the start. */
  function buildProjectWithSiteCalendarInUse() {
    return createProject({
      id: 'pc2',
      name: 'Project',
      startDate: START_DATE,
      calendars: [
        {
          id: 'default',
          name: 'Default',
          workingDays: [false, true, true, true, true, true, false],
          exceptions: [],
          hoursPerDay: 8,
        },
        siteCalendar,
      ],
      defaultCalendarId: 'default',
      tasks: [
        { id: 'A', name: 'A', durationHours: 1 },
        { id: 'B', name: 'B', durationHours: 1, calendarId: 'site' },
      ],
    });
  }

  const siteCalendar = {
    id: 'site',
    name: 'Site',
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
    hoursPerDay: 10,
  };

  describe('addCalendar', () => {
    it('appends a valid calendar to the project', () => {
      const project = buildProject();
      project.addCalendar(siteCalendar);

      const calendars = project.getProject().calendars;
      expect(calendars).toHaveLength(2);
      expect(calendars.find((c) => c.id === 'site')).toEqual(siteCalendar);
    });

    it('throws on an invalid hoursPerDay', () => {
      const project = buildProject();
      expect(() => project.addCalendar({ ...siteCalendar, hoursPerDay: 0 })).toThrow(/hoursPerDay/);
      expect(() => project.addCalendar({ ...siteCalendar, hoursPerDay: 25 })).toThrow(
        /hoursPerDay/,
      );
    });

    it('throws when inheritsFrom references an unknown calendar', () => {
      const project = buildProject();
      expect(() =>
        project.addCalendar({ ...siteCalendar, inheritsFrom: 'does-not-exist' }),
      ).toThrow(/inherits from unknown calendar/);
    });

    it('throws when inheritsFrom references a calendar that itself inherits', () => {
      const project = buildProject();
      // "default" doesn't itself inherit, so this succeeds.
      project.addCalendar({ ...siteCalendar, id: 'parent', inheritsFrom: 'default' });

      // "parent" itself has inheritsFrom set, so a calendar inheriting from it must throw.
      expect(() =>
        project.addCalendar({ ...siteCalendar, id: 'child', inheritsFrom: 'parent' }),
      ).toThrow(/cannot be used as a parent because it itself inherits/);
    });
  });

  describe('updateCalendar', () => {
    it('merges a patch into an existing calendar', () => {
      const project = buildProject();
      project.updateCalendar('default', { hoursPerDay: 10, name: 'Updated Default' });

      const updated = project.getProject().calendars.find((c) => c.id === 'default');
      expect(updated?.hoursPerDay).toBe(10);
      expect(updated?.name).toBe('Updated Default');
      // Unchanged fields remain intact.
      expect(updated?.workingDays).toEqual([false, true, true, true, true, true, false]);
    });

    it('throws if the calendar does not exist', () => {
      const project = buildProject();
      expect(() => project.updateCalendar('does-not-exist', { hoursPerDay: 8 })).toThrow(
        /Calendar "does-not-exist" not found/,
      );
    });

    it('re-validates the merged result', () => {
      const project = buildProject();
      expect(() => project.updateCalendar('default', { hoursPerDay: 0 })).toThrow(/hoursPerDay/);
    });
  });

  describe('removeCalendar', () => {
    it('removes a calendar not referenced by anything', () => {
      const project = buildProject();
      project.addCalendar(siteCalendar);
      project.removeCalendar('site');

      expect(project.getProject().calendars.find((c) => c.id === 'site')).toBeUndefined();
    });

    it('throws when removing the default calendar', () => {
      const project = buildProject();
      expect(() => project.removeCalendar('default')).toThrow(
        /Cannot remove the default calendar "default"/,
      );
    });

    it('throws when removing a calendar still referenced by a task', () => {
      const project = buildProjectWithSiteCalendarInUse();

      expect(() => project.removeCalendar('site')).toThrow(
        /Cannot remove calendar "site": still referenced by task "B"/,
      );
    });

    it('throws when removing a calendar that another calendar inherits from', () => {
      const project = buildProject();
      project.addCalendar({ ...siteCalendar, id: 'parent-cal' });
      project.addCalendar({
        ...siteCalendar,
        id: 'child-cal',
        inheritsFrom: 'parent-cal',
      });

      expect(() => project.removeCalendar('parent-cal')).toThrow(
        /Cannot remove calendar "parent-cal": calendar "child-cal" inherits from it/,
      );
    });
  });
});
