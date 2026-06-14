import type { Calendar } from '@capex-gantt/core';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { GanttColumn, GanttColumnContext, GanttLabels } from './columns.js';
import { startHorizontalDrag } from './dragResize.js';
import type { TaskTreeNode } from './hierarchy.js';
import { HEADER_HEIGHT } from './layout.js';

export interface GanttGridProps {
  nodes: TaskTreeNode[];
  rowHeight: number;
  /** Project calendars, used to label tasks scheduled on a non-default calendar. */
  calendars?: Calendar[];
  /** The project's default calendar id. Tasks using it show no calendar badge. */
  defaultCalendarId?: string;
  /** Ids of summary tasks whose children are currently hidden. */
  collapsedIds: Set<string>;
  /** Toggles whether `taskId`'s children are hidden. */
  onToggleCollapse: (taskId: string) => void;
  columns: GanttColumn[];
  /** Current width (px) of each column, keyed by `column.id`. */
  columnWidths: Record<string, number>;
  /** Called with `(columnId, delta)` while a column's resize handle is dragged. */
  onColumnResize: (columnId: string, delta: number) => void;
  formatDate: (date: Date) => string;
  labels: GanttLabels;
}

/** Left-hand task table: renders `columns` as header/body cells, with resize handles and WBS-tree row state. */
export function GanttGrid({
  nodes,
  rowHeight,
  calendars = [],
  defaultCalendarId,
  collapsedIds,
  onToggleCollapse,
  columns,
  columnWidths,
  onColumnResize,
  formatDate,
  labels,
}: GanttGridProps) {
  const getWidth = (column: GanttColumn): number => columnWidths[column.id] ?? column.width ?? 100;

  const startResize = (event: ReactMouseEvent<HTMLButtonElement>, columnId: string) => {
    startHorizontalDrag(event, (delta) => onColumnResize(columnId, delta));
  };

  return (
    <div className="cg-grid">
      <div className="cg-grid__row cg-grid__row--header" style={{ height: HEADER_HEIGHT }}>
        {columns.map((column) => (
          <div
            key={column.id}
            className={['cg-grid__cell', `cg-grid__cell--${column.id}`, column.className]
              .filter(Boolean)
              .join(' ')}
            style={{
              width: getWidth(column),
              textAlign: column.align ?? 'left',
              position: 'relative',
            }}
          >
            {column.header}
            {(column.resizable ?? true) && (
              <button
                type="button"
                className="cg-grid__resize-handle"
                aria-label={`Resize ${String(column.header)} column`}
                onMouseDown={(event) => startResize(event, column.id)}
              />
            )}
          </div>
        ))}
      </div>
      {nodes.map(({ task, depth }) => {
        const rowClasses = ['cg-grid__row'];
        if (task.isCritical) rowClasses.push('cg-grid__row--critical');
        if (task.isConstraintViolated) rowClasses.push('cg-grid__row--violated');
        if (task.isSummary) rowClasses.push('cg-grid__row--summary');

        const ctx: GanttColumnContext = {
          depth,
          calendars,
          defaultCalendarId,
          formatDate,
          labels,
          isCollapsed: collapsedIds.has(task.id),
          onToggleCollapse: () => onToggleCollapse(task.id),
        };

        return (
          <div key={task.id} className={rowClasses.join(' ')} style={{ height: rowHeight }}>
            {columns.map((column) => (
              <div
                key={column.id}
                className={['cg-grid__cell', `cg-grid__cell--${column.id}`, column.className]
                  .filter(Boolean)
                  .join(' ')}
                style={{ width: getWidth(column), textAlign: column.align ?? 'left' }}
              >
                {column.render
                  ? column.render(task, ctx)
                  : String((task as unknown as Record<string, unknown>)[column.id] ?? '-')}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
