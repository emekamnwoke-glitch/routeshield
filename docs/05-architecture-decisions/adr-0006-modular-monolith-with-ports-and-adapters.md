# ADR-0006: Structure RouteShield as a modular monolith with ports and adapters

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | C — Application Architecture |
| **Principles engaged** | P-3, P-8, P-9, P-10 |
| **Requirements** | BR-011, BR-045, FR-D3 |
| **Supersedes** | — |

---

## Context

Phase C defines thirteen components with strict ownership boundaries and a requirement that impact assessment and optimisation fail independently. It also requires every state change to be written to the audit record in the same unit of work as the change itself.

The reference implementation has one author, no budget, and — decided later in Phase D — a browser-hosted demonstrator. The architecture must nonetheless be a credible design for an operator.

## Problem

What deployment and structural style should realise the component architecture?

## Options considered

### Option 1 — Microservices, one per component

**For:** Boundaries enforced by the network. Independent deployment and scaling. Process-level failure isolation between assessment and optimisation.

**Against:** Thirteen deployables for a system whose load is a handful of controllers and bursts of disruption. FR-D3 — audit in the same unit of work as every change — becomes a distributed transaction or an outbox with eventual consistency, which weakens the guarantee it exists to provide. Operational complexity far beyond any stated requirement ([P-10](../01-stage-one-architecture/methodology/architecture-principles.md#p-10--no-unnecessary-infrastructure)). And more infrastructure is more to fail during a disruption, which is when load peaks.

### Option 2 — Layered monolith

**For:** Simplest to build.

**Against:** Layers cut across domains, so nothing enforces single ownership — the data access layer can write any table. The component boundaries from Phase C would exist only on paper.

### Option 3 — Modular monolith with ports and adapters

One deployable. Each component is a module with a public contract and private storage (separate schema or store). The core depends on ports; adapters sit at the edge.

**For:** Ownership is enforced by module visibility and storage separation. Audit in the same unit of work is a local transaction. External systems are replaceable by adapter, realising both baseline deployment options with one core. Modules can be extracted into services later along boundaries that already exist.

**Against:** Process-level failure is shared: a crash takes down assessment and optimisation together. Module boundaries are enforced by tooling and discipline, not by the network, and can erode.

### Option 4 — Two services: core and optimiser

Monolith for everything except the optimiser, which runs separately.

**For:** Gives real process isolation for the one pair that requires independent failure.

**Against:** Adds a network hop and a deployable to solve a problem that ordering and bulkheading can solve inside one process for the failures that actually occur — timeouts, no feasible path, exceptions.

## Decision

**Option 3.** RouteShield is a modular monolith. Components are modules with private storage and explicit contracts; external systems are reached only through ports implemented by adapters.

The BR-011 independence requirement is met by:
1. **Ordering** — impact is committed and presentable before optimisation begins.
2. **Bulkheading** — optimisation runs on a separate, time-boxed worker pool; its failure or timeout is recorded, not propagated.

## Rationale

The failures BR-011 is concerned with are optimisation-level: no feasible path, a pathological search, an exception in costing. Ordering plus bulkheading contain all of these. The failure they do not contain — the whole process dying — also takes out every other component, so separate processes for two of thirteen components would not produce a system that keeps working; it would produce one piece of a system that keeps working with nothing to present to.

FR-D3 was the second decider. A local transaction gives the audit guarantee exactly. A distributed design gives it approximately.

## Consequences

### Positive
- Ownership is enforceable, not just documented.
- Audit atomicity is a local transaction.
- One deployable — consistent with the zero-cost hosting constraint that Phase D will apply.
- Extraction paths exist along real boundaries.

### Negative
- Shared process failure. Mitigated by the manual fallback ([C8.4](../01-stage-one-architecture/phase-b-business-architecture/capability-map.md#c8--operational-resilience--cross-cutting)), not by the architecture.
- Boundary erosion is possible and must be checked by tooling (dependency rules in CI).
- Scaling is whole-system. Not a concern at the stated load.

## Risks

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| Modules reach into each other's storage | Medium | High | Automated dependency and schema-access checks in CI |
| Optimiser exhausts shared resources | Medium | Medium | Dedicated pool, time budget, memory limit |
| Whole-process failure mid-disruption | Low | High | A3 manual fallback; fast restart; state recoverable from store |

## Alternatives rejected

**Option 1** — *would become right if* multiple teams owned components, or load differed by orders of magnitude between components.

**Option 2** — *would become right if* ownership did not matter; in this architecture it is the organising principle.

**Option 4** — *would become right if* optimisation moved to a different runtime or needed specialised hardware — plausible if an ML-heavy optimiser were introduced.

## Review trigger

Revisit if Stage Two shows optimisation cannot be bulkheaded effectively in-process, or if the ML increment introduces a runtime the core cannot host.
