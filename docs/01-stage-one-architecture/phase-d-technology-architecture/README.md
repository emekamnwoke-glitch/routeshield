# Phase D — Technology Architecture

> **Status: complete.** Exit condition satisfied — see [below](#exit-condition).

What the system runs on, and how it is secured, observed and deployed. This is where the zero-cost hosting constraint is applied — to the reference implementation only, not to the architecture.

## Documents

| | |
|---|---|
| [Technology Architecture](technology-architecture.md) | Operator and reference profiles, runtime, network, availability, and what the reference profile cannot provide |
| [Security Architecture](security-architecture.md) | Assets, seven trust boundaries, controls, STRIDE threat model, secrets |
| [Observability and KPIs](observability.md) | Operational telemetry, health semantics, alerts, 16 service KPIs with how each can mislead |
| [Technology Standards](technology-standards.md) | Interface standards, reference stack, engineering standards |

Decisions: [ADR-0008](../../05-architecture-decisions/adr-0008-browser-hosted-static-demonstrator.md) hosting · [ADR-0009](../../05-architecture-decisions/adr-0009-typescript-core-python-build-pipeline.md) languages · [ADR-0010](../../05-architecture-decisions/adr-0010-sqlite-wasm-as-embedded-store.md) store · [ADR-0011](../../05-architecture-decisions/adr-0011-open-network-data-via-build-time-pipeline.md) network data · [ADR-0012](../../05-architecture-decisions/adr-0012-simulated-identity-in-demonstrator.md) identity · [ADR-0013](../../05-architecture-decisions/adr-0013-otel-shaped-telemetry-without-a-backend.md) telemetry

## What this settles

**Two profiles, one core.** The operator profile is what an operator would deploy: replicated store, append-only audit store with separate administration, identity provider, zoned network, 99.9% availability target. The reference profile is what this project hosts: a static site where the whole core runs in the browser. The Phase C architecture needed no change to move there, which is modest evidence it was drawn at the right level.

**Several candidate technologies from the brief were rejected, each for a stated reason.** A FastAPI server had nowhere to run once free hosting ruled out a backend. DuckDB-WASM is strongest at analytics, the smallest workload here; SQLite fits the small transactional writes that dominate. Pyodide would have added seconds of start-up to a demo that must open instantly. PostGIS remains the operator profile's natural choice.

**Live NTA real-time data was rejected on principle, not cost.** Real bus positions flowing through fictional systems would make it impossible to tell what is real. Static network data is real (NTA GTFS, CC BY 4.0; OpenStreetMap, ODbL); everything operational is synthetic.

**Human confirmation is a security control.** An attacker who can inject incident reports can make RouteShield raise candidates; they cannot make it divert buses.

**Readiness does not fail when sources fail** — only when a change could not be recorded. Otherwise the system would turn a degradation into an outage.

**Every KPI comes with how it misleads.** Acceptance rate is ambiguous between poor recommendations and low trust; faster decisions may mean less scrutiny; a rising share of pre-approved activations may be learning or automation by accretion. The rubber-stamping indicator is aggregated per corridor and period, never per person.

## Hosting note

GitHub Pages serves private repositories only on paid plans. The repository is private until `v1.0.0`; the build is host-agnostic, and Cloudflare Pages is the documented free alternative if it stays private.

## Exit condition

| Check | |
|---|---|
| Every application component has a runtime target | ✅ Both profiles — [technology architecture §2–3](technology-architecture.md) |
| The security architecture addresses every trust boundary from Phase C | ✅ TB-1 → TB-7 |
| Every KPI has a defined source | ✅ [Observability §3](observability.md#3-service-kpis) |

**Phase D exit condition satisfied.**
