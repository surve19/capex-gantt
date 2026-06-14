import { createProject } from '@capex-gantt/core';
import { Gantt } from '@capex-gantt/react';
import '@capex-gantt/react/styles.css';
import { sampleProjectInput } from './sample-data.js';

const project = createProject(sampleProjectInput);
project.schedule();
project.setBaseline();

// Simulate a post-baseline change: "Civil Design" picks up 16h of extra work
// (e.g. a design revision). Its float absorbs the slip without affecting the
// critical path, but the finish variance is now visible on the timeline and
// in the grid.
const civilDesign = project.getProject().tasks.find((task) => task.id === 'B');
if (civilDesign) {
  civilDesign.durationHours += 16;
}

const { tasks, projectFinish } = project.schedule();
const { dependencies, calendars, defaultCalendarId } = project.getProject();

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1 style={{ marginBottom: 4 }}>{sampleProjectInput.name}</h1>
      <p style={{ marginTop: 0, color: '#64748b' }}>
        Project finish: <strong>{dateFormatter.format(projectFinish)}</strong> &mdash; tasks on the
        critical path are highlighted in red.
      </p>
      <Gantt
        tasks={tasks}
        dependencies={dependencies}
        calendars={calendars}
        defaultCalendarId={defaultCalendarId}
        formatDate={(date) => dateFormatter.format(date)}
        toolbarExtra={
          <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>
            Drag a column's right edge to resize it
          </span>
        }
      />
      <section style={{ marginTop: 16, fontSize: 13, color: '#475569' }}>
        <strong>Phase 2 &amp; 3 features shown above:</strong>
        <ul style={{ marginTop: 4, paddingLeft: 20, lineHeight: 1.6 }}>
          <li>
            <span className="cg-badge cg-badge--calendar">Procurement (24/7)</span> &mdash;
            "Equipment Procurement" runs on its own 24/7 calendar instead of the project's default
            Mon&ndash;Fri calendar; its dependencies are converted between calendars.
          </li>
          <li>
            <span className="cg-badge cg-badge--constraint">FNLT 2024-01-11</span> &mdash;
            "Permitting &amp; Approvals" has a finish-no-later-than constraint.
          </li>
          <li>
            <span className="cg-badge cg-badge--violation">⚠ Violated</span> / amber row &mdash;
            that constraint can't be met, producing negative float that ripples back to "Site Survey
            &amp; Mobilization" too.
          </li>
          <li>
            Dependency line style &mdash; solid = Finish-to-Start, dashed = Start-to-Start, dotted =
            Finish-to-Finish, dash-dot = Start-to-Finish (hover a line for details).
          </li>
          <li>
            Gray ghost bar / <span className="cg-variance--late">+16</span> Variance &mdash; "Civil
            Design" picked up 16h of extra work after the baseline was set. The ghost bar shows its
            original (baselined) schedule, and the Variance column shows its finish slipped by 16
            working hours (orange = late, green = early, "-" = no baseline).
          </li>
        </ul>
        <strong>Phase 4 features shown above:</strong>
        <ul style={{ marginTop: 4, paddingLeft: 20, lineHeight: 1.6 }}>
          <li>
            WBS column &mdash; auto-numbered codes (<code>1</code>, <code>2</code>, <code>2.1</code>
            &ndash;<code>2.3</code>, <code>3</code>, <code>3.1</code>&ndash;
            <code>3.4</code>) reflect each task's position in the work-breakdown structure.
          </li>
          <li>
            Collapsible groups &mdash; click the chevron next to "Engineering" or "Procurement &amp;
            Construction" to hide/show their child tasks in both the grid and the timeline.
          </li>
          <li>
            Summary bars &mdash; "Engineering" and "Procurement &amp; Construction" render as
            darker, thinner bars spanning their children's earliest start to latest finish. Their
            rolled-up duration is computed on the summary's own (default) calendar, even where a
            child like "Equipment Procurement" runs on a different 24/7 calendar.
          </li>
          <li>Resizable columns &mdash; drag any column header's right edge to resize it.</li>
          <li>
            Hierarchy, grouping, and WBS numbering are free and open-source here &mdash; several
            commercial Gantt libraries gate these behind a paid tier.
          </li>
        </ul>
      </section>
    </main>
  );
}
