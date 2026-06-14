import type { Task } from '@capex-gantt/core';
import type { GanttLabels } from './columns.js';
import { diffCalendarDays } from './layout.js';
import type { TimeScale } from './useTimeScale.js';

export interface TaskBarProps {
  task: Task;
  scale: TimeScale;
  rowHeight: number;
  top: number;
  formatDate: (date: Date) => string;
  labels: GanttLabels;
}

const BAR_VERTICAL_PADDING = 8;
const BAR_GAP = 4;
const BASELINE_HEIGHT = 4;

/** Computes the left offset and width (in px) of a bar spanning `start` to `end`. */
function barGeometry(scale: TimeScale, start: Date, end: Date): { left: number; width: number } {
  const left = scale.dateToX(start);
  const spanDays = diffCalendarDays(start, end) + 1;
  const width = Math.max(scale.pxPerDay * 0.5, spanDays * scale.pxPerDay - BAR_GAP);
  return { left, width };
}

/** A single absolutely-positioned task bar, highlighted when the task is on the critical path. */
export function TaskBar({ task, scale, rowHeight, top, formatDate, labels }: TaskBarProps) {
  if (!task.start || !task.end) return null;

  const { left, width } = barGeometry(scale, task.start, task.end);
  const baselineGeometry = task.baseline
    ? barGeometry(scale, task.baseline.start, task.baseline.finish)
    : null;

  const baselineLine = task.baseline
    ? `\n${labels.baselineLabel}: ${formatDate(task.baseline.start)} → ${formatDate(task.baseline.finish)}`
    : '';
  const varianceLine =
    task.finishVarianceHours !== undefined && task.finishVarianceHours !== 0
      ? `\n${labels.varianceLabel}: ${task.finishVarianceHours > 0 ? '+' : ''}${task.finishVarianceHours}h`
      : '';
  const constraintLine = task.constraint
    ? `\n${labels.constraintLabel}: ${task.constraint.type} ${formatDate(task.constraint.date)}`
    : '';
  const violationLine = task.isConstraintViolated ? '\n⚠ Constraint violated' : '';
  const title = `${task.name}\n${formatDate(task.start)} → ${formatDate(task.end)}\n${labels.floatLabel}: ${task.totalFloatHours ?? 0}h${baselineLine}${varianceLine}${constraintLine}${violationLine}`;

  const barClasses = ['cg-task-bar'];
  if (task.isCritical) barClasses.push('cg-task-bar--critical');
  if (task.isConstraintViolated) barClasses.push('cg-task-bar--violated');
  if (task.isSummary) barClasses.push('cg-task-bar--summary');

  const fullHeight = rowHeight - BAR_VERTICAL_PADDING;
  const barHeight = task.isSummary ? fullHeight * 0.6 : fullHeight;

  return (
    <>
      <div
        className={barClasses.join(' ')}
        style={{
          left,
          top: top + (rowHeight - barHeight) / 2,
          width,
          height: barHeight,
        }}
        title={title}
      >
        <span className="cg-task-bar__label">{task.name}</span>
      </div>
      {baselineGeometry && (
        <div
          className="cg-task-bar__baseline"
          style={{
            left: baselineGeometry.left,
            top: top + rowHeight - BASELINE_HEIGHT,
            width: baselineGeometry.width,
            height: BASELINE_HEIGHT,
          }}
          title={title}
        />
      )}
    </>
  );
}
