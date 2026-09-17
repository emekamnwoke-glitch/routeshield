# src

The RouteShield core and its adapters, in TypeScript ([ADR-0009](../docs/05-architecture-decisions/adr-0009-typescript-core-python-build-pipeline.md)).

**This is the fictional reference implementation.** Every external system it talks to is invented; see the [fact / assumption model](../docs/02-stage-two-reference-implementation/fact-vs-assumption-model.md).

## Layout

```text
src/
├── core/
│   ├── core.ts                      Composition root: builds and wires every component
│   ├── kernel/                      Shared kernel: store port, event bus and outbox, telemetry, primitives
│   └── modules/
│       ├── ac-01-source-gateway/    One folder per component in the application architecture
│       ├── …
│       └── ac-14-access-control/
└── adapters/
    ├── sqlite/                      Store port over SQLite WASM
    └── identity/                    IdentityPort over the persona switcher
```

The folders follow the [component catalogue](../docs/01-stage-one-architecture/phase-c-information-systems/application-architecture/application-components.md#4-component-catalogue). AC-03 is unallocated, and AC-13 Control Workspace is presentation, so it will live in `frontend/`.

## Rules

The core is a modular monolith ([ADR-0006](../docs/05-architecture-decisions/adr-0006-modular-monolith-with-ports-and-adapters.md)). Each component folder holds:

- **`contract.ts`:** the only thing other components may import. It holds the component's interface, event names, payload types and errors.
- **`module.ts`:** the implementation. The component is the sole writer of the tables carrying its prefix (`dm_`, `au_` and so on; [ADR-0010](../docs/05-architecture-decisions/adr-0010-sqlite-wasm-as-embedded-store.md)).

`tools/architecture/check_boundaries.py` enforces these rules, and also that the core never imports adapters or third-party packages.

Every state change and its audit event commit in one transaction ([ADR-0007](../docs/05-architecture-decisions/adr-0007-in-process-events-with-synchronous-audit.md)). Events go through a transactional outbox, and a subscriber's work commits with its delivery record, so replaying events never repeats work.

## Status: walking skeleton (v1.1.0)

One trivial disruption runs through every component:

1. AC-01 reports an incident.
2. AC-02 declares a disruption.
3. AC-04 has AC-11 freeze a snapshot, then assesses the impact.
4. AC-05 generates options, consulting AC-10.
5. AC-06 recommends one of them.
6. A persona decides through AC-07, with AC-14 checking authority.
7. AC-08 records the new service state.
8. AC-09 issues a passenger notice.
9. AC-12 derives counts from the audit record.

The logic inside each step is deliberately trivial: the skeleton has no network or fleet loaded, and its only option is "hold". The later v1.x releases replace each step with the real thing.

## Tooling

| Tool | Why |
|---|---|
| `@sqlite.org/sqlite-wasm` | The official SQLite build from ADR-0010. Tests run it in memory under Node, so they use the same SQL as the browser. |
| Vitest | Runs the core under Node now; shares its configuration with Vite, which will build the site. |
| TypeScript 6.0 (strict) | Pinned below 6.1 until typescript-eslint supports TypeScript 7. |
| ESLint with typescript-eslint | Formatting and linting enforced for TypeScript (technology standards §3). |
