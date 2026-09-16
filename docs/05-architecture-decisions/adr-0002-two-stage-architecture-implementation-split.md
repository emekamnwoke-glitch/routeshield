# ADR-0002: Separate the project into an architecture stage and a fictional implementation stage

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | Preliminary |
| **Principles engaged** | P-5, P-11 |
| **Requirements** | — (predates requirements) |
| **Supersedes** | — |

---

## Context

RouteShield integrates with an operational environment that the author cannot observe. The internal architecture, APIs, data models, infrastructure and operational systems of any real transport operator are not public, and this project is built on no privileged access to them.

This is not a gap that research closes. It is structural. An outsider can learn what a bus network does; they cannot learn what its fleet management system's interface looks like, or whether its telemetry arrives every five seconds or every sixty.

Meanwhile the project needs a working implementation. An architecture never tested against code is an architecture whose weak points stay hidden, and demonstrating the architecture-to-implementation feedback loop is charter objective O-5.

These two facts pull in opposite directions. The implementation must integrate with systems whose behaviour is unknowable.

## Problem

How should the project handle the gap between an architecture that must be credible and an implementation that must integrate with systems it cannot see?

## Options considered

### Option 1 — Architecture only; no implementation

Stop at the design. Produce a rigorous enterprise architecture and leave it there.

**For:** Nothing needs to be invented. Every statement stays defensible. Matches the author's existing portfolio repositories, which are documentation-only.

**Against:** Forfeits objective O-5 entirely — there is no implementation, so there is no feedback loop and no way to discover which parts of the design do not survive contact with code. It also forfeits the more unusual half of the demonstration. Architects who cannot build are common; the point of this project is to show the join.

### Option 2 — Implement against a generic, unspecified environment

Build the system without naming what it integrates with. Keep interfaces abstract.

**For:** Avoids inventing anything. Nothing false is asserted.

**Against:** Abstraction here is evasion. A design that never commits to an interface shape never has to confront latency, freshness, failure modes or protocol mismatch — the things that actually determine whether an integration architecture works. It produces a design that cannot be wrong, and is therefore uninformative. It also quietly hides assumptions rather than removing them: abstract interfaces still assume request/response semantics, still assume availability, still assume a data model. The assumptions are simply unwritten.

### Option 3 — Implement against a plausible reconstruction presented as real

Research the operator, infer the likely architecture, and present the result as the integration target.

**For:** Concrete. Reads as authoritative.

**Against:** It would be dishonest, and the dishonesty would be load-bearing rather than incidental. It misrepresents a third party's systems in a public repository, and a reader — including an interviewer — could not distinguish researched fact from confident guess. Any such reader who knows the real environment would immediately identify the errors, and the whole artefact would lose credibility at once. This option is rejected on integrity grounds before any technical consideration.

### Option 4 — Two explicit stages, with an explicitly fictional operating environment

Stage One: a technology-neutral architecture, standing on its own. Stage Two: an implementation against a set of clearly labelled fictional reference systems, with every supposition registered and classified.

**For:** Permits a concrete, opinionated implementation with real interface shapes and real failure modes, while asserting nothing false about anyone. The assumptions register becomes an artefact in its own right — a day-one discovery backlog for anyone attempting this for real. The stage boundary doubles as a governance control, preventing implementation from silently rewriting architecture (P-11). And it directly demonstrates the discipline of separating what is known from what is supposed, which is a large part of real architectural practice under uncertainty.

**Against:** More documentation. Requires sustained discipline — the classification model degrades quietly if not actively maintained. And a reader skimming could still misread Stage Two as a claim about a real operator, which places weight on the disclaimers being genuinely prominent.

## Decision

**Option 4.** The project is split into Stage One (architecture, technology-neutral, standing alone) and Stage Two (reference implementation against explicitly fictional systems). Every environmental claim in Stage Two is classified under the [Fact / Assumption Model](../02-stage-two-reference-implementation/fact-vs-assumption-model.md).

## Rationale

Option 3 was eliminated on integrity grounds, not technical ones, and that elimination is not close.

Between the remaining three, the deciding consideration was that **Option 2's abstraction hides assumptions rather than removing them.** An abstract interface is not assumption-free; it is assumption-unwritten. Option 4 takes the same assumptions and makes them visible, gaining a concrete implementation in the process. It is strictly better on the dimension that matters — P-5.

Option 1 was the genuine runner-up and would have been a defensible project. It was rejected because forfeiting the implementation forfeits the specific thing this repository is trying to prove.

A secondary benefit settled it: the stage boundary is load-bearing as a governance control. With one author there is no separation of duties, and the structural controls in the governance model are all substitutes for a reviewer who does not exist. The Stage One / Stage Two boundary is one of the few that can be stated as a rule and checked.

## Consequences

### Positive

- The implementation can be concrete and opinionated without asserting anything false.
- The assumptions register becomes independently useful as a validation backlog.
- The stage boundary provides a governance control in a project that badly needs one.
- The project demonstrates working under genuine uncertainty, which is closer to real architectural practice than working from a complete specification.

### Negative

- Substantially more documentation overhead than a single-stage project.
- The classification discipline degrades quietly if not maintained; its failure modes are gradual rather than obvious.
- A skimming reader may still mistake Stage Two for a claim about a real operator, which makes disclaimer prominence a permanent obligation rather than a one-off task.
- Stage Two will be narrower than Stage One, and that gap has to be openly carried rather than closed by trimming Stage One to match.

### Neutral

- Stage One's value is independent of whether Stage Two is ever finished. This is a real property of the split and worth stating.

## Risks

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| Stage Two read as a claim about a real operator | Medium | High | Prominent README notice; fictional systems labelled at every point of use; no operator branding anywhere |
| Classification discipline degrades over time | High | High | Registration-before-implementation rule; PR checklist; explicit degradation-mode check at every milestone review |
| Fictional environment diverges so far from reality that nothing useful is demonstrated | Medium | Medium | Model fictional interfaces on published open standards (GTFS-Realtime, SIRI) rather than inventing freely |
| Implementation silently amends architecture | Medium | High | P-11 feedback loop; divergence treated as a defect with a defined resolution path |

## Alternatives rejected

**Option 1 (architecture only)** — rejected for forfeiting the implementation half of the demonstration. *Would become right if* the project had to be delivered in a fraction of the time; Stage One alone is a coherent deliverable.

**Option 2 (generic abstraction)** — rejected because abstraction conceals assumptions rather than eliminating them, and produces a design that cannot be falsified. *Would become right if* the goal were a reusable product architecture intended for many unknown environments rather than a demonstration of one.

**Option 3 (plausible reconstruction presented as real)** — rejected on integrity grounds. *Would become right if* the author had legitimate access to the real environment and permission to publish it — at which point it would no longer be this option.

## Review trigger

Revisit if the author gains legitimate access to a real operational environment, or if the classification discipline is found to have degraded at two consecutive milestone reviews.
