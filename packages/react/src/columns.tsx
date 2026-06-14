import type { Calendar, Task } from '@capex-gantt/core';
import type { ReactNode } from 'react';
import { INDENT_PX } from './layout.js';

/** Tooltip/badge strings used by the grid and task bars. Override via `Gantt`'s `labels` prop. */
export interface GanttLabels {
  /** Badge tooltip when a task has a constraint that its computed dates violate. */
  constraintViolated: string;
  /** Badge tooltip when a task has negative total float but no constraint. */
  floatViolated: string;
  /** Tooltip prefix for a task's total float. */
  floatLabel: string;
  /** Tooltip prefix for a task's baseline span. */
  baselineLabel: string;
  /** Tooltip prefix for a task's finish variance. */
  varianceLabel: string;
  /** Tooltip prefix for a task's scheduling constraint. */
  constraintLabel: string;
}

export const DEFAULT_LABELS: GanttLabels = {
  constraintViolated: 'Constraint not met: negative float',
  floatViolated: 'Negative total float',
  floatLabel: 'Float',
  baselineLabel: 'Baseline',
  varianceLabel: 'Finish variance',
  constraintLabel: 'Constraint',
};

/** Context passed to a `GanttColumn.render` function for the row being rendered. */
export interface GanttColumnContext {
  /** Ancestor-chain depth of this row in the WBS tree (top-level = 0). */
  depth: number;
  calendars: Calendar[];
  defaultCalendarId?: string;
  formatDate: (date: Date) => string;
  labels: GanttLabels;
  /** True if this row is a summary task whose children are currently hidden. */
  isCollapsed: boolean;
  /** Toggles whether this row's children are hidden. No-op for non-summary rows. */
  onToggleCollapse: () => void;
}

export interface GanttColumn {
  id: string;
  header: ReactNode;
  /** Initial width in px. Defaults to 100. */
  width?: number;
  align?: 'left' | 'right' | 'center';
  /** Whether the column's right edge can be dragged to resize. Defaults to true. */
  resizable?: boolean;
  /** Extra class name(s) applied to the cell, in addition to `cg-grid__cell` and `cg-grid__cell--<id>`. */
  className?: string;
  /** Cell content. Defaults to `String(task[id] ?? '-')`. */
  render?: (task: Task, ctx: GanttColumnContext) => ReactNode;
}

function formatConstraint(
  constraint: NonNullable<Task['constraint']>,
  formatDate: (date: Date) => string,
): string {
  return `${constraint.type} ${formatDate(constraint.date)}`;
}

export const DEFAULT_COLUMNS: GanttColumn[] = [
  {
    id: 'wbs',
    header: 'WBS',
    width: 70,
    render: (task) => task.wbs ?? '-',
  },
  {
    id: 'name',
    header: 'Task Name',
    width: 180,
    render: (task, ctx) => (
      <div
        className="cg-grid__name-content"
        style={{ paddingLeft: ctx.depth * INDENT_PX }}
        title={task.name}
      >
        {task.isSummary ? (
          <button
            type="button"
            className="cg-grid__chevron"
            onClick={ctx.onToggleCollapse}
            aria-expanded={!ctx.isCollapsed}
            aria-label={ctx.isCollapsed ? `Expand ${task.name}` : `Collapse ${task.name}`}
          >
            {ctx.isCollapsed ? '▶' : '▼'}
          </button>
        ) : (
          <span className="cg-grid__chevron-spacer" />
        )}
        <span className="cg-grid__cell-text">{task.name}</span>
      </div>
    ),
  },
  {
    id: 'duration',
    header: 'Duration',
    width: 60,
    align: 'right',
    render: (task) => `${task.durationHours}h`,
  },
  {
    id: 'start',
    header: 'Start',
    width: 90,
    align: 'right',
    render: (task, ctx) => (task.start ? ctx.formatDate(task.start) : '-'),
  },
  {
    id: 'finish',
    header: 'Finish',
    width: 90,
    align: 'right',
    render: (task, ctx) => (task.end ? ctx.formatDate(task.end) : '-'),
  },
  {
    id: 'float',
    header: 'Float',
    width: 60,
    align: 'right',
    render: (task) =>
      task.isSummary || task.totalFloatHours === undefined ? '-' : Math.round(task.totalFloatHours),
  },
  {
    id: 'variance',
    header: 'Variance',
    width: 70,
    align: 'right',
    render: (task) => {
      if (task.finishVarianceHours === undefined) return '-';
      const variance = Math.round(task.finishVarianceHours);
      const varianceClass =
        variance > 0 ? 'cg-variance--late' : variance < 0 ? 'cg-variance--early' : '';
      return <span className={varianceClass}>{variance > 0 ? `+${variance}` : variance}</span>;
    },
  },
  {
    id: 'calendar',
    header: 'Calendar',
    width: 140,
    render: (task, ctx) => {
      const usesNonDefaultCalendar = !!task.calendarId && task.calendarId !== ctx.defaultCalendarId;
      if (!usesNonDefaultCalendar) return null;
      const calendarName =
        ctx.calendars.find((c) => c.id === task.calendarId)?.name ?? task.calendarId;
      return (
        <span className="cg-badge cg-badge--calendar" title={`Calendar: ${task.calendarId}`}>
          {calendarName}
        </span>
      );
    },
  },
  {
    id: 'constraint',
    header: 'Constraint',
    width: 150,
    className: 'cg-grid__cell--constraint-flex',
    render: (task, ctx) => {
      if (task.constraint) {
        return (
          <span
            className={`cg-badge ${task.isConstraintViolated ? 'cg-badge--violation' : 'cg-badge--constraint'}`}
            title={
              task.isConstraintViolated ? ctx.labels.constraintViolated : 'Scheduling constraint'
            }
          >
            {task.isConstraintViolated ? '⚠ ' : ''}
            {formatConstraint(task.constraint, ctx.formatDate)}
          </span>
        );
      }
      if (task.isConstraintViolated) {
        return (
          <span className="cg-badge cg-badge--violation" title={ctx.labels.floatViolated}>
            ⚠ Violated
          </span>
        );
      }
      return null;
    },
  },
];
