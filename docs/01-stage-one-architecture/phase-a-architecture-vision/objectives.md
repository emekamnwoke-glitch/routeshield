# Objectives and Business Outcomes

| | |
|---|---|
| **Phase** | A — Architecture Vision |
| **Document version** | 1.0 |
| **Status** | Baseline |

---

## 1. Business outcomes

The four outcomes the capability exists to produce. Objectives serve outcomes; measures serve objectives.

| # | Outcome | What changes |
|---|---|---|
| **BO-1** | **Service continuity through disruption** | Services are diverted rather than withdrawn, because diverting can be worked out fast enough to be worth doing |
| **BO-2** | **Passengers retain their options** | People learn their stop is affected while they can still act on it, rather than after their alternatives have expired |
| **BO-3** | **Decisions are defensible** | Every service change can be explained afterwards — to a passenger, an executive, or a regulator — from a record rather than from memory |
| **BO-4** | **The operator learns from disruption** | Recurring corridors accumulate pre-approved responses instead of being re-solved from nothing each time |

BO-2 is the outcome most likely to be dropped under delivery pressure, because it benefits the stakeholder group with the least influence (see [stakeholder map §2](stakeholder-map.md#2-influence-and-interest)). It is listed second deliberately.

## 2. Objectives

Each objective states a measure. Measures here are **targets to design against**, not commitments — several depend on assumptions this project cannot validate, and those are flagged.

---

### OBJ-1 · Compress the time from disruption confirmation to actionable driver instruction

**Statement.** Reduce the elapsed time between a disruption being confirmed and an affected driver holding a revised stop sequence, from a manual process measured in many minutes to one where machine processing is a small fraction of the total.

**Measure.** End-to-end latency from confirmation to driver acknowledgement, decomposed into machine time and human time.

**Target.** Machine processing — impact assessment, option generation, ranking, presentation — completes within 5 seconds of confirmation. Total elapsed time is dominated by controller deliberation, which is the intended outcome of [P-1](../methodology/architecture-principles.md#p-1--the-human-decides) rather than a deficiency.

> **Caveat.** The end-to-end figure depends on [A-011](../../02-stage-two-reference-implementation/assumptions.md#a-011) (controller response ≈60s) and [A-005](../../02-stage-two-reference-implementation/assumptions.md#a-005) (drivers can receive a revised sequence in service). If A-005 is wrong, instructions route through a human relay and this objective's target is unreachable by this design.

**Serves.** BO-1 · **Addresses.** SC-009, SC-014

---

### OBJ-2 · Assess impact across all affected services concurrently

**Statement.** Determine every affected route, stop and vehicle in a single operation, rather than service by service.

**Measure.** Time to produce a complete impact assessment, and its variance as the number of affected routes increases.

**Target.** Assessment time approximately flat from 1 to 20 affected routes. Flatness matters more than absolute speed: the manual process fails by scaling linearly, and a system that also scales linearly has not addressed the problem, only shifted its constant.

**Serves.** BO-1 · **Addresses.** SC-014, SC-020

---

### OBJ-3 · Preserve service coverage, weighted by dependency

**Statement.** Select alternatives that minimise loss of service to passengers, accounting for who depends on a stop and not only how many use it.

**Measure.** Stops preserved as a proportion of the planned sequence; passengers served as a proportion of expected demand; distribution of skipped stops across repeat disruptions on the same corridor.

**Target.** The first two are optimisation outputs with no fixed threshold — the objective is that the optimisation targets them rather than travel time. The third has no target because **it cannot currently be measured**: stop-level dependency data does not exist in open sources ([A-010](../../02-stage-two-reference-implementation/assumptions.md#a-010)).

> **Declared gap.** This objective is partially unachievable as stated. The dependency-weighted half of it rests on [P-7](../methodology/architecture-principles.md#p-7--stop-skipping-is-not-neutral), which is currently aspirational. Stating the objective in full and declaring the gap is preferred to narrowing the objective to what happens to be measurable — the latter would make the architecture look complete while quietly abandoning SC-006 and SC-008.

**Serves.** BO-1, BO-2 · **Addresses.** SC-005, SC-006, SC-008, SC-024

---

### OBJ-4 · Inform affected passengers while their alternatives still exist

**Statement.** Publish stop-level disruption information on a timescale that preserves a waiting passenger's ability to choose differently.

**Measure.** Time from decision approval to stop-level information being publicly available.

**Target.** Within 30 seconds of approval. The number is chosen against the decision a passenger is making — whether to keep waiting — not against a technical capability.

> **Boundary.** Broadcast stop-level information carries no personal-data burden. Individually targeted notification ([A-003](../../02-stage-two-reference-implementation/assumptions.md#a-003)) does, and requires a lawful basis and a DPIA this project does not attempt. The objective is met by the former; the latter is a [FUTURE CONSIDERATION](../../02-stage-two-reference-implementation/fact-vs-assumption-model.md#future-consideration).

**Serves.** BO-2 · **Addresses.** SC-001, SC-002, SC-003, SC-004, SC-013

---

### OBJ-5 · Keep a human accountable, and equip them to be

**Statement.** Every novel service change is approved by an identified person, who is given the reasoning — including what the system did not know — needed to evaluate it.

**Measure.** Proportion of activations carrying an identified approver; proportion of recommendations presenting their ranking rationale and input-confidence state.

**Target.** 100% of both. Neither admits a partial figure: a recommendation without its reasoning makes approval ceremonial, which is the failure mode SC-018 names.

**Serves.** BO-3 · **Addresses.** SC-011, SC-012, SC-015, SC-016, SC-017, SC-019, SC-031

---

### OBJ-6 · Retain every decision and its basis

**Statement.** Record every recommendation, approval, rejection, activation and reversion immutably, with the inputs as they stood at decision time.

**Measure.** Proportion of service changes reconstructable from the record alone, without recourse to anyone's memory.

**Target.** 100%. Reconstruction must include inputs that were stale or missing, so that a decision made on degraded information is reconstructable *as such* — otherwise the record flatters the decision.

**Serves.** BO-3, BO-4 · **Addresses.** SC-021, SC-026, SC-028, SC-029

---

### OBJ-7 · Produce useful output under degraded inputs

**Statement.** Loss of any single input reduces recommendation quality without stopping recommendations, and the reduction is visible to the controller.

**Measure.** Capability retained per input-loss scenario; proportion of degraded-state recommendations that declare their degradation.

**Target.** The system remains operable with any single input absent. Every recommendation produced in a degraded state says so. The control-room override is the sole architecturally mandatory input — it is the manual floor the system stands on.

**Serves.** BO-1 · **Addresses.** SC-016, SC-037, SC-039

---

### OBJ-8 · Return the network to plan promptly after clearance

**Statement.** Treat reversion as a first-class decision with the same support as diversion.

**Measure.** Time from disruption clearance to services restored to the planned sequence; proportion of reversions that are prompted rather than noticed.

**Target.** Reversion prompted automatically on clearance; no rerouted service persists beyond the disruption without an explicit decision to keep it.

> Reversion is the half of the problem that designs in this space routinely omit. It is operationally as hard as diversion and has no dramatic trigger to prompt it — which is precisely why it needs system support more than diversion does.

**Serves.** BO-1 · **Addresses.** SC-022, SC-024

---

### OBJ-9 · Bound the decision load placed on a controller

**Statement.** Limit the rate of recommendations requiring approval to what a controller can genuinely evaluate, and escalate or batch beyond that point.

**Measure.** Concurrent recommendations awaiting approval per controller; time available per decision; proportion approved faster than plausible evaluation.

**Target.** Approval queue depth bounded per controller, with a defined behaviour on breach. The last measure is a **rubber-stamping detector**: approvals systematically faster than a person could read the reasoning indicate that OBJ-5 has failed in substance while succeeding in form.

> This objective exists because OBJ-1 and OBJ-2 create the risk it manages. Making the system faster and broader increases the volume reaching a human whose capacity has not changed. Without a bound, throughput converts accountability into ceremony — and the metrics would show improvement throughout.

**Serves.** BO-3 · **Addresses.** SC-014, SC-018

---

### OBJ-10 · Make the capability governable and explicable

**Statement.** Support external scrutiny of how automated recommendation over a public service is governed, bounded and audited.

**Measure.** Availability of a stated autonomy model; auditability of the decision record by a party outside the operator.

**Target.** The autonomy model is documented and enforced in the architecture rather than in policy alone. The decision record is exportable and interpretable without operator-internal context.

**Serves.** BO-3 · **Addresses.** SC-027, SC-029, SC-030, SC-031

---

## 3. Objectives in tension

| Tension | Treatment |
|---|---|
| OBJ-1 (speed) vs. OBJ-5 (informed human approval) | P-1 decides: speed yields. Machine time is minimised so that human time can be afforded, not so that total time is minimised. |
| OBJ-2 (assess everything at once) vs. OBJ-9 (bound controller load) | Assessment breadth and approval volume are decoupled. Assess all; present within capacity; escalate the remainder. |
| OBJ-3 (dependency-weighted coverage) vs. measurability | Unresolved. The objective is stated in full with the gap declared; it is not narrowed to fit the data. |
| OBJ-4 (inform passengers fast) vs. SC-034 (lawful basis) | Broadcast satisfies the objective; targeted notification is separately governed and out of scope. |

## 4. Concern coverage

The Phase A exit condition: **every stakeholder concern is addressed by a stated objective or explicitly deferred.**

| Concern | Addressed by |
|---|---|
| SC-001, SC-002, SC-003 | OBJ-4 |
| SC-004 | OBJ-4 |
| SC-005 | OBJ-3 |
| SC-006, SC-008 | OBJ-3 — *partially; dependency weighting is a declared gap* |
| SC-007 | **Deferred** — accessibility of a specific alternative requires stop-level accessibility data. [Scope: deferred](../../00-project/scope.md#5-explicitly-deferred). |
| SC-009 | OBJ-1 |
| SC-010 | **Deferred** — in-cab interaction safety rules are operational, not architectural, and unknowable from outside ([A-005](../../02-stage-two-reference-implementation/assumptions.md#a-005)). Constrains OBJ-1's delivery mechanism. |
| SC-011, SC-012 | OBJ-5 |
| SC-013 | OBJ-4 |
| SC-014 | OBJ-1, OBJ-2, OBJ-9 |
| SC-015, SC-016, SC-017, SC-019 | OBJ-5 |
| SC-016 *(also)* | OBJ-7 |
| SC-018 | OBJ-9 |
| SC-020 | OBJ-2 |
| SC-021 | OBJ-6 |
| SC-022 | OBJ-8 |
| SC-023 | **Deferred to Stage Two increment** — historical analytics follows the MVP. Serves BO-4. |
| SC-024 | OBJ-3, OBJ-8 |
| SC-025 | BO-1 via OBJ-1, OBJ-2, OBJ-3 |
| SC-026 | OBJ-6 |
| SC-027 | OBJ-10 |
| SC-028, SC-029 | OBJ-6, OBJ-10 |
| SC-030 | OBJ-10 — *and OBJ-3, subject to its declared gap* |
| SC-031 | OBJ-5, OBJ-10 |
| SC-032 | **Deferred** — avoiding interference with an incident scene requires scene-extent data beyond a disruption footprint ([A-007](../../02-stage-two-reference-implementation/assumptions.md#a-007)). Recorded as a real gap: the system can create this problem. |
| SC-033 | **Deferred** — scope-of-use governance for shared incident data is a data-sharing agreement concern, addressed in Phase C data governance, not by an objective. |
| SC-034, SC-035, SC-036 | **Deferred** — data protection is a FUTURE CONSIDERATION. Phase C sets the data governance frame; the DPIA is not attempted. |
| SC-037, SC-039 | OBJ-7 |
| SC-038 | **Deferred to Phase D** — observability design. |
| SC-040, SC-041 | **Deferred** — industrial relations are outside the architecture's remit. SC-041 is partly addressed structurally in Phase C: analytics operate on service and decision outcomes, not individual driver behaviour, enforced by the data model rather than by policy. |

**Coverage:** 41 concerns. 27 addressed by objectives, 14 explicitly deferred with a reason. No concern is unaddressed and unacknowledged.

> Twelve of the fourteen deferrals concentrate in three areas: accessibility data, data protection, and industrial relations. That clustering is itself a finding. Each is a domain where the architecture's limits are set by something other than technical difficulty — by data that does not exist, by law that requires a qualified assessment, or by agreements between parties. An architecture that quietly absorbed these would be claiming competence it does not have.

## 5. Exit condition

| Check | |
|---|---|
| Every stakeholder group has at least one named concern | ✅ 13 groups, 41 concerns |
| Every concern is addressed by an objective or explicitly deferred | ✅ 27 addressed, 14 deferred with reasons |
| Objectives carry measures | ✅ All 10, with unmeasurable elements declared rather than omitted |
| Conflicts between concerns identified and resolved or declared | ✅ 6 conflicts; 1 declared live and unresolved (SC-025 vs SC-006) |

**Phase A exit condition satisfied.**
