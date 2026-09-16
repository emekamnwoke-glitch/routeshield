# Business Requirements

| | |
|---|---|
| **Phase** | B — Business Architecture |
| **Document version** | 1.0 |
| **Status** | Baseline |

---

## 1. Conventions

A business requirement states **what the business must be able to do or guarantee**, in business terms. It does not name a component, a technology or a mechanism — those arrive in Phase C and Phase D.

| | |
|---|---|
| **Identifiers** | `BR-nnn`, stable, never renumbered after publication |
| **Priority** | `MUST` — MVP cannot ship without it · `SHOULD` — required for the capability to be complete · `COULD` — valuable, deferrable |
| **Source** | The objective, concern or risk that motivates it. A requirement with no source is unjustified and is a governance defect |
| **Verification** | How satisfaction would be demonstrated. Requirements that cannot be verified in this project say so |

---

## 2. Requirements

### Disruption awareness

| ID | Requirement | Pri | Source | Capability |
|---|---|---|---|---|
| **BR-001** | Become aware of a disruption from an authoritative source, an inferred signal, or a human declaration | MUST | OBJ-1 | C1.1 |
| **BR-002** | Accept a disruption declared by a controller when no automated source has reported one | MUST | OBJ-7, SC-039 | C1.1, C8.4 |
| **BR-003** | Determine the type of disruption, because type predicts duration and behaviour | SHOULD | OBJ-1 | C1.2 |
| **BR-004** | Establish the geographic extent and expected time window of a disruption | MUST | OBJ-2 | C1.3 |
| **BR-005** | Require human confirmation that a detected disruption is real before any service change is proposed | MUST | P-1, BR-R4 | C1.4 |

> **BR-002 is the floor.** It is the one requirement whose failure leaves nothing working. Every automated source can be absent and the capability survives; without a manual declaration path there is no system.
>
> **BR-005** separates detection from confirmation deliberately. In a system that reroutes buses, a false positive strands real people at real stops for no reason. The cost of a false positive is not a wasted alert.

### Impact assessment

| ID | Requirement | Pri | Source | Capability |
|---|---|---|---|---|
| **BR-006** | Identify every route whose path intersects the disruption | MUST | OBJ-2 | C2.1 |
| **BR-007** | Identify every in-service vehicle affected, distinguishing those already past the disruption from those approaching it | MUST | OBJ-2 | C2.2 |
| **BR-008** | Identify every stop that becomes unservable | MUST | OBJ-2, OBJ-4 | C2.3 |
| **BR-009** | Assess all affected services concurrently, such that assessment time does not scale with the number affected | MUST | OBJ-2 | C2 |
| **BR-010** | Estimate the passengers affected — on board, waiting, and dependent on an affected stop | SHOULD | OBJ-3 | C2.4 |
| **BR-011** | Produce an impact assessment even when no viable response can be found | MUST | OBJ-7 | C2, C8.3 |

> **BR-009 is the requirement that addresses the actual problem.** The manual process fails by scaling linearly with the size of the disruption, which means it performs worst when most needed. A system that is merely faster but still linear has improved the constant and left the shape intact.
>
> **BR-011** exists because "these eight services are affected, no viable diversion found" is enormously more useful to a controller than silence. It is why impact assessment is a separate capability from optimisation.

### Response options

| ID | Requirement | Pri | Source | Capability |
|---|---|---|---|---|
| **BR-012** | Generate candidate alternative paths around the disruption | MUST | OBJ-3 | C3.1 |
| **BR-013** | Establish that a candidate path is physically usable by the vehicle type in service | MUST | OBJ-3, A-008 | C3.2 |
| **BR-014** | Determine whether a skipped stop can be served by a following service | SHOULD | OBJ-3, SC-005 | C3.3 |
| **BR-015** | Rank candidates against service continuity — stops preserved and passengers served — not vehicle travel time | MUST | OBJ-3, P-6 | C3.4 |
| **BR-016** | Account for dependency on a stop, and not only volume of use, when evaluating the cost of skipping it | SHOULD | OBJ-3, P-7, SC-006 | C3.4 |
| **BR-017** | Retrieve a pre-approved contingency route where one matches the disruption | SHOULD | OBJ-1, BO-4 | C3.5 |
| **BR-018** | Support hold, split and terminate as outcomes, not only reroute | MUST | OBJ-3, A-008 | C3.4, C4.1 |

> **BR-013** is separate from BR-012 because connectivity is not feasibility. A path a car can take is not necessarily one a twelve-metre bus can take, and a system that does not ask the question will confidently produce impossible answers.
>
> **BR-016 cannot currently be satisfied.** Stop-level dependency data does not exist in open sources ([A-010](../../02-stage-two-reference-implementation/assumptions.md#a-010)). It is stated at full strength anyway, with the gap declared, because narrowing it to what is measurable would quietly abandon SC-006 and SC-008 while leaving the architecture looking complete.

### Decision

| ID | Requirement | Pri | Source | Capability |
|---|---|---|---|---|
| **BR-019** | Present each recommendation with its ranking rationale, what it gives up, and what was not known | MUST | OBJ-5, SC-015 | C4.1 |
| **BR-020** | Require approval by an identified person before any novel service change takes effect | MUST | P-1, OBJ-5 | C4.2 |
| **BR-021** | Support approval, rejection and modification, and record which occurred | MUST | OBJ-5, SC-017 | C4.2 |
| **BR-022** | Determine who may decide what, and escalate decisions beyond that authority | SHOULD | SC-018, OBJ-10 | C4.3 |
| **BR-023** | Bound the volume of recommendations awaiting a decision to what the decision-maker can evaluate | MUST | OBJ-9, BR-R1 | C4.4 |
| **BR-024** | Detect and surface approval behaviour indicating decisions are not being evaluated | SHOULD | OBJ-9, BR-R1 | C4.4 |
| **BR-025** | Permit activation without a decision in the moment only where a previously approved contingency route matches, within its approved conditions | MUST | Autonomy model §3 | C3.5, C4.2 |

> **BR-024 is a requirement to measure the system's own failure.** If approvals arrive faster than a person could read the reasoning, OBJ-5 has failed in substance while succeeding in form, and no other metric would reveal it — throughput, latency and acceptance rate would all be improving. It is uncomfortable to specify and is the single best evidence that BR-R1 was taken seriously.

### Activation

| ID | Requirement | Pri | Source | Capability |
|---|---|---|---|---|
| **BR-026** | Deliver a revised stop sequence to every affected driver concurrently, in time to act before the diversion point | MUST | OBJ-1, SC-009 | C5.1 |
| **BR-027** | Receive driver acknowledgement, and driver refusal with a reason | MUST | SC-011, SC-012 | C5.2 |
| **BR-028** | Return a refused instruction to the decision-maker rather than treating it as an error | MUST | SC-011 | C5.2, C4.2 |
| **BR-029** | Publish stop-level disruption information while a waiting passenger's alternatives still exist | MUST | OBJ-4, SC-001 | C5.3 |
| **BR-030** | State the alternative available, not only that a stop is unserved | SHOULD | SC-002 | C5.3 |
| **BR-031** | Maintain an authoritative record of what each service is currently doing | MUST | OBJ-6 | C5.4 |

### Closure

| ID | Requirement | Pri | Source | Capability |
|---|---|---|---|---|
| **BR-032** | Become aware that a disruption has ended | SHOULD | OBJ-8 | C6.1 |
| **BR-033** | Prompt a reversion decision on clearance rather than awaiting one | MUST | OBJ-8, SC-022 | C6.2 |
| **BR-034** | Restore services to the planned sequence and inform drivers and passengers again | MUST | OBJ-8 | C6.3 |
| **BR-035** | Prevent a diversion from persisting indefinitely without an explicit decision to retain it | MUST | SC-024 | C6.2 |

> **BR-035** guards against permanent network change by accident. A diversion nobody reverts becomes the route, and no decision was ever taken to make it so.

### Accountability and learning

| ID | Requirement | Pri | Source | Capability |
|---|---|---|---|---|
| **BR-036** | Record every recommendation, decision, activation, refusal and reversion, immutably | MUST | OBJ-6, P-2 | C7.1 |
| **BR-037** | Capture inputs as they stood at decision time, including inputs that were stale or absent | MUST | OBJ-6 | C7.1 |
| **BR-038** | Reconstruct any past decision from the record alone, including the uncertainty under which it was made | MUST | OBJ-6, SC-026 | C7.2 |
| **BR-039** | Make the decision record interpretable by a party outside the operator | SHOULD | OBJ-10, SC-029 | C7.2 |
| **BR-040** | Determine what actually resulted from a decision | COULD | BO-4, SC-023 | C7.3 |
| **BR-041** | Convert recurring disruption patterns into candidate contingency routes for human approval | COULD | BO-4 | C7.4 |
| **BR-042** | Restrict analytics to service and decision outcomes, not individual driver behaviour | SHOULD | SC-041 | C7.3 |

> **BR-038, not BR-036, is the requirement that matters.** Recording is easy. Reconstruction is what a passenger complaint, an executive question or a regulatory enquiry actually needs — and a record that cannot reproduce what was *unknown* at the time flatters every decision it contains.
>
> **BR-042** is enforced by the data model in Phase C rather than by policy. A constraint that depends on nobody choosing to run a particular query is not a constraint.

### Resilience

| ID | Requirement | Pri | Source | Capability |
|---|---|---|---|---|
| **BR-043** | Know which inputs are healthy, stale or absent | MUST | OBJ-7, P-3 | C8.1 |
| **BR-044** | Derive a confidence state and carry it through to the recommendation presented | MUST | OBJ-7, SC-016 | C8.2 |
| **BR-045** | Continue to operate with any single input absent | MUST | OBJ-7, P-3 | C8.3 |
| **BR-046** | Constrain the scope of automatic activation according to confidence | MUST | Autonomy §4, BR-R5 | C8.2, C4.2 |
| **BR-047** | Preserve the manual disruption response as a usable fallback | MUST | SC-039, BR-R3 | C8.4 |

> **BR-046 is where BR-R5 is answered.** Concurrency amplifies error as much as throughput: one bad assessment now diverts twenty services at once. Confidence must gate *breadth*, not merely annotate the output.
>
> **BR-047** obliges the design not to degrade the process it replaces. The fallback must remain practised, which is an organisational commitment the architecture can require but cannot itself deliver.

---

## 3. Priority summary

| Priority | Count |
|---|---|
| MUST | 30 |
| SHOULD | 13 |
| COULD | 4 |
| **Total** | **47** |

## 4. Capability coverage

The Phase B exit condition requires **every capability to trace to at least one business requirement.**

| Capability | Requirements |
|---|---|
| C1.1 Detection | BR-001, BR-002 |
| C1.2 Classification | BR-003 |
| C1.3 Characterisation | BR-004 |
| C1.4 Confirmation | BR-005 |
| C2.1 Route impact | BR-006, BR-009 |
| C2.2 Vehicle impact | BR-007, BR-009 |
| C2.3 Stop impact | BR-008, BR-009 |
| C2.4 Passenger impact | BR-010 |
| C3.1 Alternative paths | BR-012 |
| C3.2 Feasibility validation | BR-013 |
| C3.3 Coverage analysis | BR-014 |
| C3.4 Option ranking | BR-015, BR-016, BR-018 |
| C3.5 Contingency retrieval | BR-017, BR-025 |
| C4.1 Presentation | BR-019, BR-018 |
| C4.2 Decision capture | BR-020, BR-021, BR-025, BR-028, BR-046 |
| C4.3 Authority & escalation | BR-022 |
| C4.4 Decision load management | BR-023, BR-024 |
| C5.1 Driver instruction | BR-026 |
| C5.2 Acknowledgement & refusal | BR-027, BR-028 |
| C5.3 Passenger information | BR-029, BR-030 |
| C5.4 Service state update | BR-031 |
| C6.1 Clearance detection | BR-032 |
| C6.2 Reversion decision | BR-033, BR-035 |
| C6.3 Reversion activation | BR-034 |
| C7.1 Decision recording | BR-036, BR-037 |
| C7.2 Decision reconstruction | BR-038, BR-039 |
| C7.3 Outcome analysis | BR-040, BR-042 |
| C7.4 Contingency development | BR-041 |
| C8.1 Input health | BR-043 |
| C8.2 Confidence | BR-044, BR-046 |
| C8.3 Degraded operation | BR-011, BR-045 |
| C8.4 Manual fallback | BR-002, BR-047 |

**32 of 32 capabilities covered. Exit condition satisfied.**

Reverse check — every requirement traces to a capability: no orphans in either direction.

## 5. Requirements that cannot be satisfied in this project

Declared rather than quietly downgraded:

| ID | Why not |
|---|---|
| **BR-016** | Stop-level dependency data does not exist in open sources ([A-010](../../02-stage-two-reference-implementation/assumptions.md#a-010)). Stated at full strength with the gap declared. |
| **BR-024** | The rubber-stamping detector requires real controllers under real load. Demonstrable in mechanism, unverifiable in substance ([A-011](../../02-stage-two-reference-implementation/assumptions.md#a-011)). |
| **BR-030** | Naming a usable alternative requires accessibility data the project does not have (SC-007, deferred in Phase A). |
| **BR-047** | An organisational commitment. The architecture can require it; no repository can deliver it. |

## 6. Into Phase C

These requirements constrain Phase C in three specific ways:

**BR-037 and BR-038 constrain the data architecture first.** Capturing inputs as they stood — including what was absent — is not a logging concern. It shapes the conceptual data model, because a decision must reference immutable snapshots of its inputs rather than pointers to mutable current state.

**BR-042 must be enforced structurally.** Analytics restricted to service outcomes rather than driver behaviour is a data ownership boundary ([P-8](../methodology/architecture-principles.md#p-8--boundaries-follow-data-ownership)), not a query convention.

**BR-011 and BR-045 constrain component boundaries.** Impact assessment must be able to complete when optimisation cannot. That forbids a design in which assessment and optimisation share a failure domain.
