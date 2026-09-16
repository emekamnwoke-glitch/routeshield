# Phase C — Application Architecture

> **Status: complete.** Exit condition satisfied — see [below](#exit-condition).

What components exist, where their boundaries fall, and how they interact. Boundaries follow the [data domains](../data-architecture/), not technology layers.

## Documents

| | |
|---|---|
| [Application Components](application-components.md) | 13 components, one writer per domain, two refinements to the data domains, capability realisation |
| [Integration Architecture](integration-architecture.md) | Ports and adapters, standards the fictional interfaces are modelled on, boundary failure handling |
| [Component Interactions](component-interactions.md) | Nominal A1, pre-approved A2, driver refusal, clearance and reversion |
| [Service Contracts and APIs](service-contracts.md) | Commands, queries and events per component; the `v1` workspace API; error model |

Decisions: [ADR-0006](../../../05-architecture-decisions/adr-0006-modular-monolith-with-ports-and-adapters.md) (modular monolith, ports and adapters) · [ADR-0007](../../../05-architecture-decisions/adr-0007-in-process-events-with-synchronous-audit.md) (in-process events, synchronous audit)

## What this settles

**Drawing the components corrected the data architecture.** "One writer per domain" and "assessment and optimisation fail independently" could not both hold with the Response domain as first drawn. The domain was split into Impact, Options and Recommendation, and authority was separated from decisions. Both refinements were made while Phase C was still open, and the data documents amended to match — a small, early instance of the feedback loop Phase H formalises.

**One core, two deployment options.** The baseline concept offered an add-on integration or a standalone platform. With ports and adapters they are the same core with different adapters. That is the claim Stage Two can partly test by running the core against two adapter sets.

**Nothing external sits on the decision path.** Everything assessment needs is already cached and frozen into a snapshot, so slow or failing sources reduce confidence but cannot delay a recommendation.

**Authority comes from the channel, not the message.** An incident report is authoritative because of which configured source it arrived on, not because it says it is certain.

**A monolith, argued for.** Thirteen microservices would have turned the audit guarantee into a distributed-transaction problem and added infrastructure that fails under exactly the load disruptions create. Independent failure of assessment and optimisation is achieved by ordering and bulkheading; the one failure that doesn't cover — the whole process dying — would leave nothing useful running under the alternatives either.

## Exit condition

| Check | |
|---|---|
| Every business capability is realised by at least one component | ✅ 32 of 32 — [§6](application-components.md#6-capability-realisation) |
| No component spans two data domains without recorded justification | ✅ [§7](application-components.md#7-domain-spanning) |

**Application architecture exit condition satisfied.**
