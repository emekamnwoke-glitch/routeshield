# Phase A — Architecture Vision

> **Status: complete.** Exit condition satisfied — see [objectives §5](objectives.md#5-exit-condition).

Phase A fixes what this capability is for, who cares about it, and how success would be recognised. Everything in later phases is answerable to what is established here.

## Documents

| | |
|---|---|
| [Problem Statement](problem-statement.md) | What actually goes wrong, why a mapping application does not solve it, and what a solution must be true of |
| [Stakeholder Map](stakeholder-map.md) | 13 stakeholder groups, 41 concerns, and the conflicts between them |
| [Objectives and Business Outcomes](objectives.md) | 4 outcomes, 10 objectives with measures, and full concern coverage |
| [Architecture Vision](architecture-vision.md) | System context, conceptual architecture, and six architectural commitments |

## What Phase A settles

**The core tension is resolved.** The baseline concept promises response "without relying on manual intervention" while also specifying a control-room override. These are different systems. Phase A resolves it: *analysis is automated, authority is not.* The precise boundary — including when a pre-approved contingency route may activate without a human in the moment — is drawn in Phase B's autonomy model.

**Impact assessment is separated from optimisation.** The concept folds them together. They are different problems with different failure modes, and separating them means the system can still tell a controller what is affected when it cannot find a viable diversion.

**Reversion is added.** The concept does not mention returning to plan. A diversion that never ends is a permanent network change made by accident.

**A new risk is named.** OBJ-1 and OBJ-2 make the system faster and broader, which increases the volume of decisions reaching a controller whose capacity has not changed. Without a bound, approval degrades into rubber-stamping — accountability in form, absent in substance — and every metric would show improvement throughout. OBJ-9 exists to manage the risk that the other objectives create.

## What Phase A declares it cannot do

Fourteen of the 41 stakeholder concerns are deferred, and twelve of those cluster in three areas: **accessibility data, data protection, and industrial relations.** In each, the limit is not technical difficulty — it is data that does not exist, law requiring qualified assessment, or agreements between parties. Absorbing them quietly would claim competence this project does not have.

One conflict is recorded as **live and unresolved**: executive-level service continuity (SC-025) counts passengers, while dependent-passenger fairness (SC-006) concerns which ones. [P-7](../methodology/architecture-principles.md#p-7--stop-skipping-is-not-neutral) decides it in principle, but P-7 is currently unachievable for want of stop-level dependency data. The conflict is declared rather than closed on paper.

## Into Phase B

Phase A produces objectives. [Phase B](../phase-b-business-architecture/) turns them into business requirements (`BR-nnn`), maps the capabilities that satisfy them, models the as-is and to-be process, and defines the autonomy model that Phase A has deferred to it.
