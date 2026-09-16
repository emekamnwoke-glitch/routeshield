# Architecture Decision Records

A decision gets an ADR when it is expensive to reverse, constrains later work, or a reviewer could reasonably ask "why that?" Everything else is an ordinary commit — see [governance §2](../01-stage-one-architecture/methodology/architecture-governance.md#2-decision-types-and-their-controls).

ADRs are **immutable once accepted**. A decision is changed by writing a new ADR that supersedes the old one, never by editing it. The record of having changed your mind is usually more informative than the decision itself.

Template: [`adr-template.md`](adr-template.md).

## Index

| ID | Decision | Status | Phase | Date |
|---|---|---|---|---|
| [ADR-0001](adr-0001-tailored-togaf-inspired-method.md) | Use a tailored TOGAF-inspired method rather than an ad-hoc structure | Accepted | Preliminary | 2026-09-16 |
| [ADR-0002](adr-0002-two-stage-architecture-implementation-split.md) | Separate the project into an architecture stage and a fictional implementation stage | Accepted | Preliminary | 2026-09-16 |
| [ADR-0003](adr-0003-git-markdown-mermaid-as-architecture-repository.md) | Use Git, Markdown and Mermaid as the architecture repository | Accepted | Preliminary | 2026-09-16 |
| [ADR-0004](adr-0004-decisions-reference-immutable-input-snapshots.md) | Decisions reference immutable input snapshots, not live state | Accepted | C | 2026-09-16 |
| [ADR-0005](adr-0005-represent-disruptions-as-versioned-static-footprints.md) | Represent disruptions as versioned static footprints | Accepted — review in Stage Two | C | 2026-09-16 |
| [ADR-0006](adr-0006-modular-monolith-with-ports-and-adapters.md) | Structure RouteShield as a modular monolith with ports and adapters | Accepted | C | 2026-09-16 |
| [ADR-0007](adr-0007-in-process-events-with-synchronous-audit.md) | Use in-process domain events, with audit written synchronously | Accepted | C | 2026-09-16 |
| [ADR-0008](adr-0008-browser-hosted-static-demonstrator.md) | Deploy the reference implementation as a browser-hosted static site | Accepted | D | 2026-09-16 |
| [ADR-0009](adr-0009-typescript-core-python-build-pipeline.md) | TypeScript for the core and UI; Python for the build-time pipeline | Accepted | D | 2026-09-16 |
| [ADR-0010](adr-0010-sqlite-wasm-as-embedded-store.md) | Use SQLite (official WASM build) as the embedded store | Accepted | D | 2026-09-16 |
| [ADR-0011](adr-0011-open-network-data-via-build-time-pipeline.md) | Source the network from NTA GTFS and OpenStreetMap, processed at build time | Accepted | D | 2026-09-16 |
| [ADR-0012](adr-0012-simulated-identity-in-demonstrator.md) | Simulate identity in the demonstrator; keep authorisation logic real | Accepted | D | 2026-09-16 |
| [ADR-0013](adr-0013-otel-shaped-telemetry-without-a-backend.md) | OpenTelemetry-shaped telemetry, rendered in-browser in the demonstrator | Accepted | D | 2026-09-16 |

## Planned

Decisions identified as needing an ADR, recorded here so their absence is visible:

| Phase | Decision |
|---|---|
| E | Routing algorithm |
| E | Multi-objective optimisation formulation and weights |
| E | Autonomy model — when, if ever, the system acts without approval |
| F | Release and milestone strategy |
| G | Automated traceability checking |
| H | ML framework and training/inference split |
