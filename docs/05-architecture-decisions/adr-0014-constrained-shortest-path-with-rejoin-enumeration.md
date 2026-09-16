# ADR-0014: Generate reroutes by divert/rejoin enumeration over constrained A*

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | E — Opportunities & Solutions |
| **Principles engaged** | P-6, P-9, P-10 |
| **Requirements** | BR-012, BR-013, BR-015, OBJ-1 |
| **Supersedes** | — |

---

## Context

The optimiser must produce feasible reroutes for up to ~20 affected routes within a few seconds, in a browser worker, over a city road graph from which blocked and infeasible edges have been removed. The objective is service continuity, not travel time ([routing design](../01-stage-one-architecture/phase-e-opportunities-solutions/routing-and-optimisation.md)).

## Problem

What algorithm generates candidate reroutes?

## Options considered

### Option 1 — k-shortest paths (e.g. Yen) from vehicle to trip end
**For:** Well-known; yields alternatives. **Against:** Alternatives differ by road, not by which stops they serve; many near-identical paths; cost grows with k; the trip end is often far beyond the part that matters.

### Option 2 — Mixed-integer programme over stops and paths
**For:** Could optimise the true objective globally, including shared vehicles. **Against:** Needs a solver (none suitable and small in-browser); hard to explain; slow and unpredictable runtime.

### Option 3 — External routing engine (OSRM, GraphHopper, Valhalla)
**For:** Fast, mature, turn-aware. **Against:** Requires a server ([ADR-0008](adr-0008-browser-hosted-static-demonstrator.md)); blocked edges change per disruption, which precomputed engines handle less directly.

### Option 4 — Contraction hierarchies in-browser
**For:** Very fast queries. **Against:** Preprocessing invalidated by blocked edges unless customisable variants are used; complexity not justified at this graph size.

### Option 5 — Enumerate (divert stop, rejoin stop) pairs; A* for each on the filtered graph
**For:** Choices map directly onto stops lost — the quantity the objective cares about. A handful of queries per trip; shared across trips on the same pattern. A* on a city graph is milliseconds. Easy to explain and test.
**Against:** Does not find reroutes that leave and rejoin more than once; ignores optimising several vehicles jointly.

## Decision

**Option 5.** For each affected trip, enumerate up to three divert stops before the blockage and three rejoin stops after, and run A* (time-weighted, straight-line heuristic) on the road graph with blocked and constraint-violating edges removed. Implemented in TypeScript in the optimiser worker, with a small in-house A* over a compact adjacency array.

## Rationale

The service objective is expressed in stops, so the search space should be expressed in stops. Option 5 makes stops lost a direct property of each candidate rather than something reverse-engineered from a path. It is the smallest algorithm that answers the question, and its runtime is predictable enough for a time budget ([P-10](../01-stage-one-architecture/methodology/architecture-principles.md#p-10--no-unnecessary-infrastructure)).

A library would add little over forty lines of A* and a binary heap; an in-house implementation keeps the graph format under control and is covered by property-based tests.

## Consequences

- **Positive:** fast, explainable, bounded; directly aligned with the objective.
- **Negative:** misses multi-leave detours and fleet-level optimisation (e.g. swapping which vehicle covers what). Accepted: controllers retain those judgements.
- **Neutral:** turn restrictions from OSM applied where present; OSM's coverage of bus-specific restrictions is incomplete ([A-008](../02-stage-two-reference-implementation/assumptions.md#a-008)).

## Review trigger

If Stage Two shows common disruptions where the best response needs more than one departure from the pattern, or where joint vehicle assignment dominates.
