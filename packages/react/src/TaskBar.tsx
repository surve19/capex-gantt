import { type Task, toISODateString } from '@capex-gantt/core';
import { diffCalendarDays } from './layout.js';
import type { TimeScale } from './useTimeScale.js';

export interface TaskBarProps {
  task: Task;
  scale: TimeScale;
  rowHeight: number;
  top: number;
}

const BAR_VERTICAL_PADDING = 8;
const BAR_GAP = 4;

/** A single absolutely-positioned task bar, highlighted when the task is on the critical path. */
export function TaskBar({ task, scale, rowHeight, top }: TaskBarProps) {
  if (!task.start || !task.end) return null;

  const left = scale.dateToX(task.start);
  const spanDays = diffCalendarDays(task.start, task.end) + 1;
  const width = Math.max(scale.pxPerDay * 0.5, spanDays * scale.pxPerDay - BAR_GAP);

  const constraintLine = task.constraint
    ? `\nConstraint: ${task.constraint.type} ${toISODateString(task.constraint.date)}`
    : '';
  const violationLine = task.isConstraintViolated ? '\n⚠ Constraint violated' : '';
  const title = `${task.name}\n${toISODateString(task.start)} → ${toISODateString(task.end)}\nFloat: ${task.totalFloatHours ?? 0}h${constraintLine}${violationLine}`;

  const barClasses = ['cg-task-bar'];
  if (task.isCritical) barClasses.push('cg-task-bar--critical');
  if (task.isConstraintViolated) barClasses.push('cg-task-bar--violated');

  return (
    <div
      className={barClasses.join(' ')}
      style={{
        left,
        top: top + BAR_VERTICAL_PADDING / 2,
        width,
        height: rowHeight - BAR_VERTICAL_PADDING,
      }}
      title={title}
    >
      <span className="cg-task-bar__label">{task.name}</span>
    </div>
  );
}
