# capex-gantt

Open-source, TypeScript-first project controls and Gantt scheduling library for
CAPEX, EPC, infrastructure, and construction projects.

This is an early-stage project. The goal is to bring project-controls concepts —
working-day calendars, dependency types (FS/SS/FF/SF), critical path method (CPM)
scheduling, baselines, progress tracking, resource loading, and earned value
management — into an open, framework-agnostic core with adapters for React, Vue,
and Svelte.

## Packages

- [`@capex-gantt/core`](./packages/core) — framework-agnostic data model, calendar
  engine, and CPM scheduling engine.
- [`@capex-gantt/react`](./packages/react) — React Gantt chart component.
- [`apps/playground`](./apps/playground) — local dev playground for trying out the
  library against sample project data.

## Development

This is a pnpm workspace managed with Turborepo.

```bash
pnpm install
pnpm build
pnpm test
pnpm --filter playground dev
```

## Status

Phase 1 (MVP): single working-day calendar, finish-to-start dependencies with lag,
CPM forward/backward pass with total float and critical path, and a minimal React
Gantt renderer (grid + timeline + dependency arrows + critical path highlighting).

See the project roadmap for planned phases: multi-calendar support, SS/FF/SF
dependencies, baselines & variance, progress tracking, resource management, earned
value management (EVM), and export (JSON/CSV/Excel/PDF/PNG, Primavera/MS Project
interop).

## License

[MIT](./LICENSE)
