import { type Calendar, type Task, toISODateString } from '@capex-gantt/core';
import { HEADER_HEIGHT } from './layout.js';

export interface GanttGridProps {
  tasks: Task[];
  rowHeight: number;
  /** Project calendars, used to label tasks scheduled on a non-default calendar. */
  calendars?: Calendar[];
  /** The project's default calendar id. Tasks using it show no calendar badge. */
  defaultCalendarId?: string;
}

function formatConstraint(constraint: NonNullable<Task['constraint']>): string {
  return `${constraint.type} ${toISODateString(constraint.date)}`;
}

/** Left-hand task table: name, duration, computed dates, calendar, and constraint badges. */
export function GanttGrid({ tasks, rowHeight, calendars = [], defaultCalendarId }: GanttGridProps) {
  const calendarNameById = new Map(calendars.map((calendar) => [calendar.id, calendar.name]));

  return (
    <div className="cg-grid">
      <div className="cg-grid__row cg-grid__row--header" style={{ height: HEADER_HEIGHT }}>
        <div className="cg-grid__cell cg-grid__cell--name">Task Name</div>
        <div className="cg-grid__cell cg-grid__cell--duration">Duration</div>
        <div className="cg-grid__cell cg-grid__cell--date">Start</div>
        <div className="cg-grid__cell cg-grid__cell--date">Finish</div>
        <div className="cg-grid__cell cg-grid__cell--float">Float</div>
        <div className="cg-grid__cell cg-grid__cell--calendar">Calendar</div>
        <div className="cg-grid__cell cg-grid__cell--constraint">Constraint</div>
      </div>
      {tasks.map((task) => {
        const rowClasses = ['cg-grid__row'];
        if (task.isCritical) rowClasses.push('cg-grid__row--critical');
        if (task.isConstraintViolated) rowClasses.push('cg-grid__row--violated');

        const usesNonDefaultCalendar = !!task.calendarId && task.calendarId !== defaultCalendarId;

        return (
          <div key={task.id} className={rowClasses.join(' ')} style={{ height: rowHeight }}>
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
            <div className="cg-grid__cell cg-grid__cell--float">
              {task.totalFloatHours === undefined ? '-' : Math.round(task.totalFloatHours)}
            </div>
            <div className="cg-grid__cell cg-grid__cell--calendar">
              {usesNonDefaultCalendar && (
                <span
                  className="cg-badge cg-badge--calendar"
                  title={`Calendar: ${task.calendarId}`}
                >
                  {calendarNameById.get(task.calendarId as string) ?? task.calendarId}
                </span>
              )}
            </div>
            <div className="cg-grid__cell cg-grid__cell--constraint">
              {task.constraint && (
                <span
                  className={`cg-badge ${task.isConstraintViolated ? 'cg-badge--violation' : 'cg-badge--constraint'}`}
                  title={
                    task.isConstraintViolated
                      ? 'Constraint not met: negative float'
                      : 'Scheduling constraint'
                  }
                >
                  {task.isConstraintViolated ? '⚠ ' : ''}
                  {formatConstraint(task.constraint)}
                </span>
              )}
              {!task.constraint && task.isConstraintViolated && (
                <span className="cg-badge cg-badge--violation" title="Negative total float">
                  ⚠ Violated
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
