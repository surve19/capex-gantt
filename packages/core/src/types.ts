/**
 * Core data model for capex-gantt.
 *
 * Phase 1 supports a single calendar per project (with optional per-task
 * overrides), finish-to-start dependencies with optional lag, and a CPM
 * forward/backward pass producing total float and a critical path flag.
 *
 * Phase 1.5 moves all scheduling math to working-hour granularity. Each
 * calendar declares a uniform `hoursPerDay`, and a working day's window is
 * implicitly `[00:00, 00:00 + hoursPerDay)`. Finish-to-start chaining is
 * continuous-time: a successor with `lagHours === 0` starts at the exact
 * instant its predecessor finishes (which may be mid-day for sub-day tasks).
 *
 * Later phases (baselines, constraints, percent complete, resources, EVM)
 * are expected to add fields to these interfaces rather than replace them,
 * so the shapes here are designed with that growth in mind.
 */

/** A date, accepted as either a `Date` or an ISO-8601 string at API boundaries. */
export type DateInput = Date | string;

export interface Task {
  id: string;
  name: string;
  /** Optional WBS code/path for display and hierarchy, e.g. "1.2.3". */
  wbs?: string;
  /** Parent task id for WBS hierarchy, or null/undefined for top-level tasks. */
  parentId?: string | null;

  /** Duration in working hours, measured against the task's calendar. */
  durationHours: number;

  /** Calendar id to schedule this task against. Defaults to the project's default calendar. */
  calendarId?: string;

  // --- Computed by the scheduler (overwritten by `schedule()`; do not set manually) ---

  /** Scheduled start date (equal to earlyStart in Phase 1). */
  start?: Date;
  /** Scheduled end date (equal to earlyFinish in Phase 1). */
  end?: Date;
  earlyStart?: Date;
  earlyFinish?: Date;
  lateStart?: Date;
  lateFinish?: Date;
  /** Total float in working hours. 0 indicates a critical task. */
  totalFloatHours?: number;
  /** True when totalFloatHours === 0. */
  isCritical?: boolean;
}

/**
 * Dependency relationship type between two tasks.
 *
 * Phase 1 only implements 'FS' (finish-to-start); the other variants are
 * included now so the type and validation surface won't need to change
 * shape when SS/FF/SF support is added.
 */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface Dependency {
  id: string;
  predecessorId: string;
  successorId: string;
  /** Phase 1 only supports 'FS'. Other values are rejected by `createProject`. */
  type: DependencyType;
  /** Lag in working hours. Negative values represent lead (overlap). Defaults to 0. */
  lagHours?: number;
}

export interface CalendarException {
  /** ISO date "YYYY-MM-DD". */
  date: string;
  /** false = non-working (holiday); true = working override on a normally non-working day. */
  isWorking: boolean;
}

export interface Calendar {
  id: string;
  name: string;
  /** Working-day flags indexed Sunday (0) through Saturday (6). */
  workingDays: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
  /** Date-specific overrides layered on top of `workingDays`. */
  exceptions: CalendarException[];
  /** Working hours per working day, e.g. 8. Must be > 0 and <= 24. */
  hoursPerDay: number;
}

export interface Project {
  id: string;
  name: string;
  /** Anchor date for the forward pass; the earliest task can start here. */
  startDate: Date;
  /** Calendar id used by tasks that don't specify their own `calendarId`. */
  defaultCalendarId: string;
  calendars: Calendar[];
  tasks: Task[];
  dependencies: Dependency[];
}

/** Result of running `schedule()`: the project's tasks enriched with computed dates. */
export interface ScheduleResult {
  tasks: Task[];
  /** The latest earlyFinish across all tasks. */
  projectFinish: Date;
  /** Ids of tasks where isCritical === true, in task order. */
  criticalTaskIds: string[];
}

export interface ProjectInstance {
  /** Returns the current project definition (calendars, tasks, dependencies). */
  getProject(): Project;
  /** Returns the current tasks, including any computed schedule fields from the last `schedule()` call. */
  getTasks(): Task[];
  /** Runs the CPM forward/backward pass and returns the updated schedule. */
  schedule(): ScheduleResult;
}

/** Input accepted by `createProject`. Calendars are optional; a default Mon-Fri calendar is created if omitted. */
export interface CreateProjectInput {
  id: string;
  name: string;
  startDate: DateInput;
  /** If omitted, a default Mon-Fri working calendar is created and used as the default. */
  calendars?: Calendar[];
  /** Required when `calendars` is provided; ignored (and defaulted) otherwise. */
  defaultCalendarId?: string;
  tasks: Task[];
  dependencies?: Dependency[];
}
