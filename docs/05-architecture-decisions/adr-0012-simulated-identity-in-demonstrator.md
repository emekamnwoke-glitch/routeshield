# ADR-0012: Simulate identity in the demonstrator; keep authorisation logic real

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | D — Technology Architecture |
| **Principles engaged** | P-1, P-5 |
| **Requirements** | BR-020, BR-022, INV-05, INV-06 |
| **Depends on** | ADR-0008 |
| **Supersedes** | — |

---

## Context

The operator profile authenticates people through an OIDC identity provider with MFA. The demonstrator has no server ([ADR-0008](adr-0008-browser-hosted-static-demonstrator.md)). Much of the architecture's value depends on *who* may decide *what*: authority grants, separation of duties, the on-duty condition for A2, attribution of every decision.

## Problem

How should the demonstrator handle identity and authorisation?

## Options considered

### Option 1 — Omit identity
**Against:** Removes attribution, authority and separation of duties — the parts of the design that make P-1 real.

### Option 2 — Real sign-in via a free hosted identity service
**For:** Real tokens. **Against:** Tokens validated only in the browser protect nothing; asks visitors for accounts; introduces client secrets or redirect configuration for no security gain.

### Option 3 — Simulated identities, real authorisation
A persona switcher (controller, duty manager, contingency approver, administrator) sets the current actor. All authority checks, grants, duty status and separation-of-duties rules run as they would in the operator profile.

**For:** Every authorisation rule is exercised and visible; nobody signs in. **Against:** Anyone can become anyone — which must be stated.

## Decision

**Option 3.** The demonstrator presents fictional personas behind a clearly labelled switcher. Access Control (AC-14) is implemented in full over those personas, behind the same `IdentityPort` an OIDC adapter would implement.

## Rationale

In a static site authentication cannot be meaningful, so pretending otherwise would be the worst option. What *can* be demonstrated faithfully is authorisation, and that is where this architecture's substance is.

## Consequences

- **Positive:** reviewers can try the separation-of-duties and A2 rules directly by switching persona.
- **Negative:** no authentication security is demonstrated. The UI states this on every screen where a persona is shown.
- **Neutral:** an OIDC adapter is specified by the port and not built.

## Review trigger

If a hosted multi-user variant is built.
