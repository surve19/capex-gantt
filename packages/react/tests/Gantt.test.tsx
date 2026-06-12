import { createProject } from '@capex-gantt/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Gantt } from '../src/index.js';

afterEach(() => {
  cleanup();
});

function buildSchedule() {
  const project = createProject({
    id: 'p1',
    name: 'Sample',
    startDate: new Date(2024, 0, 1), // Monday
    tasks: [
      { id: 'A', name: 'Design', durationHours: 24 },
      { id: 'B', name: 'Procurement', durationHours: 16 },
      { id: 'C', name: 'Construction', durationHours: 40 },
      { id: 'D', name: 'Commissioning', durationHours: 16 },
    ],
    dependencies: [
      { id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS' },
      { id: 'd2', predecessorId: 'A', successorId: 'C', type: 'FS' },
      { id: 'd3', predecessorId: 'B', successorId: 'D', type: 'FS' },
      { id: 'd4', predecessorId: 'C', successorId: 'D', type: 'FS' },
    ],
  });

  return { ...project.schedule(), dependencies: project.getProject().dependencies };
}

describe('Gantt', () => {
  it('renders a row per task in the grid', () => {
    const { tasks, dependencies } = buildSchedule();
    render(<Gantt tasks={tasks} dependencies={dependencies} />);

    for (const task of tasks) {
      // Each task name appears twice: once in the grid row, once in the bar label.
      expect(screen.getAllByText(task.name).length).toBeGreaterThan(0);
    }
  });

  it('marks critical tasks with the critical row/bar styling', () => {
    const { tasks, dependencies } = buildSchedule();
    const { container } = render(<Gantt tasks={tasks} dependencies={dependencies} />);

    const criticalIds = new Set(tasks.filter((t) => t.isCritical).map((t) => t.id));
    expect(criticalIds.size).toBeGreaterThan(0);

    const criticalBars = container.querySelectorAll('.cg-task-bar--critical');
    expect(criticalBars).toHaveLength(criticalIds.size);

    const criticalRows = container.querySelectorAll('.cg-grid__row--critical');
    expect(criticalRows).toHaveLength(criticalIds.size);
  });

  it('renders one dependency line per FS dependency', () => {
    const { tasks, dependencies } = buildSchedule();
    const { container } = render(<Gantt tasks={tasks} dependencies={dependencies} />);

    const lines = container.querySelectorAll('.cg-dependency-line');
    expect(lines).toHaveLength(dependencies.length);
  });

  it('zoom buttons change the timeline width', () => {
    const { tasks, dependencies } = buildSchedule();
    const { container } = render(<Gantt tasks={tasks} dependencies={dependencies} />);

    const timelineBody = container.querySelector('.cg-timeline__body') as HTMLElement;
    const initialWidth = timelineBody.style.width;

    fireEvent.click(screen.getByLabelText('Zoom in'));

    expect(timelineBody.style.width).not.toBe(initialWidth);
  });
});
