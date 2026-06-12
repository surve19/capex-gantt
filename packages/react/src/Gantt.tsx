import type { Dependency, Task } from '@capex-gantt/core';
import { GanttGrid } from './GanttGrid.js';
import { GanttTimeline } from './GanttTimeline.js';
import { DEFAULT_ROW_HEIGHT } from './layout.js';
import { useTimeScale } from './useTimeScale.js';

export interface GanttProps {
  /** Scheduled tasks (i.e. `project.schedule().tasks`), with computed start/end/float/isCritical fields. */
  tasks: Task[];
  /** Finish-to-start dependencies, rendered as arrows between bars. */
  dependencies?: Dependency[];
  /** Row height in pixels. Defaults to 36. */
  rowHeight?: number;
  className?: string;
}

/** A Gantt chart: task grid on the left, scrollable timeline with bars and dependency arrows on the right. */
export function Gantt({
  tasks,
  dependencies = [],
  rowHeight = DEFAULT_ROW_HEIGHT,
  className,
}: GanttProps) {
  const scale = useTimeScale(tasks);

  return (
    <div className={`cg-gantt${className ? ` ${className}` : ''}`}>
      <div className="cg-gantt__toolbar">
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
      </div>
      <div className="cg-gantt__body">
        <GanttGrid tasks={tasks} rowHeight={rowHeight} />
        <div className="cg-gantt__timeline-scroll">
          <GanttTimeline
            tasks={tasks}
            dependencies={dependencies}
            scale={scale}
            rowHeight={rowHeight}
          />
        </div>
      </div>
    </div>
  );
}
