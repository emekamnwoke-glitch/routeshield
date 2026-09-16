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

## Planned

Decisions identified as needing an ADR, recorded here so their absence is visible:

| Phase | Decision |
|---|---|
| C | Conceptual representation of a disruption |
| C | Application architecture style and component boundaries |
| C | Event-driven versus request/response interaction |
| D | Deployment target and the no-backend constraint |
| D | Embedded data store for the browser-hosted demonstrator |
| D | Network data sources and ingestion approach |
| D | Authentication and authorisation model |
| D | Observability approach under a no-backend constraint |
| E | Routing algorithm |
| E | Multi-objective optimisation formulation and weights |
| E | Autonomy model — when, if ever, the system acts without approval |
| F | Release and milestone strategy |
| G | Automated traceability checking |
| H | ML framework and training/inference split |
