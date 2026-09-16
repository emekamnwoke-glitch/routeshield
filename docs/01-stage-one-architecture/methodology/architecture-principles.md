# Architecture Principles

| | |
|---|---|
| **Document version** | 1.0 |
| **Status** | Baseline |
| **Applies to** | All architecture and implementation decisions in this project |

---

## How these are meant to be used

A principle is only useful if it can be violated. "The system should be reliable" is not a principle, because no design decision was ever made in favour of unreliability. A usable principle has a cost — it tells you what to give up when two good things conflict.

Each principle below states what it costs. Where two principles conflict, the lower-numbered one wins, and the conflict is recorded in an ADR rather than resolved silently.

Principles are cited by identifier (`P-1` … `P-11`) in ADRs and architecture artefacts.

---

## P-1 — The human decides

**Statement.** RouteShield recommends. A human controller decides. The system never activates a novel route change without a human approving it.

**Rationale.** Rerouting a bus in service is an operational instruction with consequences for people standing at stops and a driver on a road the system cannot see. Accountability for that instruction must rest with a person who can be asked to justify it. A system that acts autonomously in this domain relocates accountability to a place where it cannot be discharged.

**Implications.**
- Every decision path terminates in an approve/reject step before it affects service.
- The recommendation must carry its reasoning, not just its conclusion. A controller cannot be accountable for a decision they were not given grounds to evaluate.
- Decision latency includes human deliberation time, which sets a hard floor on end-to-end response and must be designed for rather than engineered around.
- The system must behave sensibly when the controller rejects the recommendation, including when they reject it repeatedly.

**Cost.** Speed. A fully autonomous system would be faster. This principle deliberately gives that up.

**Exception.** Pre-approved contingency routes for known corridors may activate automatically, because the human decision was made in advance, deliberately, and recorded. The autonomy model in Phase B defines this precisely.

---

## P-2 — Every decision is auditable

**Statement.** Every recommendation, approval, rejection, activation and reversion is recorded immutably, with its inputs, its reasoning, its actor and its time.

**Rationale.** In a disrupted network, the question asked afterwards is always "why did the 46A skip those stops?" — and it is asked by passengers, by the operator, by the regulator and occasionally by a court. An answer that cannot be reconstructed from the record is not an answer. Audit is also the only mechanism by which the system's decisions can be evaluated and improved.

**Implications.**
- The audit log is append-only. There is no update path and no delete path.
- Inputs are captured as they were at decision time, not looked up later. A decision made on stale traffic data must be reconstructable as having been made on stale traffic data.
- Audit is a functional requirement, not an operational afterthought, and appears in the architecture as a first-class component.
- Storage grows monotonically; retention is a policy decision, not an engineering convenience.

**Cost.** Write volume, storage, and the discipline of capturing context that is usually discarded.

---

## P-3 — Degrade, do not fail

**Statement.** Loss of any single input source reduces the quality of RouteShield's recommendations. It does not stop them.

**Rationale.** The system is most needed exactly when conditions are abnormal, and abnormal conditions are correlated with input failure — a flood that closes a road also takes out roadside sensors; an incident that triggers a network response also spikes the load on every feed. A design that requires all inputs to be healthy is a design that is unavailable when it matters.

**Implications.**
- Every input has a defined degraded mode and a defined absent mode.
- Recommendations carry a confidence indication derived from input availability, so the controller knows what the system was working with.
- No input is architecturally mandatory except the control-room override, which is the manual floor the whole system stands on.
- Resilience testing is a required test category, not an optional one.

**Cost.** Considerable design complexity. Every component acquires a "what if this is missing" branch.

---

## P-4 — Open and standard before proprietary

**Statement.** Where an open standard or open dataset can do the job, it is used in preference to a proprietary equivalent, even at some loss of capability.

**Rationale.** Three reasons, in order of weight. It keeps the architecture portable between operators rather than binding it to one vendor's estate. It makes the reference implementation reproducible by anyone, which a portfolio project requires. And it removes cost, which is a hard project constraint.

**Implications.**
- Network data comes from GTFS and OpenStreetMap, not from commercial mapping platforms.
- Interfaces to fictional external systems are modelled on published standards (GTFS-Realtime, SIRI) rather than invented freely, which keeps the fiction disciplined.
- Where an open option is genuinely inferior — commercial traffic data is more accurate than anything open — the gap is recorded as a limitation rather than disguised.

**Cost.** Capability. The baseline proposal named commercial traffic APIs for good reason; this principle gives up their accuracy.

---

## P-5 — Distinguish what is known from what is supposed

**Statement.** Every load-bearing claim about the operating environment is classified as FACT, ASSUMPTION, DESIGN DECISION or FUTURE CONSIDERATION, and no design element depends on an unregistered assumption.

**Rationale.** This project designs against an environment it cannot observe. The difference between a useful architecture and a fantasy is entirely whether that gap is tracked. It is also the difference between "here is what I would need to validate on day one" and "here is a design that will surprise you."

**Implications.**
- The assumptions register is maintained as a first-class artefact, not an appendix.
- Assumptions carry the reason they are necessary, so their cost is visible.
- A fictional system's behaviour may be assumed, but the assumption is written down before the code relying on it exists.
- Any figure derived from synthetic data is labelled as such at the point of use, not only in the methodology.

**Cost.** Writing overhead, and the discomfort of publishing how much of the design rests on supposition.

---

## P-6 — Minimise service loss, not travel time

**Statement.** The optimisation objective is continuity of service to passengers, not shortest path for vehicles.

**Rationale.** This is the principle that distinguishes RouteShield from a satellite navigation system, and it comes directly from the baseline concept. A generic router will happily produce a fast detour that bypasses a dozen stops. For a bus network that is a worse outcome than a slow detour that serves ten of them, because the passengers at those stops are the reason the service exists.

**Implications.**
- The objective function is multi-objective — stops preserved, passengers served, schedule recovery, detour feasibility — and the weights are an explicit, argued decision rather than an emergent property of an algorithm.
- Shortest-path routing is a *component* of the solution, not the solution.
- Skipped stops are a tracked cost with a named beneficiary elsewhere, never a silent side effect.
- Coverage of a skipped stop by a following service is part of the decision, not a separate concern.

**Cost.** The optimisation problem becomes substantially harder and slower than shortest path, and the weights become a value judgement that must be defended.

---

## P-7 — Stop-skipping is not neutral

**Statement.** The decision to skip a stop is evaluated for who it affects, not only for how many.

**Rationale.** Optimising purely for the count of passengers served will reliably strand the passengers least able to absorb being stranded. Stops serving hospitals, care settings, areas with poor alternative connectivity and passengers with reduced mobility are not interchangeable with stops that have three alternatives within two hundred metres. An objective function blind to this distinction will produce decisions that are defensible arithmetically and indefensible publicly.

**Implications.**
- Stop criticality is a modelled attribute in the data architecture, distinct from stop footfall.
- Where the data needed to model criticality properly is unavailable, the gap is declared rather than approximated with footfall as a proxy.
- The equity consequences of the objective function are stated wherever the objective function is stated.

**Cost.** This principle currently cannot be fully honoured — open data does not describe stop-level accessibility need. It is recorded as a principle anyway, with the gap declared in scope, because a principle that is aspirationally binding is more useful than a silence that looks like agreement.

---

## P-8 — Boundaries follow data ownership

**Statement.** Application component boundaries are drawn along data ownership lines. A component that writes to another component's data is a design error.

**Rationale.** Boundaries drawn along team lines, technology lines or convenience lines all decay. Boundaries drawn along ownership of state are the ones that survive, because they are the boundaries that determine who can change what without coordinating.

**Implications.**
- Data architecture precedes application architecture in Phase C, and constrains it.
- Cross-boundary access is by contract only. Shared database access between components is prohibited.
- Any component spanning two data domains requires a recorded justification.

**Cost.** More interfaces, more serialisation, and occasionally a slower path than a direct read would give.

---

## P-9 — Build the smallest thing that delivers an outcome

**Statement.** Each increment delivers a complete business outcome, however narrow. No increment delivers a complete technical layer.

**Rationale.** Horizontal increments — "the data layer", "the API layer" — produce long periods with nothing demonstrable and defer every integration risk to the end. Vertical increments are testable, are demonstrable to a stakeholder, and surface integration problems while they are still cheap.

**Implications.**
- The MVP spans every layer thinly rather than one layer completely.
- A component is built when an increment needs it, not because the architecture names it.
- A smaller working system beats a larger incomplete one, and this preference is binding when the two conflict.

**Cost.** Rework. Thin vertical slices are refactored as later slices arrive, and that refactoring is accepted rather than designed away in advance.

---

## P-10 — No unnecessary infrastructure

**Statement.** A technology enters the architecture when a requirement demands it, and its ADR must name the requirement. Nothing is added because it is conventional, impressive, or expected.

**Rationale.** Portfolio projects have a characteristic failure mode: a message broker, a service mesh, a Kubernetes cluster and four databases serving a system with one user. It signals familiarity with tools and unfamiliarity with judgement. The harder and more valuable demonstration is a system with exactly the parts it needs.

**Implications.**
- Every significant technology has an ADR naming the requirement that justifies it and the simpler option that was rejected.
- "Because it scales" is not a justification without a stated load the architecture must meet.
- The architecture must stay small enough to be walked through and understood in a single conversation.

**Cost.** The repository will look less impressive at a glance to a reader who counts technologies.

---

## P-11 — Architecture changes before implementation does

**Statement.** When implementation reveals an architectural problem, the architecture is amended through the recorded change process before the code diverges from it.

**Rationale.** The alternative — code first, document later — produces an architecture that is always consistent with the implementation and therefore has no independent content. It can never be wrong, which means it can never be informative. The value of an architecture lies precisely in its ability to be contradicted by reality.

**Implications.**
- Divergence between Stage One and Stage Two is a defect, tracked and resolved, not an accepted state.
- The ADR, the impact assessment and the traceability update precede the merge, not follow it.
- At least one such change is carried through end to end and published as a worked example, per charter objective O-5.

**Cost.** It is slower, and it requires admitting in public that an earlier decision was wrong.
