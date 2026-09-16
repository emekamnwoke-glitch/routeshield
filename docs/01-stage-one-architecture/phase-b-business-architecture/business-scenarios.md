# Business Scenarios

| | |
|---|---|
| **Phase** | B — Business Architecture |
| **Document version** | 1.0 |
| **Status** | Baseline |

---

Scenarios exist to test the architecture, not to illustrate it. Each one below was chosen because it stresses something: an autonomy band, a degraded input, a conflict between requirements, or a case the baseline concept does not handle.

All locations are **illustrative Dublin geography**. No scenario describes a real event, and none implies knowledge of how any operator responded to anything.

---

## BS-1 · Sudden corridor closure — the nominal case

**Situation.** A collision closes a quays corridor in both directions at 08:20. Six routes pass through it. Eleven vehicles are in service on those routes; four have already cleared the closure, five are approaching within ten minutes, two are far enough back to be re-planned comfortably.

**Autonomy band.** A1 — no contingency route matches this exact closure.

| Stage | What happens | Capability |
|---|---|---|
| 1 | Incident source reports a closure; controller confirms | C1.1, C1.4 |
| 2 | Six routes, eleven vehicles, 23 stops identified — **the four already past are excluded** | C2.1, C2.2, C2.3 |
| 3 | Alternatives generated per route; two rejected on turning-circle feasibility | C3.1, C3.2 |
| 4 | Options ranked; best preserves 19 of 23 stops; three of the four skipped are covered by a following service within 12 minutes | C3.3, C3.4 |
| 5 | Controller sees the recommendation, its cost, and that traffic data is 90 seconds stale; approves | C4.1, C4.2 |
| 6 | Seven drivers receive revised sequences concurrently; stop-level information publishes | C5.1, C5.3 |
| 7 | Decision and inputs recorded | C7.1 |

**What this tests.** The base path, and specifically C2.2's past/approaching distinction — without it, four drivers receive a pointless instruction, which erodes trust in every subsequent one.

**Requirements exercised.** BR-005 → BR-009, BR-012 → BR-015, BR-019 → BR-021, BR-026, BR-029, BR-036.

---

## BS-2 · Moving protest — the case the model does not handle well

**Situation.** A protest march sets off from a city-centre assembly point at 13:00 and moves north over ninety minutes. It is not a closure at a location; it is a closure that travels.

**Autonomy band.** A1, degrading toward A0 as the footprint's validity decays.

**What happens.** [A-007](../../02-stage-two-reference-implementation/assumptions.md#a-007) represents a disruption as a geographic footprint plus a time window. A moving protest violates that model directly. The system can represent it only as a sequence of static footprints, each one stale as soon as it is computed. Recommendations based on the 13:00 footprint are wrong by 13:20, and the failure is not visible in the output — a confidently-presented recommendation about a road the protest has already left looks identical to a correct one.

| Consequence | |
|---|---|
| Recommendations decay silently | Confidence must decay with footprint age, not only with input staleness |
| Re-assessment must be continuous, not event-driven | The architecture assumes assessment is triggered by a disruption event |
| Reversion may be needed for a road that reopened behind the march | C6.1 has no trigger for partial clearance |

**What this tests.** The most consequential assumption in the register, against the disruption type the baseline proposal names *first* among its use cases. The concept's own headline scenario is the one its data model handles worst.

> **This scenario is the designated candidate for the Phase H feedback loop.** If Stage Two confirms that static footprints cannot usefully represent moving disruptions, the correct response under [P-11](../methodology/architecture-principles.md#p-11--architecture-changes-before-implementation-does) is an ADR, an impact assessment across the conceptual data model, and an amendment — not a workaround in the optimiser. Recorded in advance so that the loop, when it runs, is demonstrably not retrofitted.

---

## BS-3 · Recurring flood point — pre-approved activation

**Situation.** A low-lying road known to flood is reported impassable at 17:40. It has flooded eleven times in two years. A contingency route exists, approved four months ago for this corridor, this disruption type, and up to three affected services. Two services are affected. A controller is on duty.

**Autonomy band.** A2 — all six conditions hold.

| Stage | What happens |
|---|---|
| 1 | Report received; confirmed |
| 2 | Two routes, three vehicles, seven stops |
| 3 | Contingency route matched; conditions verified — corridor ✓, type ✓, confidence above A2 threshold ✓, approval unexpired ✓, blast radius 2 ≤ 3 ✓, controller on duty ✓ |
| 4 | **Activated without a decision in the moment.** Controller notified; revocation window open |
| 5 | Drivers and passengers informed |
| 6 | Activation recorded against the approving person, not the controller |

**What this tests.** That A2's six conditions are individually checkable, and that accountability attaches to the *approver* rather than the on-duty controller. It also tests the governance boundary: had a fourth service been affected, condition 5 fails and the whole thing drops to A1 — which is the behaviour that keeps A2 from expanding by drift.

**Requirements exercised.** BR-017, BR-025, BR-036.

---

## BS-4 · Telemetry outage during a disruption — degraded operation

**Situation.** A corridor closure at 07:50, during which the vehicle position feed becomes unavailable. Fleet assignment data is still current; the scheduled network is known; positions are not.

**Autonomy band.** A0, then A1 with declared degradation.

**What happens.** C2.2 cannot identify affected vehicles by position. Impact assessment falls back to schedule-based inference: which trips *should* be in the affected area. This is materially worse — it cannot distinguish vehicles already past the closure from those approaching, the distinction BS-1 showed to be load-bearing.

| Response | |
|---|---|
| Impact assessment continues at reduced fidelity | BR-011, BR-045 |
| Confidence state drops and is shown to the controller | BR-043, BR-044 |
| A2 becomes unavailable — confidence is below its threshold | BR-046 |
| Recommendations carry an explicit "positions unknown" qualifier | BR-019, BR-044 |

**What this tests.** [P-3](../methodology/architecture-principles.md#p-3--degrade-do-not-fail) in the specific correlated case that matters: the conditions creating the need are the conditions degrading the inputs. It also tests that degradation constrains *autonomy*, not merely presentation — a system that kept activating pre-approved routes on inferred positions would be using automation precisely where it is least warranted.

---

## BS-5 · Six simultaneous disruptions — the load case

**Situation.** Severe weather. Six unrelated disruptions across the network within eleven minutes. 19 routes affected. One controller on duty; duty manager available.

**Autonomy band.** Mixed — two match contingency routes (A2); four are novel (A1).

**What happens.** This is the scenario the manual process cannot handle and where the new system's own risk peaks.

| Concern | Response |
|---|---|
| Assessment must not degrade with breadth | BR-009 — flat to ~20 routes |
| Four novel recommendations exceed what one controller can evaluate | BR-023 bounds the queue |
| Beyond the bound, decisions escalate to the duty manager | BR-022 |
| Blast radius is large, so confidence gating tightens | BR-046, autonomy §4 |
| Approval speed is monitored for rubber-stamping | BR-024 |

**What this tests.** The tension the architecture is least comfortable with. High load is simultaneously the strongest argument for autonomy and the strongest argument against it, and the model resolves it toward caution: saturation constrains A2 rather than relaxing it. Whether that is the right call is genuinely uncertain — it trades throughput for supervision at the moment throughput is most valuable — and it rests on [A-011](../../02-stage-two-reference-implementation/assumptions.md#a-011), which the project cannot validate.

---

## BS-6 · Driver refuses — the exception that is not an error

**Situation.** A driver receives a revised sequence requiring a right turn onto a road where a delivery vehicle is unloading. From where they are, the manoeuvre is not possible. They decline.

**Autonomy band.** A1, returning to decision.

| Stage | What happens |
|---|---|
| 5 | Driver declines with a reason | BR-027 |
| — | **The refusal returns to the controller as a decision, not to a log as an error** | BR-028 |
| 4 | Controller sees the refusal and the next-ranked option |
| 5 | Revised instruction issued to that vehicle only |
| 7 | Both the refusal and its reason are recorded | BR-036 |

**What this tests.** That the architecture can represent "no" from the only participant physically present at the point of execution. A design in which refusal is an error state has decided that the person who can see the road does not get a say (SC-011, SC-012).

The recorded reason also feeds C7.3: repeated refusals on the same manoeuvre are evidence that C3.2's feasibility model is wrong about that junction — one of the few mechanisms by which the system can learn the tacit network knowledge that BR-R2 warns is otherwise lost.

---

## BS-7 · The system is unavailable — manual fallback

**Situation.** A corridor closure at 16:30. RouteShield is unavailable.

**Autonomy band.** A3.

**What happens.** The control room runs the as-is process: recall, judge, contact drivers sequentially. This is not a failure of the design — it is [C8.4](capability-map.md#c8--operational-resilience--cross-cutting), retained deliberately.

**What this tests.** Whether the fallback is real. Two risks converge here and neither is architectural:

| Risk | |
|---|---|
| The fallback has atrophied through disuse | BR-R3 — it must be *practised*, not merely documented |
| Tacit knowledge was never captured and the people who held it have moved on | BR-R2 |

The scenario is included because it is the one the architecture cannot fix. BR-047 obliges the design not to degrade the manual process, but keeping it exercised is an organisational commitment. An architecture that quietly assumed its own availability would have no answer for the day it is wrong — and disruption is when both the load and the dependency stress peak, which is to say the system is most likely to be unavailable exactly when this scenario begins.

---

## Coverage

| Scenario | Bands | Stresses |
|---|---|---|
| BS-1 | A1 | Nominal path; past/approaching distinction |
| BS-2 | A1→A0 | A-007; the concept's own headline use case |
| BS-3 | A2 | Six conditions; displaced accountability |
| BS-4 | A0→A1 | Correlated input failure; degradation constrains autonomy |
| BS-5 | A1+A2 | Load; the autonomy model's sharpest tension |
| BS-6 | A1 | Refusal as a decision |
| BS-7 | A3 | The fallback the architecture cannot guarantee |

All four autonomy bands are exercised. Three scenarios (BS-2, BS-5, BS-7) test things the architecture handles **badly or not at all**, which is the more useful half of the set.
