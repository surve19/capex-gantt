import type { Task } from '@capex-gantt/core';
import { useCallback, useMemo, useState } from 'react';
import {
  addCalendarDays,
  DEFAULT_PX_PER_DAY,
  diffCalendarDays,
  MAX_PX_PER_DAY,
  MIN_PX_PER_DAY,
  startOfDay,
} from './layout.js';

export interface TimeScale {
  /** First date shown on the timeline (padded before the earliest task start). */
  startDate: Date;
  /** Last date shown on the timeline (padded after the latest task end). */
  endDate: Date;
  /** Current horizontal zoom level, in pixels per calendar day. */
  pxPerDay: number;
  /** Total pixel width of the timeline body. */
  totalWidth: number;
  /** Converts a date to an x-offset (in px) from the start of the timeline. */
  dateToX: (date: Date) => number;
  /** Converts an x-offset (in px) back to a date. */
  xToDate: (x: number) => Date;
  zoomIn: () => void;
  zoomOut: () => void;
}

const PADDING_DAYS = 2;
const ZOOM_FACTOR = 1.5;

/**
 * Computes the date range and date<->pixel mapping for a Gantt timeline,
 * based on the earliest task start and latest task end (padded by a couple
 * of days on each side). This is the single source of truth driving the
 * timeline header, task bars, and dependency lines.
 */
export function useTimeScale(tasks: Task[]): TimeScale {
  const [pxPerDay, setPxPerDay] = useState(DEFAULT_PX_PER_DAY);

  const { startDate, endDate } = useMemo(() => {
    const starts = tasks.map((t) => t.start).filter((d): d is Date => d instanceof Date);
    const ends = tasks.map((t) => t.end).filter((d): d is Date => d instanceof Date);

    if (starts.length === 0 || ends.length === 0) {
      const today = startOfDay(new Date());
      return { startDate: today, endDate: addCalendarDays(today, 7) };
    }

    const minStart = starts.reduce((earliest, d) => (d < earliest ? d : earliest));
    const maxEnd = ends.reduce((latest, d) => (d > latest ? d : latest));

    return {
      startDate: addCalendarDays(startOfDay(minStart), -PADDING_DAYS),
      endDate: addCalendarDays(startOfDay(maxEnd), PADDING_DAYS),
    };
  }, [tasks]);

  const totalDays = Math.max(1, diffCalendarDays(startDate, endDate) + 1);
  const totalWidth = totalDays * pxPerDay;

  const dateToX = useCallback(
    (date: Date) => diffCalendarDays(startDate, date) * pxPerDay,
    [startDate, pxPerDay],
  );

  const xToDate = useCallback(
    (x: number) => addCalendarDays(startDate, Math.floor(x / pxPerDay)),
    [startDate, pxPerDay],
  );

  const zoomIn = useCallback(() => {
    setPxPerDay((px) => Math.min(MAX_PX_PER_DAY, Math.round(px * ZOOM_FACTOR)));
  }, []);

  const zoomOut = useCallback(() => {
    setPxPerDay((px) => Math.max(MIN_PX_PER_DAY, Math.round(px / ZOOM_FACTOR)));
  }, []);

  return { startDate, endDate, pxPerDay, totalWidth, dateToX, xToDate, zoomIn, zoomOut };
}
