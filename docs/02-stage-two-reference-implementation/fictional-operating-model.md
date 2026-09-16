# The Fictional Reference Operating Environment

| | |
|---|---|
| **Document version** | 0.1 — outline only |
| **Status** | Outlined at Phase 1, defined in full at project Phase 3 |
| **Governed by** | [ADR-0002](../05-architecture-decisions/adr-0002-two-stage-architecture-implementation-split.md) · [The Fact / Assumption Model](fact-vs-assumption-model.md) |

---

> ## ⚠️ Everything in this document is fictional
>
> The systems described here **do not exist**. They are invented for this project so that the reference implementation has something concrete to integrate with.
>
> They are **not** descriptions of Dublin Bus's systems, the National Transport Authority's systems, or any real operator's systems. The author has no access to and no knowledge of those systems. No statement in this document should be read as a claim about any real organisation's architecture.

---

## Why a fictional environment

RouteShield is an integrating system. Almost everything it does depends on something else: where the vehicles are, which vehicle is on which trip, what the roads are doing, who can be told what.

The real versions of those systems cannot be observed. The options were to design against nothing — abstract interfaces that never have to confront latency, freshness or failure — or to invent something concrete and label it. [ADR-0002](../05-architecture-decisions/adr-0002-two-stage-architecture-implementation-split.md) records why the second was chosen: **abstraction hides assumptions rather than removing them.** An abstract interface still assumes request/response semantics, still assumes availability, still assumes a data model. It simply does not write them down.

The discipline that keeps this honest: fictional interfaces are **modelled on published open standards** — GTFS-Realtime, SIRI — rather than invented freely (P-4). Inventing an interface shape from nothing would make the fiction arbitrary, and an arbitrary fiction demonstrates nothing about integration.

## The seven reference systems

| System | Stands in for | Provides | Primary assumptions |
|---|---|---|---|
| **Reference Fleet Management System** | Operator fleet/duty management | Vehicle-to-trip assignment, vehicle availability, service state | [A-001](assumptions.md#a-001) |
| **Reference Vehicle GPS Platform** | AVL / telemetry | Vehicle position, heading, speed | [A-004](assumptions.md#a-004) |
| **Reference Traffic Data Provider** | Commercial traffic API | Road segment speeds, congestion, closure signals | See note below |
| **Reference Incident Management System** | Emergency services feed | Authoritative incident and closure notifications | [A-002](assumptions.md#a-002) |
| **Reference Passenger Information System** | Passenger app / notification estate | Passenger-facing alert delivery | [A-003](assumptions.md#a-003) |
| **Reference Driver Communication Platform** | In-cab display / driver comms | Revised stop sequence delivery, acknowledgement | [A-005](assumptions.md#a-005) |
| **Reference Operations Control Centre** | Control room | Controller identity, authority, approval decisions | [A-006](assumptions.md#a-006) |

> **Note on the Traffic Data Provider.** The baseline proposal named Google Maps Platform and TomTom. Both are real and both expose the described data — so this is a `DESIGN DECISION` rather than an `ASSUMPTION`. They were displaced because they are metered commercial services, colliding with charter constraint C-2 and principle P-4. The reference implementation simulates traffic over an OpenStreetMap-derived network, behind an adapter boundary where a commercial provider would attach. The accuracy loss is declared, not disguised.

## To be defined in Phase 3

For each system: the interface contract it exposes, the standard that contract is modelled on, its assumed latency and freshness, its failure and degraded modes, its data ownership boundary, and the full set of assumptions it carries.

Phase 3 will also add assumptions covering areas Phase 1 has not yet needed: authentication and identity federation, service-to-service trust, data retention and residency, network topology, the operational support model, and incident escalation paths.

## The rule that keeps this useful

Every one of these systems is labelled as fictional **at each point of use** — in the architecture documents, in the interface definitions, and in the source code that calls them. Not once here, and then silently thereafter.

The failure mode this guards against is documented in the [Fact / Assumption Model](fact-vs-assumption-model.md#5-degradation-modes-to-watch-for) as *assumption drift*: a supposition restated often enough, without its label, eventually reads as established fact. Nothing degrades the credibility of this project faster, and it degrades quietly.
