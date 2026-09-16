# The Fact / Assumption Model

| | |
|---|---|
| **Document version** | 1.0 |
| **Status** | Baseline |
| **Governing principle** | [P-5 — Distinguish what is known from what is supposed](../01-stage-one-architecture/methodology/architecture-principles.md#p-5--distinguish-what-is-known-from-what-is-supposed) |

---

## 1. Why this exists

This project designs a system that integrates with an operational environment the author cannot observe. Dublin Bus's internal architecture, APIs, data models, infrastructure and operational systems are not public, and nothing in this repository is based on privileged knowledge of them.

There are two honest ways to handle that. Restrict the project to what can be verified, which would reduce it to a business case with no implementation. Or invent the missing environment and track every invention rigorously.

This project takes the second route. The entire credibility of Stage Two rests on the tracking being rigorous. A reference implementation built on undeclared supposition is not a reference implementation; it is a guess wearing the costume of one.

The practical test this model is designed to pass: **a reader should be able to tell, for any statement in Stage Two, whether the author knew it or made it up — without having to ask.**

## 2. The four classifications

Every load-bearing statement about the operating environment carries exactly one.

### FACT

Supported by the original RouteShield proposal, or by a citable public source.

A fact must be checkable by the reader. "GTFS-Realtime defines a `VehiclePosition` message" is a fact — the specification is public. "Dublin Bus operates a control room" is a fact in the weak sense that it is publicly known that the operator has operational control functions; it is not a fact that the control room has any particular system in it.

Facts drawn from the baseline proposal are facts *about the proposal*, not about the world. The proposal stating that RouteShield will use Garda feeds is a fact about what was proposed. It is not evidence that such a feed exists or could be obtained.

That distinction is easy to lose and is the single most common way this model degrades.

### ASSUMPTION

Required to build the fictional implementation, but not known to represent any real system.

Assumptions carry identifiers `A-nnn`, and every assumption records:

| Field | Purpose |
|---|---|
| Statement | What is being supposed |
| Classification | `ASSUMPTION` |
| Reason | Why the truth is unavailable |
| Purpose | What in the design depends on it |
| Confidence | How plausible it is, and on what grounds |
| If wrong | What breaks, and how expensively |
| Validation | How a real implementation would check it on day one |

The `If wrong` field is the one that earns its keep. An assumption whose failure costs an afternoon is not the same object as an assumption whose failure invalidates the data architecture, and a register that does not distinguish them is a list rather than a risk instrument.

### DESIGN DECISION

A choice made for this reference implementation, where alternatives existed and one was selected.

Design decisions are not assumptions — nothing is being supposed about the world. They are constrained by the project's own limits (no budget, no backend, one author) rather than by missing knowledge. Significant ones are recorded as ADRs; minor ones are annotated inline.

The distinguishing question: *could a better-informed author have avoided this?* If yes, it is an assumption. If no — if it would remain a choice regardless of what you knew — it is a design decision.

### FUTURE CONSIDERATION

Identified as necessary for a real implementation, deliberately not addressed here.

These are declared, not silent. An unaddressed concern that is named is a scoping decision. The same concern unnamed is an oversight, and a reader cannot tell the two apart unless the naming is done.

## 3. Applying the classification

### Where it appears

| Location | Form |
|---|---|
| Architecture and design documents | Inline callout at first use of a load-bearing claim |
| Source code | Comment referencing the assumption identifier where behaviour depends on it |
| API and interface definitions | Interface-level note naming every assumption it embodies |
| Synthetic data | Labelled inside the file, not only by its directory |
| Metrics and model results | Labelled as properties of synthetic data at the point of quotation |

Inline form:

```markdown
> **A-004 · ASSUMPTION** — The Reference Vehicle GPS Platform emits position
> updates at 30-second intervals. Real telemetry cadence is unknown.
> *If wrong:* affected-vehicle identification granularity changes; the
> disruption-detection window would need to be re-derived.
```

### The registration rule

**No unregistered assumption may be load-bearing.** If writing a component requires supposing something about a fictional system, the assumption is registered *before* the component is written, not documented afterwards.

The ordering is the whole control. Retrospective registration produces a register that describes the code, which is exactly the failure mode described in P-11.

### Classification in the pull request checklist

Every pull request touching Stage Two confirms:

- [ ] Every new environmental claim is classified
- [ ] Every new assumption is registered with all seven fields
- [ ] No existing assumption has been silently promoted to fact
- [ ] Synthetic-derived figures are labelled at the point of use

## 4. Worked examples

These are the classifications that motivated the model, taken from the baseline proposal.

### "Emergency & Garda Feeds"

The proposal names An Garda Síochána and national emergency services as a high-confidence incident source.

| | |
|---|---|
| **Classification** | `ASSUMPTION` (A-002) |
| **Why not fact** | No public An Garda Síochána incident API exists. A real-time incident feed to a third party would require a legal basis, a data-sharing agreement and an interface that are not publicly documented and may not exist. |
| **Why it is still in the design** | A high-confidence authoritative incident trigger is architecturally load-bearing — it is the input that distinguishes a confirmed closure from inferred congestion. Removing it would change the disruption-detection design fundamentally. |
| **If wrong** | The detection model loses its authoritative trigger and must rely on inference plus control-room confirmation, materially raising false-positive rates. |

### "Live Traffic APIs (e.g. Google Maps Platform, TomTom)"

| | |
|---|---|
| **Classification** | `DESIGN DECISION` — superseded by an open-data equivalent |
| **Why not assumption** | Nothing is being supposed. Both platforms exist and expose the described data. |
| **Why it changed** | They are metered commercial services, which collides with charter constraint C-2 and principle P-4. |
| **Consequence** | The reference implementation uses simulated traffic conditions over an OpenStreetMap-derived network, with a documented adapter boundary where a commercial provider would attach. The accuracy loss is a declared limitation, not a hidden one. |

### "Push notifications via the Dublin Bus app"

| | |
|---|---|
| **Classification** | `ASSUMPTION` (A-003) + `FUTURE CONSIDERATION` |
| **Why** | Assumes access to a mobile estate, a notification platform and an opted-in user base, none of which are observable. It also raises GDPR questions — stop-level notification implies journey inference about identifiable individuals — that a real implementation must answer and this one does not. |
| **Treatment** | The notification interface is designed against the fictional Reference Passenger Information System. The data-protection analysis is declared as a future consideration rather than attempted. |

## 5. Degradation modes to watch for

This model fails gradually and quietly. The observed failure modes:

| Mode | Symptom |
|---|---|
| **Assumption drift** | An assumption is restated in a later document without its classification, and by the third restatement reads as established |
| **Proposal laundering** | "The proposal says X" becomes "X", losing the distinction between a fact about the document and a fact about the world |
| **Retrospective registration** | The register is filled in after the code, so it documents implementation rather than constraining it |
| **Classification inflation** | Everything is marked `DESIGN DECISION` because it sounds more authoritative than `ASSUMPTION` |
| **Synthetic laundering** | A model accuracy figure computed on synthetic data is quoted later without the qualifier |

Milestone reviews check for all five explicitly (see [governance §7](../01-stage-one-architecture/methodology/architecture-governance.md#7-review-points)).

## 6. Register

The live register is [`assumptions.md`](assumptions.md). The fictional systems the assumptions attach to are defined in [`fictional-operating-model.md`](fictional-operating-model.md).
