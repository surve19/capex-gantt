import { createProject } from '@capex-gantt/core';
import { Gantt } from '@capex-gantt/react';
import '@capex-gantt/react/styles.css';
import { sampleProjectInput } from './sample-data.js';

const project = createProject(sampleProjectInput);
const { tasks, projectFinish } = project.schedule();
const { dependencies } = project.getProject();

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export function App() {
  return (
    <main
      style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 1100, margin: '0 auto' }}
    >
      <h1 style={{ marginBottom: 4 }}>{sampleProjectInput.name}</h1>
      <p style={{ marginTop: 0, color: '#64748b' }}>
        Project finish: <strong>{dateFormatter.format(projectFinish)}</strong> &mdash; tasks on the
        critical path are highlighted in red.
      </p>
      <Gantt tasks={tasks} dependencies={dependencies} />
    </main>
  );
}
