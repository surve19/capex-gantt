import { createProject } from '@capex-gantt/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_COLUMNS, Gantt, type GanttColumn } from '../src/index.js';
import { MIN_COLUMN_WIDTH } from '../src/layout.js';

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

// A(24h) -> B(16h) \
//         \           -> D(16h)
//           -> C(40h) /
// P is a summary task (parentId) grouping B and C.
function buildHierarchicalSchedule() {
  const project = createProject({
    id: 'p2',
    name: 'Hierarchical Sample',
    startDate: new Date(2024, 0, 1), // Monday
    tasks: [
      { id: 'A', name: 'Design', durationHours: 24 },
      { id: 'P', name: 'Engineering', durationHours: 0 },
      { id: 'B', name: 'Procurement', durationHours: 16, parentId: 'P' },
      { id: 'C', name: 'Construction', durationHours: 40, parentId: 'P' },
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

describe('Gantt with WBS hierarchy', () => {
  it('shows auto-numbered WBS codes for top-level and nested tasks', () => {
    const { tasks, dependencies } = buildHierarchicalSchedule();
    const { container } = render(<Gantt tasks={tasks} dependencies={dependencies} />);

    const wbsCells = Array.from(container.querySelectorAll('.cg-grid__cell--wbs'));
    expect(wbsCells.map((cell) => cell.textContent)).toEqual(['WBS', '1', '2', '2.1', '2.2', '3']);
  });

  it('renders a chevron for summary rows, marks them as cg-grid__row--summary, and indents children', () => {
    const { tasks, dependencies } = buildHierarchicalSchedule();
    const { container } = render(<Gantt tasks={tasks} dependencies={dependencies} />);

    expect(screen.getByLabelText('Collapse Engineering')).toBeInTheDocument();
    expect(container.querySelectorAll('.cg-grid__row--summary')).toHaveLength(1);

    const nameContentFor = (text: string) =>
      Array.from(container.querySelectorAll('.cg-grid__cell-text'))
        .find((el) => el.textContent === text)
        ?.closest('.cg-grid__name-content') as HTMLElement;

    expect(nameContentFor('Procurement').style.paddingLeft).toBe('16px');
    expect(nameContentFor('Design').style.paddingLeft).toBe('0px');
  });

  it('renders summary task bars with the summary variant class and "-" for Float', () => {
    const { tasks, dependencies } = buildHierarchicalSchedule();
    const { container } = render(<Gantt tasks={tasks} dependencies={dependencies} />);

    expect(container.querySelectorAll('.cg-task-bar--summary')).toHaveLength(1);

    const summaryRow = container.querySelector('.cg-grid__row--summary') as HTMLElement;
    const floatCell = summaryRow.querySelector('.cg-grid__cell--float') as HTMLElement;
    expect(floatCell.textContent).toBe('-');
  });

  it('clicking the chevron collapses and re-expands children in both grid and timeline', () => {
    const { tasks, dependencies } = buildHierarchicalSchedule();
    const { container } = render(<Gantt tasks={tasks} dependencies={dependencies} />);

    const rowCount = () =>
      container.querySelectorAll('.cg-grid__row:not(.cg-grid__row--header)').length;
    const barCount = () => container.querySelectorAll('.cg-task-bar').length;

    expect(rowCount()).toBe(tasks.length);
    expect(barCount()).toBe(tasks.length);

    fireEvent.click(screen.getByLabelText('Collapse Engineering'));

    // B and C (children of the Engineering summary) are now hidden.
    expect(rowCount()).toBe(tasks.length - 2);
    expect(barCount()).toBe(tasks.length - 2);
    expect(rowCount()).toBe(barCount());

    fireEvent.click(screen.getByLabelText('Expand Engineering'));

    expect(rowCount()).toBe(tasks.length);
    expect(barCount()).toBe(tasks.length);
  });
});

describe('Gantt column customization', () => {
  const headerCells = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('.cg-grid__row--header .cg-grid__cell'));

  it('renders one header cell per DEFAULT_COLUMNS entry', () => {
    const { tasks, dependencies } = buildSchedule();
    const { container } = render(<Gantt tasks={tasks} dependencies={dependencies} />);

    expect(headerCells(container)).toHaveLength(DEFAULT_COLUMNS.length);
  });

  it('renders a custom subset/reordered column set', () => {
    const { tasks, dependencies } = buildSchedule();
    const columns: GanttColumn[] = [
      { id: 'name', header: 'Task' },
      { id: 'duration', header: 'Hours' },
    ];
    const { container } = render(
      <Gantt tasks={tasks} dependencies={dependencies} columns={columns} />,
    );

    expect(headerCells(container).map((cell) => cell.textContent)).toEqual(['Task', 'Hours']);
  });

  it('invokes a custom render function for a column', () => {
    const { tasks, dependencies } = buildSchedule();
    const columns: GanttColumn[] = [
      { id: 'name', header: 'Task', render: (task) => `Custom: ${task.name}` },
    ];
    render(<Gantt tasks={tasks} dependencies={dependencies} columns={columns} />);

    expect(screen.getByText(`Custom: ${tasks[0].name}`)).toBeInTheDocument();
  });

  it('seeds initial column width from columns[].width', () => {
    const { tasks, dependencies } = buildSchedule();
    const columns: GanttColumn[] = [{ id: 'name', header: 'Task', width: 222 }];
    const { container } = render(
      <Gantt tasks={tasks} dependencies={dependencies} columns={columns} />,
    );

    const headerCell = container.querySelector('.cg-grid__cell--name') as HTMLElement;
    expect(headerCell.style.width).toBe('222px');
  });

  it('uses a custom formatDate for Start/Finish cells', () => {
    const { tasks, dependencies } = buildSchedule();
    const formatDate = (date: Date) => `D${date.getDate()}`;
    const { container } = render(
      <Gantt tasks={tasks} dependencies={dependencies} formatDate={formatDate} />,
    );

    const startCell = container.querySelector(
      '.cg-grid__row:not(.cg-grid__row--header) .cg-grid__cell--start',
    ) as HTMLElement;
    expect(startCell.textContent).toMatch(/^D\d+$/);
  });

  it('applies a labels override to task bar tooltips', () => {
    const { tasks, dependencies } = buildSchedule();
    const { container } = render(
      <Gantt tasks={tasks} dependencies={dependencies} labels={{ floatLabel: 'Slack' }} />,
    );

    const bar = container.querySelector('.cg-task-bar') as HTMLElement;
    expect(bar.title).toContain('Slack:');
    expect(bar.title).not.toContain('Float:');
  });

  it('renders toolbarExtra inside the toolbar', () => {
    const { tasks, dependencies } = buildSchedule();
    const { container } = render(
      <Gantt tasks={tasks} dependencies={dependencies} toolbarExtra={<span>Extra control</span>} />,
    );

    const toolbar = container.querySelector('.cg-gantt__toolbar') as HTMLElement;
    expect(toolbar.textContent).toContain('Extra control');
  });

  it('resizes a column by dragging its handle, clamped to MIN_COLUMN_WIDTH', () => {
    const { tasks, dependencies } = buildSchedule();
    const { container } = render(<Gantt tasks={tasks} dependencies={dependencies} />);

    const nameHeaderCell = container.querySelector('.cg-grid__cell--name') as HTMLElement;
    const handle = nameHeaderCell.querySelector('.cg-grid__resize-handle') as HTMLElement;
    const initialWidth = Number.parseFloat(nameHeaderCell.style.width);

    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 150 });
    fireEvent.mouseUp(window);

    expect(Number.parseFloat(nameHeaderCell.style.width)).toBeCloseTo(initialWidth + 50);

    fireEvent.mouseDown(handle, { clientX: 150 });
    fireEvent.mouseMove(window, { clientX: -1000 });
    fireEvent.mouseUp(window);

    expect(Number.parseFloat(nameHeaderCell.style.width)).toBe(MIN_COLUMN_WIDTH);
  });

  it('drags the grid/timeline splitter to proportionally rescale visible columns', () => {
    const { tasks, dependencies } = buildSchedule();
    const { container } = render(<Gantt tasks={tasks} dependencies={dependencies} />);

    const widthsBefore = headerCells(container).map((cell) =>
      Number.parseFloat((cell as HTMLElement).style.width),
    );

    const splitter = container.querySelector('.cg-gantt__splitter') as HTMLElement;
    fireEvent.mouseDown(splitter, { clientX: 500 });
    fireEvent.mouseMove(window, { clientX: 600 });
    fireEvent.mouseUp(window);

    const widthsAfter = headerCells(container).map((cell) =>
      Number.parseFloat((cell as HTMLElement).style.width),
    );

    const totalBefore = widthsBefore.reduce((sum, w) => sum + w, 0);
    const totalAfter = widthsAfter.reduce((sum, w) => sum + w, 0);
    expect(totalAfter).toBeCloseTo(totalBefore + 100);

    // Every column grows proportionally (none shrinks).
    for (let i = 0; i < widthsBefore.length; i++) {
      expect(widthsAfter[i]).toBeGreaterThan(widthsBefore[i]);
    }
  });

  it('dragging the splitter far left clamps each (equal-width) column to MIN_COLUMN_WIDTH', () => {
    const { tasks, dependencies } = buildSchedule();
    const columns: GanttColumn[] = [
      { id: 'name', header: 'Task', width: 100 },
      { id: 'duration', header: 'Hours', width: 100 },
      { id: 'start', header: 'Start', width: 100 },
    ];
    const { container } = render(
      <Gantt tasks={tasks} dependencies={dependencies} columns={columns} />,
    );

    const splitter = container.querySelector('.cg-gantt__splitter') as HTMLElement;
    fireEvent.mouseDown(splitter, { clientX: 1000 });
    fireEvent.mouseMove(window, { clientX: -10000 });
    fireEvent.mouseUp(window);

    for (const cell of headerCells(container)) {
      expect(Number.parseFloat((cell as HTMLElement).style.width)).toBe(MIN_COLUMN_WIDTH);
    }
  });
});

describe('Gantt column visibility picker', () => {
  const headerCells = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('.cg-grid__row--header .cg-grid__cell'));

  it('lists all columns as checked checkboxes by default', () => {
    const { tasks, dependencies } = buildSchedule();
    render(<Gantt tasks={tasks} dependencies={dependencies} />);

    for (const column of DEFAULT_COLUMNS) {
      const checkbox = screen.getByLabelText(String(column.header)) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    }
  });

  it('unchecking a column hides it from the grid', () => {
    const { tasks, dependencies } = buildSchedule();
    const { container } = render(<Gantt tasks={tasks} dependencies={dependencies} />);

    expect(headerCells(container)).toHaveLength(DEFAULT_COLUMNS.length);

    fireEvent.click(screen.getByLabelText('Variance'));

    expect(headerCells(container)).toHaveLength(DEFAULT_COLUMNS.length - 1);
    expect(container.querySelector('.cg-grid__cell--variance')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Variance'));

    expect(headerCells(container)).toHaveLength(DEFAULT_COLUMNS.length);
  });

  it('refuses to hide the last visible column', () => {
    const { tasks, dependencies } = buildSchedule();
    const columns: GanttColumn[] = [{ id: 'name', header: 'Task' }];
    const { container } = render(
      <Gantt tasks={tasks} dependencies={dependencies} columns={columns} />,
    );

    expect(headerCells(container)).toHaveLength(1);

    fireEvent.click(screen.getByLabelText('Task'));

    expect(headerCells(container)).toHaveLength(1);
  });
});
