import type { Dependency, Task } from '@capex-gantt/core';
import { useMemo } from 'react';
import { DependencyLines } from './DependencyLines.js';
import { addCalendarDays, isWeekend } from './layout.js';
import { TaskBar } from './TaskBar.js';
import { TimelineHeader } from './TimelineHeader.js';
import type { TimeScale } from './useTimeScale.js';

export interface GanttTimelineProps {
  tasks: Task[];
  dependencies: Dependency[];
  scale: TimeScale;
  rowHeight: number;
}

/** Scrollable timeline: date header, weekend shading, task bars, and dependency arrows. */
export function GanttTimeline({ tasks, dependencies, scale, rowHeight }: GanttTimelineProps) {
  const totalDays = Math.round(scale.totalWidth / scale.pxPerDay);
  const bodyHeight = tasks.length * rowHeight;

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
        {tasks.map((task, index) => (
          <TaskBar
            key={task.id}
            task={task}
            scale={scale}
            rowHeight={rowHeight}
            top={index * rowHeight}
          />
        ))}
        <DependencyLines
          tasks={tasks}
          dependencies={dependencies}
          scale={scale}
          rowHeight={rowHeight}
        />
      </div>
    </div>
  );
}
