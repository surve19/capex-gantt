import type { CreateProjectInput } from '@capex-gantt/core';

/**
 * A small EPC-style project: site work, parallel design/procurement tracks,
 * and a construction phase with multiple predecessors. One calendar holiday
 * is included so the timeline visibly skips a non-working day, and the
 * differing predecessor durations into "Construction & Installation" leave
 * several tasks with positive total float.
 *
 * Also showcases Phase 2 features: "Equipment Procurement" runs on a
 * separate 24/7 calendar (cross-calendar dependency conversion), the
 * procurement and commissioning links use SS/FF dependency types, and
 * "Permitting & Approvals" carries a finish-no-later-than constraint that's
 * earlier than its natural finish, producing a constraint violation that
 * ripples back to its predecessor.
 */
export const sampleProjectInput: CreateProjectInput = {
  id: 'sample',
  name: 'Sample EPC Project',
  startDate: '2024-01-01', // Monday
  calendars: [
    {
      id: 'site',
      name: 'Site Calendar (Mon-Fri)',
      workingDays: [false, true, true, true, true, true, false],
      exceptions: [{ date: '2024-01-15', isWorking: false }],
      hoursPerDay: 8,
    },
    {
      id: 'procurement',
      name: 'Procurement (24/7)',
      workingDays: [true, true, true, true, true, true, true],
      exceptions: [],
      hoursPerDay: 24,
    },
  ],
  defaultCalendarId: 'site',
  tasks: [
    { id: 'A', name: 'Site Survey & Mobilization', durationHours: 24 },
    { id: 'B', name: 'Civil Design', durationHours: 40 },
    { id: 'C', name: 'Mechanical Design', durationHours: 32 },
    {
      id: 'D',
      name: 'Permitting & Approvals',
      durationHours: 64,
      // Regulator deadline earlier than the natural finish: intentionally
      // produces isConstraintViolated: true (and ripples back to "A") to
      // demonstrate constraint-violation highlighting.
      constraint: { type: 'FNLT', date: new Date(2024, 0, 11) },
    },
    // Runs on the 24/7 procurement calendar instead of the site calendar,
    // exercising cross-calendar instant conversion with its site-calendar
    // predecessor/successor.
    { id: 'E', name: 'Equipment Procurement', durationHours: 80, calendarId: 'procurement' },
    { id: 'F', name: 'Site Preparation', durationHours: 32 },
    { id: 'G', name: 'Construction & Installation', durationHours: 96 },
    { id: 'H', name: 'Commissioning & Handover', durationHours: 40 },
  ],
  dependencies: [
    { id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS' },
    { id: 'd2', predecessorId: 'A', successorId: 'C', type: 'FS' },
    { id: 'd3', predecessorId: 'A', successorId: 'D', type: 'FS' },
    // Procurement can start partway through Mechanical Design, running in parallel on its own calendar.
    { id: 'd4', predecessorId: 'C', successorId: 'E', type: 'SS', lagHours: 16 },
    { id: 'd5', predecessorId: 'D', successorId: 'F', type: 'FS' },
    { id: 'd6', predecessorId: 'B', successorId: 'G', type: 'FS' },
    { id: 'd7', predecessorId: 'E', successorId: 'G', type: 'FS' },
    { id: 'd8', predecessorId: 'F', successorId: 'G', type: 'FS' },
    // Commissioning finishes shortly after construction finishes, with overlap during the tail end.
    { id: 'd9', predecessorId: 'G', successorId: 'H', type: 'FF', lagHours: 8 },
  ],
};
