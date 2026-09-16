# ADR-0007: Use in-process domain events, with audit written synchronously

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | C — Application Architecture |
| **Principles engaged** | P-2, P-8, P-10 |
| **Requirements** | BR-011, BR-036, FR-D3 |
| **Supersedes** | — |

---

## Context

Components interact in two ways ([component interactions §5](../01-stage-one-architecture/phase-c-information-systems/application-architecture/component-interactions.md#5-what-the-interactions-show-about-coupling)): some need a definite answer now (a decision is accepted or rejected); others only need to react to something having happened (optimisation starts after assessment). Every state change must also be recorded in the audit ledger in the same unit of work (FR-D3).

[ADR-0006](adr-0006-modular-monolith-with-ports-and-adapters.md) places all components in one process.

## Problem

How should components communicate, and how does audit fit?

## Options considered

### Option 1 — Synchronous calls throughout

**For:** Simple to trace.

**Against:** Chains assessment to optimisation to recommendation in one call stack, so an optimiser failure propagates to the assessor — the exact coupling BR-011 forbids.

### Option 2 — External message broker for all interaction

**For:** Durable, decoupled, familiar.

**Against:** A new piece of infrastructure on the critical path of a single-process system ([P-10](../01-stage-one-architecture/methodology/architecture-principles.md#p-10--no-unnecessary-infrastructure)). Audit becomes a consumer, so a change can commit while its audit record is still in flight — the weaker guarantee FR-D3 rejects.

### Option 3 — Commands for answers, in-process events for reactions, audit inside the command's transaction

Commands are synchronous and transactional; the command's transaction writes the domain change *and* the audit event. Domain events are published in-process after commit, from a durable outbox in the same store, so a crash between commit and publish is replayed on restart.

**For:** Audit atomicity is exact. Reactions are decoupled, so assessment does not wait on optimisation. No new infrastructure. The outbox gives at-least-once delivery without a broker.

**Against:** Event handlers must be idempotent. In-process delivery does not survive process loss without the outbox replay. Events cannot be consumed by external systems without an additional adapter.

## Decision

**Option 3.** Commands where an answer is needed; in-process domain events, delivered from a transactional outbox, where only a reaction is needed; the audit event is always written inside the command's transaction.

## Rationale

The audit guarantee decided it. FR-D3 says a change that cannot be recorded does not happen. Only Option 3 makes that a property of the transaction rather than a property of eventual delivery.

The outbox is the smallest mechanism that gives events durability. It lives in the store the module already has.

## Consequences

### Positive
- Audit and change commit together or not at all.
- Assessment and optimisation are decoupled in time and in failure.
- No broker to run, monitor or pay for.

### Negative
- Handlers must be idempotent; a replayed event must not double-issue instructions. Instruction and notice commands are keyed by activation for this reason.
- The audit store's availability is a system availability requirement (accepted in [data flows §5](../01-stage-one-architecture/phase-c-information-systems/data-architecture/data-flows.md#5-flow-rules)).

## Risks

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| Duplicate event delivery after restart | Medium | High | Idempotency keys on every externally visible command |
| Handler failure silently drops a reaction | Low | High | Outbox retries with dead-letter recording as an audit event |

## Alternatives rejected

**Option 1** — *would become right if* no two components had different failure tolerance.

**Option 2** — *would become right if* components were extracted into separate services (ADR-0006 review trigger), at which point the outbox becomes the broker's publisher.

## Review trigger

Revisit alongside ADR-0006 if any component is extracted.
