import { type Calendar, type Dependency, type Task, toISODateString } from '@capex-gantt/core';
import { type ReactNode, useMemo, useState } from 'react';
import { DEFAULT_COLUMNS, DEFAULT_LABELS, type GanttColumn, type GanttLabels } from './columns.js';
import { startHorizontalDrag } from './dragResize.js';
import { GanttGrid } from './GanttGrid.js';
import { GanttTimeline } from './GanttTimeline.js';
import { buildVisibleTasks } from './hierarchy.js';
import { DEFAULT_ROW_HEIGHT, MIN_COLUMN_WIDTH } from './layout.js';
import { useTimeScale } from './useTimeScale.js';

export interface GanttProps {
  /** Scheduled tasks (i.e. `project.schedule().tasks`), with computed start/end/float/isCritical fields. */
  tasks: Task[];
  /** Finish-to-start dependencies, rendered as arrows between bars. */
  dependencies?: Dependency[];
  /** Project calendars, used to label tasks scheduled on a non-default calendar. */
  calendars?: Calendar[];
  /** The project's default calendar id. Tasks using it show no calendar badge. */
  defaultCalendarId?: string;
  /** Row height in pixels. Defaults to 36. */
  rowHeight?: number;
  /** Grid column definitions. Defaults to `DEFAULT_COLUMNS`. */
  columns?: GanttColumn[];
  /** Formats dates shown in the grid and task bar tooltips. Defaults to `toISODateString`. */
  formatDate?: (date: Date) => string;
  /** Overrides for tooltip/badge strings, merged with `DEFAULT_LABELS`. */
  labels?: Partial<GanttLabels>;
  /** Extra content rendered in the toolbar, after the zoom buttons. */
  toolbarExtra?: ReactNode;
  className?: string;
}

/** A Gantt chart: task grid on the left, scrollable timeline with bars and dependency arrows on the right. */
export function Gantt({
  tasks,
  dependencies = [],
  calendars,
  defaultCalendarId,
  rowHeight = DEFAULT_ROW_HEIGHT,
  columns,
  formatDate,
  labels,
  toolbarExtra,
  className,
}: GanttProps) {
  const scale = useTimeScale(tasks);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<string>>(() => new Set());

  const resolvedColumns = columns ?? DEFAULT_COLUMNS;
  const resolvedFormatDate = formatDate ?? toISODateString;
  const resolvedLabels = useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
  const displayedColumns = useMemo(
    () => resolvedColumns.filter((column) => !hiddenColumnIds.has(column.id)),
    [resolvedColumns, hiddenColumnIds],
  );

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(resolvedColumns.map((column) => [column.id, column.width ?? 100])),
  );

  const toggleCollapsed = (taskId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleColumnResize = (columnId: string, delta: number) => {
    setColumnWidths((prev) => {
      const column = resolvedColumns.find((c) => c.id === columnId);
      const current = prev[columnId] ?? column?.width ?? 100;
      return { ...prev, [columnId]: Math.max(MIN_COLUMN_WIDTH, current + delta) };
    });
  };

  const toggleColumnVisibility = (columnId: string) => {
    setHiddenColumnIds((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else if (resolvedColumns.length - next.size > 1) {
        // Always leave at least one column visible.
        next.add(columnId);
      }
      return next;
    });
  };

  const handleSplitterResize = (delta: number) => {
    setColumnWidths((prev) => {
      const currentTotal = displayedColumns.reduce(
        (sum, column) => sum + (prev[column.id] ?? column.width ?? 100),
        0,
      );
      if (currentTotal <= 0) return prev;

      const targetTotal = Math.max(
        MIN_COLUMN_WIDTH * displayedColumns.length,
        currentTotal + delta,
      );
      const scale = targetTotal / currentTotal;

      const next = { ...prev };
      for (const column of displayedColumns) {
        const current = prev[column.id] ?? column.width ?? 100;
        next[column.id] = Math.max(MIN_COLUMN_WIDTH, current * scale);
      }
      return next;
    });
  };

  const visibleNodes = useMemo(() => buildVisibleTasks(tasks, collapsedIds), [tasks, collapsedIds]);

  return (
    <div className={`cg-gantt${className ? ` ${className}` : ''}`}>
      <div className="cg-gantt__toolbar">
        <details className="cg-gantt__column-picker">
          <summary>Columns</summary>
          <div className="cg-gantt__column-picker-menu">
            {resolvedColumns.map((column) => (
              <label key={column.id} className="cg-gantt__column-picker-item">
                <input
                  type="checkbox"
                  checked={!hiddenColumnIds.has(column.id)}
                  onChange={() => toggleColumnVisibility(column.id)}
                />
                {typeof column.header === 'string' ? column.header : column.id}
              </label>
            ))}
          </div>
        </details>
        <button
          type="button"
          className="cg-gantt__zoom-button"
          onClick={scale.zoomOut}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="cg-gantt__zoom-button"
          onClick={scale.zoomIn}
          aria-label="Zoom in"
        >
          +
        </button>
        {toolbarExtra}
      </div>
      <div className="cg-gantt__body">
        <GanttGrid
          nodes={visibleNodes}
          rowHeight={rowHeight}
          calendars={calendars}
          defaultCalendarId={defaultCalendarId}
          collapsedIds={collapsedIds}
          onToggleCollapse={toggleCollapsed}
          columns={displayedColumns}
          columnWidths={columnWidths}
          onColumnResize={handleColumnResize}
          formatDate={resolvedFormatDate}
          labels={resolvedLabels}
        />
        <button
          type="button"
          className="cg-gantt__splitter"
          aria-label="Resize columns panel"
          onMouseDown={(event) => startHorizontalDrag(event, handleSplitterResize)}
        />
        <div className="cg-gantt__timeline-scroll">
          <GanttTimeline
            nodes={visibleNodes}
            dependencies={dependencies}
            scale={scale}
            rowHeight={rowHeight}
            formatDate={resolvedFormatDate}
            labels={resolvedLabels}
          />
        </div>
      </div>
    </div>
  );
}
