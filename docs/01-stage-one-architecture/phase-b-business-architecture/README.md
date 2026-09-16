# Phase B — Business Architecture

> **Status: complete.** Exit condition satisfied — see [§ Exit condition](#exit-condition).

Phase B turns Phase A's objectives into capabilities the business must have, requirements those capabilities must satisfy, and a process that differs from today's in ways attributable to named capabilities.

## Documents

| | |
|---|---|
| [Business Capability Map](capability-map.md) | 8 capability groups, 32 capabilities, business actors, and a heat map of where the gap actually is |
| [As-Is and To-Be Process](as-is-to-be-process.md) | Both processes, twelve attributable differences, and five risks the to-be introduces |
| [Autonomy Model](autonomy-model.md) | Four bands, the six conditions for pre-approved activation, and what is never automatic |
| [Value Streams](value-streams.md) | Where value is created, where it is currently lost, and who receives it |
| [Business Requirements](business-requirements.md) | 47 requirements (`BR-001`–`BR-047`) with full capability coverage |
| [Business Scenarios](business-scenarios.md) | Seven scenarios, three of which test what the architecture handles badly |

## What Phase B settles

**The autonomy boundary.** Phase A resolved the concept's contradiction at headline level — analysis is automated, authority is not. Phase B draws the actual line: four bands, with pre-approved contingency activation permitted only under six simultaneous conditions, and six things that are never automatic regardless of confidence. The insight underneath is that **automation is a property of a decision, not of a system**: what makes activation safe is not machine confidence but a human having already decided, deliberately, with time to think.

**Reversion becomes a requirement.** BR-033 and BR-035 make returning to plan a prompted decision rather than something noticed, closing the gap where a diversion nobody reverts silently becomes the route.

**Refusal becomes a decision.** BR-028 returns a driver's refusal to the controller rather than to an error log. The driver is the only participant who can see the road.

## What Phase B found that changes the emphasis

Two independent analyses — the [capability heat map](capability-map.md#5-capability-heat-map) and [where value is lost](value-streams.md#2-where-value-is-currently-lost) — converge on the same finding:

**The gap is in impact assessment, passenger information and the decision record. It is not in routing.** Controllers are good at knowing where a bus can go; feasibility judgement is a current *strength*. The baseline concept leads with route optimisation, which sits in the value stream stage with the least loss. Optimisation is necessary to make assessment and activation work at scale, but a design treating it as the centrepiece would be polishing the part that is not broken.

This does not invalidate the concept. It reorders it.

## What Phase B admits it makes worse

The as-is has one dominant failure mode: it is too slow. The to-be is faster and introduces five new ones ([§6](as-is-to-be-process.md#6-risks-the-to-be-introduces)), of which one is structural:

**Speed and blast radius are the same property.** The manual process contains errors by being slow — a controller working through drivers one at a time notices a wrong assumption at driver three. Removing the slowness removes the containment. One bad assessment now diverts twenty services concurrently. BR-046 answers this by making confidence gate *breadth* of activation, not merely annotate the output.

And one that no metric would reveal: if approval volume outpaces evaluation capacity, accountability becomes ceremony while throughput, latency and acceptance rate all improve. BR-024 requires the system to detect its own failure here.

## Exit condition

| Check | |
|---|---|
| Every capability traces to at least one business requirement | ✅ 32 of 32 — [coverage matrix](business-requirements.md#4-capability-coverage) |
| Every requirement traces to a capability | ✅ No orphans in either direction |
| The to-be process differs from the as-is in ways attributable to named capabilities | ✅ 12 differences, each attributed — [§3](as-is-to-be-process.md#3-what-changed-and-which-capability-changed-it) |
| The autonomy model deferred from Phase A is defined | ✅ [Autonomy model](autonomy-model.md) |

**Phase B exit condition satisfied.**

## Into Phase C

Three Phase B requirements constrain the data architecture before the application architecture can be drawn:

- **BR-037, BR-038** — capturing inputs *as they stood*, including what was absent, means a decision must reference immutable snapshots rather than pointers to mutable current state. That is a conceptual data model constraint, not a logging concern.
- **BR-042** — restricting analytics to service outcomes rather than driver behaviour is a data ownership boundary ([P-8](../methodology/architecture-principles.md#p-8--boundaries-follow-data-ownership)), enforced structurally rather than by query convention.
- **BR-011, BR-045** — impact assessment must complete when optimisation cannot, which forbids the two sharing a failure domain.

[Phase C](../phase-c-information-systems/) develops data architecture first for exactly this reason.
