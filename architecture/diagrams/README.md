# Diagram Index

Diagrams are Mermaid, inline in the document whose decision they communicate ([ADR-0003](../../docs/05-architecture-decisions/adr-0003-git-markdown-mermaid-as-architecture-repository.md)). This index points to each one.

| # | Diagram | Communicates | Location |
|---|---|---|---|
| 1 | Context diagram | The controller is on the critical path; the override is an input; the driver can decline | [Architecture vision §2](../../docs/01-stage-one-architecture/phase-a-architecture-vision/architecture-vision.md#2-system-context) |
| 2 | Stakeholder map | Those with most at stake have least influence | [Stakeholder map §2](../../docs/01-stage-one-architecture/phase-a-architecture-vision/stakeholder-map.md#2-influence-and-interest) |
| 3 | Business capability map | C7 is not downstream; C8 is cross-cutting | [Capability map §2](../../docs/01-stage-one-architecture/phase-b-business-architecture/capability-map.md#2-map) |
| 4 | Value stream | Value lands at stage 5; the decision stage is the intended bottleneck | [Value streams §1](../../docs/01-stage-one-architecture/phase-b-business-architecture/value-streams.md#1-the-primary-value-stream) |
| 5 | As-is process | The controller is the whole process; contact is sequential | [As-is/to-be §1](../../docs/01-stage-one-architecture/phase-b-business-architecture/as-is-to-be-process.md#1-as-is) |
| 6 | To-be process | Work moves off the critical path; the decision stays on it | [As-is/to-be §2](../../docs/01-stage-one-architecture/phase-b-business-architecture/as-is-to-be-process.md#2-to-be) |
| 7 | Autonomy bands | When the system may act, and on what basis | [Autonomy model §3](../../docs/01-stage-one-architecture/phase-b-business-architecture/autonomy-model.md#3-the-four-bands) |
| 8 | Data domain map | Ownership boundaries; audit is append-only; analytics reads only audit | [Data domains §2](../../docs/01-stage-one-architecture/phase-c-information-systems/data-architecture/data-domains.md#2-domain-map) |
| 9 | Conceptual data model | Decisions reference recommendations and snapshots, never live state | [Conceptual model §2](../../docs/01-stage-one-architecture/phase-c-information-systems/data-architecture/conceptual-data-model.md#2-model) |
| 10 | Data flow diagram | The freeze step precedes assessment | [Data flows §3](../../docs/01-stage-one-architecture/phase-c-information-systems/data-architecture/data-flows.md#3-level-1--inside-routeshield) |
| 11 | Incident lifecycle | A disruption closes only when no ungoverned deviation remains | [Logical model §5](../../docs/01-stage-one-architecture/phase-c-information-systems/data-architecture/logical-data-model.md#5-dd-4-disruption--owned-versioned) |
| 12 | Application architecture | Thirteen components, one writer each | [Application components §3](../../docs/01-stage-one-architecture/phase-c-information-systems/application-architecture/application-components.md#3-landscape) |
| 13 | Integration architecture | The core knows ports, not protocols; Option A and B are one core | [Integration §1](../../docs/01-stage-one-architecture/phase-c-information-systems/application-architecture/integration-architecture.md#1-shape) |
| 14 | Sequence diagrams | Impact before optimisation; A2 re-checks; refusal re-enters decision; reversion is prompted | [Component interactions](../../docs/01-stage-one-architecture/phase-c-information-systems/application-architecture/component-interactions.md) |
| 15 | Deployment architecture — operator | Two stateless instances, replicated store, separate audit store | [Technology architecture §2.1](../../docs/01-stage-one-architecture/phase-d-technology-architecture/technology-architecture.md#21-runtime) |
| 16 | Deployment architecture — reference | Everything in the browser; Python only at build time | [Technology architecture §3.1](../../docs/01-stage-one-architecture/phase-d-technology-architecture/technology-architecture.md#31-shape) |
| 17 | Security architecture | Seven trust boundaries | [Security §2](../../docs/01-stage-one-architecture/phase-d-technology-architecture/security-architecture.md#2-trust-boundaries) |
| 18 | Route optimisation flow | The search space is expressed in stops | [Routing §2](../../docs/01-stage-one-architecture/phase-e-opportunities-solutions/routing-and-optimisation.md#2-generating-reroute-options) |
| 19 | Transition architectures | Each transition adds an outcome | [MVP and transitions §2](../../docs/01-stage-one-architecture/phase-e-opportunities-solutions/mvp-and-transition-architectures.md#2-transition-architectures) |
| 20 | Roadmap and dependencies | The network pipeline is the critical path | [Release plan](../../docs/01-stage-one-architecture/phase-f-migration-planning/roadmap-and-release-plan.md) |
| 21 | Migration stages | Observe, advise, act, act unattended — each earned | [Migration strategy §2](../../docs/01-stage-one-architecture/phase-f-migration-planning/migration-strategy.md#2-stages) |
| 22 | Traceability chain | BR through to evidence | [Traceability matrix](../../docs/01-stage-one-architecture/phase-g-implementation-governance/traceability-matrix.md#chain) |
| 23 | Change process | Architecture changes before implementation | [Change management §3](../../docs/01-stage-one-architecture/phase-h-change-management/architecture-change-management.md#3-process) |
| 24 | Architecture ↔ implementation feedback loop | The direction of correction | [Method §6](../../docs/01-stage-one-architecture/methodology/architecture-method.md#6-the-architecture--implementation-feedback-loop) |
| 25 | Context — reference implementation | No external system is called at run time | [Architecture v1.2.0 §3](../../docs/02-stage-two-reference-implementation/solution-design/architecture-v1.2.0.md#3-system-context) |
| 26 | Containers — reference implementation | Python only at build time; the core worker is the only store opener | [Architecture v1.2.0 §4](../../docs/02-stage-two-reference-implementation/solution-design/architecture-v1.2.0.md#4-containers) |
| 27 | Components and events — as built | Events flow one way; audit is written inside every change | [Architecture v1.2.0 §5](../../docs/02-stage-two-reference-implementation/solution-design/architecture-v1.2.0.md#5-components) |
| 28 | One disruption, end to end | Snapshot before assessment; refusal audited before it is raised | [Architecture v1.2.0 §6](../../docs/02-stage-two-reference-implementation/solution-design/architecture-v1.2.0.md#6-runtime-one-disruption) |
| 29 | Physical data model — decision chain | Recommendation items choose one option per pattern | [Architecture v1.2.0 §8.2](../../docs/02-stage-two-reference-implementation/solution-design/architecture-v1.2.0.md#82-physical-data-model) |
| — | CI/CD pipeline | — | Stage Two, [`docs/03-sdlc/`](../../docs/03-sdlc/) |
