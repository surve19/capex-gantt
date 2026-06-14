import type { Dependency } from '@capex-gantt/core';
import { useMemo } from 'react';
import type { GanttLabels } from './columns.js';
import { DependencyLines } from './DependencyLines.js';
import type { TaskTreeNode } from './hierarchy.js';
import { addCalendarDays, isWeekend } from './layout.js';
import { TaskBar } from './TaskBar.js';
import { TimelineHeader } from './TimelineHeader.js';
import type { TimeScale } from './useTimeScale.js';

export interface GanttTimelineProps {
  nodes: TaskTreeNode[];
  dependencies: Dependency[];
  scale: TimeScale;
  rowHeight: number;
  formatDate: (date: Date) => string;
  labels: GanttLabels;
}

/** Scrollable timeline: date header, weekend shading, task bars, and dependency arrows. */
export function GanttTimeline({
  nodes,
  dependencies,
  scale,
  rowHeight,
  formatDate,
  labels,
}: GanttTimelineProps) {
  const totalDays = Math.round(scale.totalWidth / scale.pxPerDay);
  const bodyHeight = nodes.length * rowHeight;

  const weekendColumns = useMemo(() => {
    const columns: number[] = [];
    for (let i = 0; i < totalDays; i++) {
      if (isWeekend(addCalendarDays(scale.startDate, i))) columns.push(i);
    }
    return columns;
  }, [scale.startDate, totalDays]);

  return (
    <div className="cg-timeline">
      <TimelineHeader scale={scale} />
      <div className="cg-timeline__body" style={{ width: scale.totalWidth, height: bodyHeight }}>
        {weekendColumns.map((dayIndex) => (
          <div
            key={dayIndex}
            className="cg-timeline__weekend-column"
            style={{ left: dayIndex * scale.pxPerDay, width: scale.pxPerDay, height: bodyHeight }}
          />
        ))}
        {nodes.map(({ task }, index) => (
          <TaskBar
            key={task.id}
            task={task}
            scale={scale}
            rowHeight={rowHeight}
            top={index * rowHeight}
            formatDate={formatDate}
            labels={labels}
          />
        ))}
        <DependencyLines
          nodes={nodes}
          dependencies={dependencies}
          scale={scale}
          rowHeight={rowHeight}
        />
      </div>
    </div>
  );
}
