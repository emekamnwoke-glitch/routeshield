# ADR-0019: Assess and respond per route pattern in v1.2.0; decide per-trip in v1.3.0

| | |
|---|---|
| **Status** | Accepted — interim, recorded retrospectively |
| **Date** | 2026-09-19 |
| **Phase** | H — raised from Stage Two implementation (v1.2.0) |
| **Principles engaged** | P-9, P-11, P-5 |
| **Requirements** | BR-006, BR-007, BR-008, BR-012 |
| **Supersedes** | — |

---

> **Recorded after the code.** v1.2.0 built impact, options, recommendations, service states and notices per route pattern before this was decided in writing, which breaks [P-11](../01-stage-one-architecture/methodology/architecture-principles.md#p-11--architecture-changes-before-implementation-does). See [change log CH-008](../01-stage-one-architecture/phase-h-change-management/change-log.md).

## Context

The logical data model works per **trip**: `AffectedTrip` carries the vehicle and its relation to the disruption; `ResponseOption` belongs to an affected trip; `ServiceState` is per trip. The routing design says divert points must be "still ahead of the vehicle", which only makes sense for one trip at one position.

v1.2.0 had a static fleet scene, not live positions, and one bypass per affected pattern to show. A pattern is one route, direction and stop sequence; every trip on it follows the same path. At 08:00 the sample has 162 vehicles on 33 patterns.

## Problem

In v1.2.0, what is the unit that is assessed, given options, recommended, decided and put into service state: the trip, or the pattern?

## Options considered

### Option 1 — Per trip, as the logical model says

**For:** Matches the model; divert stops can be chosen ahead of each vehicle; decisions can differ between two buses on the same route.
**Against:** An O'Connell Street closure cuts 13 patterns with 59 vehicles approaching: 59 recommendations for what is, at 08:00, 13 different questions. A person would be asked to approve the same bypass dozens of times.

### Option 2 — Per pattern, with vehicles attached to the pattern

Impact records each cut pattern and, separately, each vehicle on it and whether it is approaching, inside or past. Options, recommendations, service states and notices are per pattern.

**For:** One question per distinct path; a controller approves each bypass once. The search runs once per pattern, which the routing design already allows ("trips on the same pattern and direction share results").
**Against:** The divert stop is not chosen relative to each vehicle; a bus already past the nearest divert stop is shown the same bypass as one far behind it. `ServiceState` no longer says which trips are diverted.

## Decision

**Option 2 for v1.2.0.** `AffectedPattern` and `AffectedVehicle` replace `AffectedTrip` in the physical model; `ResponseOption`, `RecommendationItem`, `ServiceState` and `Notice` carry a pattern index. Whether v1.3.0 moves to per trip, or keeps patterns and adds a per-vehicle divert check, is decided before v1.3.0 is built.

## Rationale

P-9: the smallest thing that let a person see the impact and approve a bypass was one decision per path. P-5 is the cost: per-pattern results are shown as such, and vehicles are listed with their relation, so the page does not claim a per-trip precision it does not have.

## Consequences

### Positive
- A closure produces as many decisions as it cuts paths, not as many as there are buses.

### Negative
- Physical model departs from the logical model (`AffectedTrip`, `ResponseOption.affected_trip`, `ServiceState.trip`). Listed in the [v1.2.0 architecture §7](../02-stage-two-reference-implementation/solution-design/architecture-v1.2.0.md#7-departures-from-the-stage-one-target).
- A vehicle already past a divert stop is not flagged as unable to take the bypass.
- `AffectedTrip.relation` has no `unknown`: with no positions, vehicles are simply absent (BS-4 not yet met).

### Neutral
- The routing design already allowed trips on one pattern to share search results.

## Risks

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| The per-pattern shape spreads into v1.3.0 by default | Medium | Medium | v1.3.0 cannot start until this is decided (review trigger) |

## Alternatives rejected

**Option 1** — *would become right if* live positions made each vehicle's options genuinely different, which the moving fleet simulator (v1.4.0) makes likely.

## Review trigger

Before v1.3.0 is built. This ADR is superseded then, whichever way that goes.
