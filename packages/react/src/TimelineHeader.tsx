import { useMemo } from 'react';
import { addCalendarDays, HEADER_HEIGHT, isWeekend } from './layout.js';
import type { TimeScale } from './useTimeScale.js';

export interface TimelineHeaderProps {
  scale: TimeScale;
}

interface MonthGroup {
  label: string;
  days: number;
}

const MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' };

/** Renders a two-row date header: month/year groups above, day numbers below. */
export function TimelineHeader({ scale }: TimelineHeaderProps) {
  const totalDays = Math.round(scale.totalWidth / scale.pxPerDay);

  const days = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => addCalendarDays(scale.startDate, i)),
    [scale.startDate, totalDays],
  );

  const monthGroups = useMemo(() => {
    const groups: MonthGroup[] = [];
    for (const day of days) {
      const label = day.toLocaleDateString(undefined, MONTH_FORMAT);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.days += 1;
      } else {
        groups.push({ label, days: 1 });
      }
    }
    return groups;
  }, [days]);

  return (
    <div className="cg-timeline-header" style={{ width: scale.totalWidth, height: HEADER_HEIGHT }}>
      <div className="cg-timeline-header__row cg-timeline-header__row--months">
        {monthGroups.map((group) => (
          <div
            key={`${group.label}-${group.days}`}
            className="cg-timeline-header__month"
            style={{ width: group.days * scale.pxPerDay }}
          >
            {group.label}
          </div>
        ))}
      </div>
      <div className="cg-timeline-header__row cg-timeline-header__row--days">
        {days.map((day) => (
          <div
            key={day.getTime()}
            className={`cg-timeline-header__day${isWeekend(day) ? ' cg-timeline-header__day--weekend' : ''}`}
            style={{ width: scale.pxPerDay }}
          >
            {day.getDate()}
          </div>
        ))}
      </div>
    </div>
  );
}
