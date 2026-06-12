import { type Task, toISODateString } from '@capex-gantt/core';
import { HEADER_HEIGHT } from './layout.js';

export interface GanttGridProps {
  tasks: Task[];
  rowHeight: number;
}

/** Left-hand task table: name, duration, and computed start/finish dates. */
export function GanttGrid({ tasks, rowHeight }: GanttGridProps) {
  return (
    <div className="cg-grid">
      <div className="cg-grid__row cg-grid__row--header" style={{ height: HEADER_HEIGHT }}>
        <div className="cg-grid__cell cg-grid__cell--name">Task Name</div>
        <div className="cg-grid__cell cg-grid__cell--duration">Duration</div>
        <div className="cg-grid__cell cg-grid__cell--date">Start</div>
        <div className="cg-grid__cell cg-grid__cell--date">Finish</div>
        <div className="cg-grid__cell cg-grid__cell--float">Float</div>
      </div>
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`cg-grid__row${task.isCritical ? ' cg-grid__row--critical' : ''}`}
          style={{ height: rowHeight }}
        >
          <div className="cg-grid__cell cg-grid__cell--name" title={task.name}>
            {task.name}
          </div>
          <div className="cg-grid__cell cg-grid__cell--duration">{task.durationHours}h</div>
          <div className="cg-grid__cell cg-grid__cell--date">
            {task.start ? toISODateString(task.start) : '-'}
          </div>
          <div className="cg-grid__cell cg-grid__cell--date">
            {task.end ? toISODateString(task.end) : '-'}
          </div>
          <div className="cg-grid__cell cg-grid__cell--float">{task.totalFloatHours ?? '-'}</div>
        </div>
      ))}
    </div>
  );
}
