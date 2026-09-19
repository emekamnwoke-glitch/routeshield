# ADR-0018: Hold the published network as a shared, read-only in-memory model

| | |
|---|---|
| **Status** | Accepted — recorded retrospectively |
| **Date** | 2026-09-19 |
| **Phase** | H — raised from Stage Two implementation (v1.2.0) |
| **Principles engaged** | P-8, P-10, P-11 |
| **Requirements** | BR-006, BR-007, BR-008, BR-012 |
| **Supersedes** | — |

---

> **Recorded after the code.** v1.2.0 implemented this before the decision was written down, which breaks [P-11](../01-stage-one-architecture/methodology/architecture-principles.md#p-11--architecture-changes-before-implementation-does). This record states the decision as taken, the alternatives that were available at the time, and the slip itself ([change log CH-008](../01-stage-one-architecture/phase-h-change-management/change-log.md)).

## Context

DD-1 Network is a sourced domain. The application architecture gives the Source Gateway (AC-01) sole ownership of the read-only cache of sourced data, and ADR-0010 puts spatial work in TypeScript against geometry prepared at build time. It does not say where that geometry lives at run time.

v1.2.0 needed three components to read the network at once: the Impact Assessor (AC-04) to intersect a footprint with road edges and patterns, the Route Optimiser (AC-05) to search the road graph, and the Control Workspace to draw what they found. The network is 56,129 road edges and 33 patterns, published once per build and never changed while the site runs.

## Problem

Where does the published network live at run time, and who may read it?

## Options considered

### Option 1 — Load the network into AC-01's tables in SQLite

**For:** Matches the application architecture literally: AC-01 owns the cache, everything else reads through its contract.
**Against:** About 56,000 edges and their geometry written into SQLite on every start, then read back row by row for every A* search. Spatial queries would need either an R-tree extension or the same in-memory index anyway. It adds a writer and a migration for data that never changes.

### Option 2 — A read-only in-memory model in the shared kernel, served through AC-01's contract

The build-time files are parsed once into an immutable object with footprint intersection and A* search. AC-01 holds it and serves it through `SourceGateway.network()`; no component writes it.

**For:** Loads once in under half a second; a bypass search takes tens of milliseconds. One copy is shared by every reader, and the one-writer rule is kept trivially, because nothing writes. Tests build the same object from the same files.
**Against:** The network is not in the store, so a snapshot records only the network's version, not its content. The model sits in the kernel, which the boundary check lets every component import.

### Option 3 — Give each reading component its own copy

**For:** No shared object at all.
**Against:** Three copies of a 6 MB graph in one worker, and three places for the version to drift.

## Decision

**Option 2.** The network is a read-only model in `src/core/kernel/network.ts`, built from the pipeline's committed outputs and served through AC-01's contract. Snapshots record the network version (`net-` plus the road graph's checksum), not a copy of the network.

## Rationale

P-8 asks that boundaries follow data ownership. Ownership here is the build pipeline's: the network is published at build time and nobody at run time changes it. A read-only object shared through AC-01 honours that exactly, where copying it into a table would invent a writer to satisfy the letter of the rule. P-10 decided the rest: an in-memory model needs no spatial extension and no migration.

Recording the version rather than the content in each snapshot is enough to reconstruct a decision (BR-038), because every network version is a committed file with a checksum in its manifest.

## Consequences

### Positive
- Impact assessment and bypass search run against one shared model, in milliseconds.
- The same model runs in the browser and in the Node tests.

### Negative
- The kernel now carries domain data, not only infrastructure. The boundary check allows any component to import it, so "only AC-01 hands it out" is a convention, not a rule the tooling enforces.
- A snapshot names the network version instead of copying it. Reconstruction depends on the old network file still being retrievable from Git history.
- The logical model's `RoadSegment.base_speed` and `VehicleConstraint` are not yet represented; the model knows lengths, one-way rules and access only (BR-013 stays planned).

### Neutral
- The operator profile would keep a spatial relational store; the port hides the difference, as ADR-0010 anticipated.

## Risks

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| A component imports the network directly instead of through AC-01 | Low | Low | Contract review; extend the boundary check if it happens |
| A reconstructed decision cannot find its network version | Low | Medium | Versions are committed files; the manifest records each checksum |

## Alternatives rejected

**Option 1** — *would become right if* the network changed while the system runs, for example live road works feeding in, so that it needed a writer and a history.

**Option 3** — *would become right if* components ran in separate processes or workers, where sharing an object is not possible. The optimiser worker planned for v1.3.0 will need its own copy for exactly this reason; that is a consequence of ADR-0006, not a reversal of this decision.

## Review trigger

When the network needs to change at run time (road condition feeds, BS-4), or when the optimiser moves to its own worker in v1.3.0 and needs its own copy.
