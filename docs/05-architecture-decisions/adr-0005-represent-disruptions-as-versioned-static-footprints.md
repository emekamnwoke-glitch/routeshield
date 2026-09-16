# ADR-0005: Represent disruptions as versioned static footprints

| | |
|---|---|
| **Status** | Accepted — **flagged for review in Stage Two** |
| **Date** | 2026-09-16 |
| **Phase** | C — Data Architecture |
| **Principles engaged** | P-5, P-9, P-11 |
| **Requirements** | BR-004, BR-006 → BR-008, BR-044 |
| **Assumptions** | A-007 |
| **Supersedes** | — |

---

## Context

Every downstream capability consumes a description of the disruption: impact assessment intersects it with patterns, optimisation routes around it, the audit record preserves it. Its shape is therefore the most consequential data structure in the architecture.

Disruptions vary in shape and behaviour:

| Kind | Shape | Moves? | Graduated? |
|---|---|---|---|
| Collision, closure, bridge failure | Fixed | No | Usually binary |
| Flood | Fixed, may grow | Slowly | Depth matters |
| Public-order cordon | Fixed, may be redrawn | Occasionally | Binary |
| **Protest march** | **Linear, travelling** | **Yes** | Binary at the head, cleared behind |
| Congestion from a nearby event | Diffuse | No | **Yes — slow, not blocked** |

[A-007](../02-stage-two-reference-implementation/assumptions.md#a-007) already records that a static footprint handles the first three well and the last two badly. [BS-2](../01-stage-one-architecture/phase-b-business-architecture/business-scenarios.md#bs-2--moving-protest--the-case-the-model-does-not-handle-well) shows the protest march — the baseline concept's *first-named* use case — is the worst fit.

## Problem

How should a disruption's extent be represented?

## Options considered

### Option 1 — Single static footprint, edited in place

An area plus blocked segments plus a time window; updated when the situation changes.

**For:** Simplest possible.

**Against:** Editing destroys the description earlier assessments were based on, breaking [ADR-0004](adr-0004-decisions-reference-immutable-input-snapshots.md) and BR-038.

### Option 2 — Versioned static footprints

Each change produces a new immutable version. A disruption is a sequence of versions; each assessment references one.

**For:** Preserves reconstruction. Models fixed disruptions exactly. Approximates moving ones as a sequence. Simple to compute against — segment intersection is well understood.

**Against:** Motion is not represented, only sampled. Between versions, assessments go stale without the model knowing. Graduated impact (slow, not blocked) is not representable.

### Option 3 — Spatio-temporal footprint

A footprint as a function of time: a trajectory for moving disruptions, a growth model for floods.

**For:** Represents moving disruptions natively. Assessments could anticipate where a march will be.

**Against:** Requires a motion model the project has no data to build or validate. Every downstream capability becomes a time-dependent computation. Predicting where a protest will go is also a sensitive inference in its own right. Significant complexity before the MVP has proven the simpler case ([P-9](../01-stage-one-architecture/methodology/architecture-principles.md#p-9--build-the-smallest-thing-that-delivers-an-outcome)).

### Option 4 — Cost-weighted segments instead of a blocked area

Represent a disruption as a set of segment cost multipliers — infinite for blocked, finite for slowed.

**For:** Handles graduated impact naturally. Fits a graph-search optimiser directly.

**Against:** Loses the geographic description humans reason with and the audit record needs. Stops *near* but not *on* a blocked segment — within a cordon, say — are not captured. Better as a derived representation than as the source of truth.

## Decision

**Option 2**, with Option 4 as a derived internal representation for routing. The source of truth is a versioned static footprint (area, blocked segments, time window, type, origin). The optimiser consumes segment costs derived from it.

Confidence decays with **footprint age**, not only with input staleness, so an ageing version of a moving disruption is presented with falling confidence ([BR-044](../01-stage-one-architecture/phase-b-business-architecture/business-requirements.md#resilience)).

## Rationale

Option 2 is the smallest representation that preserves reconstruction and handles the common case exactly. Option 3 would be building a prediction problem — explicitly out of scope ([problem statement §7](../01-stage-one-architecture/phase-a-architecture-vision/problem-statement.md#7-what-is-not-the-problem)) — to solve a representation problem.

The decision is taken **knowing it is probably wrong for moving disruptions**, and saying so in advance. That is deliberate: this ADR is the designated subject for the Phase H feedback loop ([P-11](../01-stage-one-architecture/methodology/architecture-principles.md#p-11--architecture-changes-before-implementation-does)). If Stage Two shows that versioned footprints cannot usefully serve BS-2, the correct response is a superseding ADR and an amendment to the conceptual model — not a workaround inside the optimiser.

## Consequences

### Positive
- Fixed disruptions are modelled exactly.
- Reconstruction is preserved.
- Routing gets a representation it can search efficiently.

### Negative
- Moving disruptions are sampled, and assessments go stale between samples.
- Graduated impact is expressible only in the derived cost layer, not in the source of truth or the audit record.
- Many-version disruptions multiply assessments and snapshots.

### Neutral
- Motion prediction remains out of scope.

## Risks

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| Stale recommendations for moving disruptions presented confidently | High | High | Confidence decays with footprint age; A2 disabled for disruption types marked mobile |
| Graduated disruptions forced into binary blocked/open | Medium | Medium | Derived cost layer; declared limitation |
| Version churn overwhelms controllers | Medium | Medium | Recommendations superseded rather than stacked; C4.4 bound applies |

## Alternatives rejected

**Option 1** — breaks reconstruction.

**Option 3** — *would become right if* Stage Two shows sampling is inadequate **and** a defensible motion model can be built. The first half is the expected finding; the second is the harder question.

**Option 4 as source of truth** — *would become right if* graduated disruptions turned out to dominate and geography turned out to matter less than cost for review.

## Review trigger

**Stage Two, when BS-2 is simulated.** Specifically: if recommendations for a moving disruption are wrong more often than they are useful at realistic version intervals, open the superseding ADR.
