# Phase C — Data Architecture

> **Status: complete.** Exit condition satisfied — see [below](#exit-condition).

What information this capability depends on, who owns it, how it moves and how long it lives. Developed before the application architecture because boundaries that cut across data ownership are the most expensive kind to get wrong ([P-8](../../methodology/architecture-principles.md#p-8--boundaries-follow-data-ownership)).

## Documents

| | |
|---|---|
| [Data Domains and Ownership](data-domains.md) | 12 domains — 3 sourced, 7 owned, 1 append-only, 1 derived — and the three splits that carry the design |
| [Conceptual Data Model](conceptual-data-model.md) | Entities and relationships, and what is deliberately absent |
| [Logical Data Model](logical-data-model.md) | Attributes, state machine, and 13 invariants |
| [Data Flows](data-flows.md) | Level 0 and 1 flow diagrams, 20 classified flows, flow rules, degraded flows |
| [Data Lifecycle and Governance](data-lifecycle-and-governance.md) | Retention shape, quality, roles, data protection position |

Decisions: [ADR-0004](../../../05-architecture-decisions/adr-0004-decisions-reference-immutable-input-snapshots.md) (input snapshots) · [ADR-0005](../../../05-architecture-decisions/adr-0005-represent-disruptions-as-versioned-static-footprints.md) (disruption representation)

## What this settles

**Decisions reference frozen inputs, not live state.** Before every assessment, the sourced data it will read — including which sources were stale or absent — is copied into an immutable snapshot and written to the audit record. Reconstruction is therefore exact by construction: the record holds what *was* read, not what the feeds probably said. A side effect that turns out to matter: assessment becomes a pure function of its inputs, so simulation, testing and audit replay are the same mechanism.

**Three things called "the route" are kept apart.** The planned pattern (network), the decided change (decision) and the current pattern (service state) diverge in exactly the situations where operational risk sits — a refused instruction, a diversion outliving its disruption, an unacknowledged reversion. One field could not represent any of them.

**Driver analytics are impossible, not prohibited.** Driver identity never enters the audit record; analytics reads only from the audit record; so analytics cannot rank drivers. The constraint is enforced by what data exists, not by who runs which query.

**The audit write is on the critical path.** A change whose audit write fails does not happen. That makes the audit store's availability a system availability requirement — a deliberate cost, because a service change that cannot be recorded could never be explained.

## What this admits

The disruption model — versioned static footprints — is chosen **knowing it is probably wrong for moving disruptions**, the baseline concept's first-named use case. ADR-0005 says so and names Stage Two's simulation of BS-2 as its review trigger. This is the designated Phase H feedback-loop subject.

Retention period, DPIA, audit custodian independence and incident data-sharing agreements are declared gaps, not decisions.

## Exit condition

| Check | |
|---|---|
| Every entity has a named owning domain | ✅ [Conceptual model §3](conceptual-data-model.md#3-entities-by-domain) |
| Every flow has a source, a sink and a classification | ✅ 20 of 20 — [flow catalogue](data-flows.md#4-flow-catalogue) |
| Every capability is served by a domain | ✅ [Domain coverage](data-domains.md#6-domain-to-capability-coverage) |

**Data architecture exit condition satisfied.** The [application architecture](../application-architecture/) now draws component boundaries along these domains.
