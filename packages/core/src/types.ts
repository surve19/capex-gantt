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

  /** Optional scheduling constraint. Omitted/ASAP = unconstrained (default CPM behavior). */
  constraint?: { type: ConstraintType; date: Date };
  /** True when totalFloatHours < 0, or an MSO/MFO constraint's date doesn't match
   *  the computed early start/finish. Computed by the scheduler. */
  isConstraintViolated?: boolean;
}

/**
 * Scheduling constraint applied to a task:
 * - `ASAP`: as soon as possible (default, unconstrained CPM behavior).
 * - `ALAP`: as late as possible. After both CPM passes complete, the task's
 *   `start`/`end` are set to `lateStart`/`lateFinish` (overriding the
 *   forward-pass values), while `earlyStart`/`earlyFinish`/`totalFloatHours`/
 *   `isCritical` remain ASAP-based.
 * - `MSO` / `MFO`: must start on / must finish on `constraint.date` (hard
 *   override of the forward-pass `earlyStart`/`earlyFinish`).
 * - `SNET` / `SNLT`: start no earlier than / start no later than
 *   `constraint.date`.
 * - `FNET` / `FNLT`: finish no earlier than / finish no later than
 *   `constraint.date`.
 */
export type ConstraintType = 'ASAP' | 'ALAP' | 'MSO' | 'MFO' | 'SNET' | 'SNLT' | 'FNET' | 'FNLT';

/**
 * Dependency relationship type between two tasks.
 *
 * All four types (`FS`/`SS`/`FF`/`SF`) are supported by the CPM forward/backward
 * pass, each with optional `lagHours`.
 */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface Dependency {
  id: string;
  predecessorId: string;
  successorId: string;
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
  /**
   * Optional parent calendar id. Single-level chain — the parent must not
   * itself set `inheritsFrom` (multi-level chains are rejected at resolution
   * time).
   */
  inheritsFrom?: string;
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
  /**
   * Adds a new calendar to the project. Validates `hoursPerDay` (must be > 0
   * and <= 24) and, if `inheritsFrom` is set, that the parent calendar exists
   * and itself has no `inheritsFrom` (multi-level chains are rejected).
   */
  addCalendar(calendar: Calendar): void;
  /**
   * Merges `patch` into the existing calendar identified by `id` (shallow
   * merge) and re-runs the same validation as `addCalendar` on the result.
   * Throws if no calendar with `id` exists.
   */
  updateCalendar(id: string, patch: Partial<Calendar>): void;
  /**
   * Removes the calendar identified by `id`. Throws if it is the project's
   * default calendar, if any task still references it via `calendarId`, or
   * if any other calendar inherits from it.
   */
  removeCalendar(id: string): void;
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
