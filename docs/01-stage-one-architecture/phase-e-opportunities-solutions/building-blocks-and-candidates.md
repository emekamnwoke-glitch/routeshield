# Building Blocks and Candidate Solutions

| | |
|---|---|
| **Phase** | E — Opportunities & Solutions |
| **Document version** | 1.0 |
| **Status** | Baseline |

---

## 1. Architecture building blocks → solution building blocks

An **architecture building block** (ABB) is what is needed, independent of how. A **solution building block** (SBB) is what is actually used in the reference profile.

| ABB | Realises | Reference SBB | Operator SBB (category) |
|---|---|---|---|
| **Network model** | DD-1, NetworkPort | Python pipeline over NTA GTFS + OSM → versioned static files | Operator network data + constraint set |
| **Live fleet feed** | DD-2, FleetPort | Seeded fleet and GPS simulator *(fictional)* | Operator AVL / fleet system |
| **Road condition feed** | DD-3, RoadConditionPort | Seeded traffic simulator *(fictional)* | Traffic data provider |
| **Incident feed** | DD-3, IncidentPort | Scenario-driven incident simulator *(fictional)* | Authoritative incident source, if obtainable ([A-002](../../02-stage-two-reference-implementation/assumptions.md#a-002)) |
| **Disruption lifecycle engine** | AC-02 | TypeScript module | Same core |
| **Spatial impact engine** | AC-04 | TypeScript module + prebuilt spatial index | Same core, spatial store |
| **Route optimiser** | AC-05 | TypeScript module in a dedicated worker — [ADR-0014](../../05-architecture-decisions/adr-0014-constrained-shortest-path-with-rejoin-enumeration.md), [ADR-0015](../../05-architecture-decisions/adr-0015-weighted-service-loss-objective.md) | Same core |
| **Decision support** | AC-06 | TypeScript module | Same core |
| **Decision and authority** | AC-07, AC-14 | TypeScript modules; simulated personas | Same core; OIDC |
| **Service state** | AC-08 | TypeScript module | Same core |
| **Communication hub** | AC-09 | TypeScript module + simulated driver and passenger channels *(fictional)* | Same core + operator channels |
| **Contingency library** | AC-10 | TypeScript module | Same core |
| **Audit ledger** | AC-11 | TypeScript module over SQLite, hash-chained | Same core, append-only store |
| **Service analytics** | AC-12 | TypeScript module; offline models from Python — [ADR-0016](../../05-architecture-decisions/adr-0016-tree-models-exported-as-json.md) | Same |
| **Control workspace** | AC-13 | React application | Same, served by operator |
| **Transactional store** | All owned domains | SQLite WASM ([ADR-0010](../../05-architecture-decisions/adr-0010-sqlite-wasm-as-embedded-store.md)) | Spatial relational store |
| **Scenario runner** | Simulation, tests | TypeScript, seeded | — |

Every core module is the same code in both profiles. Only adapters, simulators and the store binding differ — the practical meaning of [ADR-0006](../../05-architecture-decisions/adr-0006-modular-monolith-with-ports-and-adapters.md).

## 2. Candidate solutions for an operator

The question an operator would ask first is whether to build at all. Recorded here at category level; no specific product is assessed, because no product evaluation was performed and inventing one would be exactly the kind of unsupported claim [P-5](../methodology/architecture-principles.md#p-5--distinguish-what-is-known-from-what-is-supposed) forbids.

| Option | For | Against | Fit |
|---|---|---|---|
| **Extend existing CAD/AVL platform** | Already integrated with fleet and drivers; lowest integration risk | Disruption modules in such platforms may optimise for dispatch, not stop continuity; audit and autonomy model may not be configurable to P-1/P-2 | Strong where the vendor's model matches the principles |
| **Buy a specialist disruption tool** | Faster to operate | Integration cost; vendor objective function may conflict with P-6/P-7; lock-in | Depends entirely on the objective function |
| **Build (this architecture)** | Objective, autonomy model and audit exactly as designed | Delivery and ownership cost; operator must maintain it | Strong where principles are non-negotiable |
| **Hybrid — build decision support, keep platform for execution** | Keeps existing driver comms; owns the part that encodes the operator's values | Two systems to integrate | **Recommended starting position** |

The hybrid is the baseline concept's *Option A* in architectural terms: RouteShield owns assessment, options, decision and audit; the existing platform keeps delivery. The ports-and-adapters design makes this a configuration of the same core, not a different system.

The deciding evaluation criterion for any bought component is **whether its objective function and autonomy behaviour can be inspected and configured.** A black-box optimiser that minimises travel time fails P-6 no matter how good it is at doing so.

## 3. Implementation opportunities

Where the architecture offers value independently of full delivery — useful for an operator deciding what to fund first.

| Opportunity | Delivers | Needs | Value without the rest |
|---|---|---|---|
| **Impact view only (band A0)** | Which routes, vehicles, stops are affected | Network, fleet feed, disruption declaration | High — the heat map's largest gap ([capability map §5](../phase-b-business-architecture/capability-map.md#5-capability-heat-map)) |
| **Decision record** | Reconstructable decisions | Audit ledger, workspace | High — BO-3 alone |
| **Stop-level passenger notices** | BO-2 | Impact view + passenger channel | High, and for the least-served stakeholder |
| **Ranked options** | Faster, explained decisions | Optimiser | Medium — controllers already route well |
| **Contingency library + A2** | Near-instant response on known corridors | All of the above + governance | Medium, with governance risk |
| **ML classification / duration** | Better characterisation | History | Low until history exists |

This ordering follows the Phase B finding that the gap is in assessment, passenger information and the record — not routing. An operator funding in this order gets most of the value before the optimiser exists.
