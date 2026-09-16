# ADR-0004: Decisions reference immutable input snapshots, not live state

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | C — Data Architecture |
| **Principles engaged** | P-2, P-3, P-8 |
| **Requirements** | BR-036, BR-037, BR-038, BR-044 |
| **Supersedes** | — |

---

## Context

A recommendation is computed from sourced data that RouteShield does not own and that changes every few seconds: vehicle positions, trip assignments, road conditions, and the health of each of those sources.

BR-037 requires that a decision's inputs be captured *as they stood at decision time, including inputs that were stale or absent*. BR-038 requires any past decision to be reconstructable from the record alone, including the uncertainty it was made under.

Sourced data is overwritten continuously. By the time anyone asks why a decision was made, the positions, conditions and health states it rested on no longer exist anywhere.

## Problem

How should a recommendation and its decision refer to the data they were based on, so that they can be reconstructed later?

## Options considered

### Option 1 — Reference live state by identifier

Recommendations store identifiers — vehicle 1234, segment 88 — and reconstruction looks them up.

**For:** Smallest storage. Simplest model.

**Against:** Reconstruction returns *current* state, not decision-time state. A decision made on a stale position is reconstructed as if made on a fresh one. It fails BR-037 outright and fails BR-038 in the worst way — silently, with a plausible answer.

### Option 2 — Time-travel query over historised sourced data

Keep full history of every sourced feed, and reconstruct by querying "as of" the decision time.

**For:** No duplication per decision. Supports arbitrary historical analysis.

**Against:** Requires RouteShield to historise data it does not own, at full feed volume, forever — or for retention period *R*, which is unset. It reconstructs *what the feeds said*, not *what the assessment actually read*, and those differ whenever ingest lags, a cache is stale, or a source was absent. It also cannot capture source health unless that is historised with the same precision. The result is an approximation of the decision's inputs, presented as exact.

### Option 3 — Event-source everything

Model all state, sourced and owned, as event streams and derive any point in time by replay.

**For:** Complete history. Elegant.

**Against:** The same problem as Option 2 for sourced data — RouteShield would be event-sourcing other systems' data — plus substantial complexity for a single-author reference implementation ([P-10](../01-stage-one-architecture/methodology/architecture-principles.md#p-10--no-unnecessary-infrastructure)). Owned domains benefit from being event-shaped; sourced ones do not.

### Option 4 — Freeze an area-scoped snapshot before assessing

Before each assessment, copy the sourced records relevant to the disruption's area, plus current source health, into an immutable snapshot in the audit domain. Assessment reads only the snapshot. Recommendations and decisions reference the snapshot.

**For:** Reconstruction is exact by construction — the snapshot *is* what was read. Stale and absent sources are recorded because health is part of the snapshot. Storage is bounded by disruption count and area, not feed volume. Assessment becomes a pure function of (disruption version, snapshot), which is also what makes it testable and repeatable.

**Against:** Duplicates sourced data per assessment. Adds a synchronous write before every assessment, lengthening the path to a recommendation. Area scoping must be generous enough to include vehicles approaching from outside the footprint, or the snapshot omits something the assessment needed.

## Decision

**Option 4.** Assessment is computed from an immutable, area-scoped input snapshot persisted to the audit domain *before* the assessment starts. Recommendations and decisions reference snapshots, never live state.

## Rationale

The deciding consideration was **exactness**. Options 1–3 reconstruct what *should* have been read. Option 4 stores what *was* read. For a record whose purpose is to answer "why did the 46A skip those stops?" in front of a regulator, the difference between those two is the whole point.

The second consideration was that Option 4 makes assessment a pure function. That is not a side benefit: it is what allows the simulation, the test suite and the audit reconstruction in Stage Two to be the same mechanism.

## Consequences

### Positive
- BR-037 and BR-038 are satisfied by construction.
- Assessment is deterministic given its inputs — testable, replayable, explainable.
- Confidence state is derived from the same frozen health data the audit record holds, so the controller and the reviewer see the same thing.

### Negative
- Storage grows per assessment, and moving disruptions ([ADR-0005](adr-0005-represent-disruptions-as-versioned-static-footprints.md)) create many assessments.
- An extra synchronous write sits on the path to every recommendation, and it depends on the audit store being available (see [data flows FR-D3](../01-stage-one-architecture/phase-c-information-systems/data-architecture/data-flows.md#5-flow-rules)).
- Area scoping is a new failure mode: too tight and relevant vehicles are missing.

### Neutral
- Historical analysis beyond decided disruptions is not supported. It is not a requirement.

## Risks

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| Scope too tight, approaching vehicles omitted | Medium | High | Scope by affected patterns end to end, not by footprint radius |
| Snapshot write adds latency beyond OBJ-1's 5 s | Low | Medium | Measure in Stage Two; area scoping keeps snapshots small |
| Storage growth under many-version disruptions | Medium | Low | Retention by whole disruption; deduplicate unchanged network references |

## Alternatives rejected

**Option 1** — fails the requirement. *Would become right if* reconstruction were not a requirement.

**Option 2** — approximates what was read. *Would become right if* RouteShield owned the sourced data and ingest were guaranteed lag-free.

**Option 3** — disproportionate, and does not fix sourced data. *Would become right if* the owned domains grew to the point where event sourcing them paid for itself; that would complement this decision rather than replace it.

## Review trigger

Revisit if snapshot size or write latency measured in Stage Two threatens OBJ-1, or if a retention period is set that makes per-assessment storage untenable.
