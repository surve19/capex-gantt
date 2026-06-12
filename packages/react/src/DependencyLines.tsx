import type { Dependency, Task } from '@capex-gantt/core';
import { useMemo } from 'react';
import type { TimeScale } from './useTimeScale.js';

export interface DependencyLinesProps {
  tasks: Task[];
  dependencies: Dependency[];
  scale: TimeScale;
  rowHeight: number;
}

const MIN_ELBOW_OFFSET = 12;

/** SVG overlay drawing finish-to-start dependency arrows between task bars. */
export function DependencyLines({ tasks, dependencies, scale, rowHeight }: DependencyLinesProps) {
  const taskIndexById = useMemo(() => {
    const map = new Map<string, { task: Task; index: number }>();
    tasks.forEach((task, index) => {
      map.set(task.id, { task, index });
    });
    return map;
  }, [tasks]);

  const height = tasks.length * rowHeight;

  return (
    <svg
      className="cg-dependency-overlay"
      width={scale.totalWidth}
      height={height}
      role="img"
      aria-label="Task dependencies"
    >
      <defs>
        <marker
          id="cg-dependency-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--cg-dependency-color)" />
        </marker>
        <marker
          id="cg-dependency-arrow-critical"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--cg-dependency-color-critical)" />
        </marker>
      </defs>
      {dependencies.map((dependency) => {
        const predecessor = taskIndexById.get(dependency.predecessorId);
        const successor = taskIndexById.get(dependency.successorId);
        if (!predecessor || !successor) return null;
        if (!predecessor.task.end || !successor.task.start) return null;

        const startX = scale.dateToX(predecessor.task.end) + scale.pxPerDay;
        const startY = predecessor.index * rowHeight + rowHeight / 2;
        const endX = scale.dateToX(successor.task.start);
        const endY = successor.index * rowHeight + rowHeight / 2;

        const midX =
          endX > startX + MIN_ELBOW_OFFSET ? (startX + endX) / 2 : startX + MIN_ELBOW_OFFSET;

        const path = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;

        const isCritical = predecessor.task.isCritical && successor.task.isCritical;

        return (
          <path
            key={dependency.id}
            d={path}
            className={`cg-dependency-line${isCritical ? ' cg-dependency-line--critical' : ''}`}
            fill="none"
            markerEnd={
              isCritical ? 'url(#cg-dependency-arrow-critical)' : 'url(#cg-dependency-arrow)'
            }
          />
        );
      })}
    </svg>
  );
}
