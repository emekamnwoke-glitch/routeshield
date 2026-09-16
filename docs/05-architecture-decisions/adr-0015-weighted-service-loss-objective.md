# ADR-0015: Rank options by a weighted service-loss score with hard feasibility constraints

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | E — Opportunities & Solutions |
| **Principles engaged** | P-6, P-7, P-1 |
| **Requirements** | BR-015, BR-016, BR-019 |
| **Supersedes** | — |

---

## Context

Options differ on several things at once: stops lost, whether those stops are covered by a following service, passengers affected, delay imposed, vehicle time. P-6 says service continuity outranks vehicle time; P-7 says who depends on a stop matters, but no data exists to model it. BR-019 requires the recommendation to show what each option gives up.

## Problem

How should options be ordered?

## Options considered

### Option 1 — Single metric: stops skipped
**For:** Matches the baseline concept's phrasing. **Against:** Ignores coverage, delay and passengers; treats a covered stop the same as a stranded one.

### Option 2 — Lexicographic ordering
Uncovered stops first, then covered, then passengers, then delay, then time.
**For:** Transparent; no weights to justify. **Against:** Any difference in the first term dominates everything else — one uncovered stop outweighs an hour's delay for 500 people.

### Option 3 — Weighted sum with hard constraints, terms shown individually
**For:** Expresses trade-offs; ordering of weights encodes P-6; terms remain visible so the score only orders and never hides. **Against:** Weight values are value judgements needing justification.

### Option 4 — Present the Pareto set unranked
**For:** No value judgement imposed. **Against:** Pushes the whole trade-off onto a controller under time pressure; conflicts with C4.4's aim of bounding load.

## Decision

**Option 3, bounded by Option 4.** Infeasible options are discarded. Non-dominated options are kept and ordered by `w_u·L_u + w_c·L_c + w_p·P + w_d·D + w_t·T`, with weight ordering `w_u ≫ w_c > w_p > w_d ≫ w_t`. Every term is displayed next to the score. The criticality term `K` exists and is null; its absence is displayed.

The reference implementation uses demonstration weights, labelled as such.

## Rationale

The weighted sum is the only option that both expresses P-6 and gives a controller a short ordered list. Restricting it to the Pareto set means the score never promotes an option strictly worse than another. Showing the terms means the controller can overrule the weights without having to trust them ([P-1](../01-stage-one-architecture/methodology/architecture-principles.md#p-1--the-human-decides)).

## Consequences

- **Positive:** explicit, explainable, overridable.
- **Negative:** weights are a value judgement the project cannot settle; all stops are treated as equal because `K` cannot be populated — a known equity deficiency against P-7, displayed on every recommendation.

## Review trigger

When stop-criticality data or operator obligations become available; or if controllers in any real trial overrule the top option systematically.
