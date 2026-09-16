# ADR-0017: Bound automation by bands, with prior human approval as the only basis for acting unattended

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | E — Opportunities & Solutions *(model defined in Phase B)* |
| **Principles engaged** | P-1, P-2, P-3 |
| **Requirements** | BR-020, BR-025, BR-046 |
| **Supersedes** | — |

---

## Context

The baseline concept promised response "without relying on manual intervention" while specifying a control-room override. [Phase B's autonomy model](../01-stage-one-architecture/phase-b-business-architecture/autonomy-model.md) resolved this. This ADR records the decision formally so that it is subject to the same supersession rules as other decisions — autonomy is exactly the kind of choice that tends to drift if it is not held in place.

## Problem

When, if ever, may RouteShield change service without a human deciding at that moment?

## Options considered

### Option 1 — Full automation above a confidence threshold
**For:** Fastest. **Against:** Confidence is a property of the model, not of accountability; places decisions where no one can be asked to justify them; blast radius grows with speed.

### Option 2 — Never automatic
**For:** Simplest accountability. **Against:** Discards the concept's pre-built contingency routes, whose value is near-instant response on known corridors.

### Option 3 — Four bands (A0 observe, A1 recommend, A2 pre-approved, A3 manual); A2 only where a named human approved the route in advance, under six simultaneous conditions
**For:** Keeps the concept's ambition; places accountability on a person who decided with time to think; checkable conditions. **Against:** Requires governance of the contingency library; parameters cannot be set from a desk.

## Decision

**Option 3.** Six things are never automatic: activating an unapproved route, overriding a driver's refusal, terminating a service, acting with no controller on duty, adding to the contingency library, and changing autonomy thresholds.

## Rationale

What makes unattended activation safe is not machine confidence but a prior human decision. Option 3 is the only option that expresses that.

## Consequences

- **Positive:** accountability always has an owner; A2 cannot expand without an explicit decision.
- **Negative:** contingency governance (expiry, review, separation of duties) is ongoing work; threshold values are future considerations.

## Review trigger

Any proposal to add a condition under which the system acts without prior approval requires a superseding ADR.
