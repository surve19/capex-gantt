import type { CreateProjectInput } from '@capex-gantt/core';

/**
 * A small EPC-style project: site work, parallel design/procurement tracks,
 * and a construction phase with multiple predecessors. One calendar holiday
 * is included so the timeline visibly skips a non-working day, and the
 * differing predecessor durations into "Construction & Installation" leave
 * several tasks with positive total float.
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
  ],
  defaultCalendarId: 'site',
  tasks: [
    { id: 'A', name: 'Site Survey & Mobilization', durationHours: 24 },
    { id: 'B', name: 'Civil Design', durationHours: 40 },
    { id: 'C', name: 'Mechanical Design', durationHours: 32 },
    { id: 'D', name: 'Permitting & Approvals', durationHours: 64 },
    { id: 'E', name: 'Equipment Procurement', durationHours: 80 },
    { id: 'F', name: 'Site Preparation', durationHours: 32 },
    { id: 'G', name: 'Construction & Installation', durationHours: 96 },
    { id: 'H', name: 'Commissioning & Handover', durationHours: 40 },
  ],
  dependencies: [
    { id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS' },
    { id: 'd2', predecessorId: 'A', successorId: 'C', type: 'FS' },
    { id: 'd3', predecessorId: 'A', successorId: 'D', type: 'FS' },
    { id: 'd4', predecessorId: 'C', successorId: 'E', type: 'FS' },
    { id: 'd5', predecessorId: 'D', successorId: 'F', type: 'FS' },
    { id: 'd6', predecessorId: 'B', successorId: 'G', type: 'FS' },
    { id: 'd7', predecessorId: 'E', successorId: 'G', type: 'FS' },
    { id: 'd8', predecessorId: 'F', successorId: 'G', type: 'FS' },
    { id: 'd9', predecessorId: 'G', successorId: 'H', type: 'FS' },
  ],
};
