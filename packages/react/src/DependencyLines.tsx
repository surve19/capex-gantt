import type { Dependency, Task } from '@capex-gantt/core';
import { useMemo } from 'react';
import type { TaskTreeNode } from './hierarchy.js';
import type { TimeScale } from './useTimeScale.js';

export interface DependencyLinesProps {
  nodes: TaskTreeNode[];
  dependencies: Dependency[];
  scale: TimeScale;
  rowHeight: number;
}

const MIN_ELBOW_OFFSET = 12;

/** SVG overlay drawing dependency arrows between task bars, routed per dependency type (FS/SS/FF/SF). */
export function DependencyLines({ nodes, dependencies, scale, rowHeight }: DependencyLinesProps) {
  const taskIndexById = useMemo(() => {
    const map = new Map<string, { task: Task; index: number }>();
    nodes.forEach(({ task }, index) => {
      map.set(task.id, { task, index });
    });
    return map;
  }, [nodes]);

  const height = nodes.length * rowHeight;

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
        if (
          !predecessor.task.start ||
          !predecessor.task.end ||
          !successor.task.start ||
          !successor.task.end
        ) {
          return null;
        }

        // The anchor for a "finish" endpoint sits one day past `end` (the
        // visual right edge of the bar, matching TaskBar's width formula);
        // a "start" endpoint sits at the bar's left edge.
        const startX =
          dependency.type === 'SS' || dependency.type === 'SF'
            ? scale.dateToX(predecessor.task.start)
            : scale.dateToX(predecessor.task.end) + scale.pxPerDay;
        const startY = predecessor.index * rowHeight + rowHeight / 2;
        const endX =
          dependency.type === 'FF' || dependency.type === 'SF'
            ? scale.dateToX(successor.task.end) + scale.pxPerDay
            : scale.dateToX(successor.task.start);
        const endY = successor.index * rowHeight + rowHeight / 2;

        const midX =
          endX > startX + MIN_ELBOW_OFFSET ? (startX + endX) / 2 : startX + MIN_ELBOW_OFFSET;

        const path = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;

        const isCritical = predecessor.task.isCritical && successor.task.isCritical;
        const typeClass = `cg-dependency-line--${dependency.type.toLowerCase()}`;
        const lag = dependency.lagHours ?? 0;

        return (
          <path
            key={dependency.id}
            d={path}
            className={`cg-dependency-line ${typeClass}${isCritical ? ' cg-dependency-line--critical' : ''}`}
            fill="none"
            markerEnd={
              isCritical ? 'url(#cg-dependency-arrow-critical)' : 'url(#cg-dependency-arrow)'
            }
          >
            <title>
              {dependency.type}
              {lag !== 0 ? ` ${lag > 0 ? '+' : ''}${lag}h` : ''}
            </title>
          </path>
        );
      })}
    </svg>
  );
}
