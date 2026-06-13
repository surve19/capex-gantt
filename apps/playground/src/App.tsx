import { createProject } from '@capex-gantt/core';
import { Gantt } from '@capex-gantt/react';
import '@capex-gantt/react/styles.css';
import { sampleProjectInput } from './sample-data.js';

const project = createProject(sampleProjectInput);
const { tasks, projectFinish } = project.schedule();
const { dependencies, calendars, defaultCalendarId } = project.getProject();

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export function App() {
  return (
    <main
      style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 1600, margin: '0 auto' }}
    >
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
      />
      <section style={{ marginTop: 16, fontSize: 13, color: '#475569' }}>
        <strong>Phase 2 features shown above:</strong>
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
        </ul>
      </section>
    </main>
  );
}
