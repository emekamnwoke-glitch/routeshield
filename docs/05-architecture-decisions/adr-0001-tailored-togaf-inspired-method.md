# ADR-0001: Use a tailored TOGAF-inspired method rather than an ad-hoc structure

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | Preliminary |
| **Principles engaged** | P-10, P-11 |
| **Requirements** | — (predates requirements) |
| **Supersedes** | — |

---

## Context

RouteShield begins from a competition proposal: a persuasive document describing a capability, with no architecture behind it. The project's purpose is to take that concept through to a governed architecture and a working implementation, and to make the path between them visible.

A single author working part-time could structure that work in any number of ways. The structure chosen is not cosmetic — it determines the order in which questions get asked, and therefore which questions get asked at all.

The audience matters too. This repository is intended to be read by architects, including in interview settings. The structure is part of what is being communicated.

## Problem

What lifecycle structure should Stage One follow?

## Options considered

### Option 1 — No formal method; organise by topic

Write the architecture as a set of documents organised by subject — data, applications, security, deployment — in whatever order they become clear.

**For:** Lowest overhead. No ceremony. Fastest route to substantive content. Nothing written purely to satisfy a framework.

**Against:** No dependency ordering, so technology decisions get made before the application components they host exist, and application boundaries get drawn before data ownership is understood. No notion of a baseline, therefore no meaningful notion of an architecture *change* — which removes the ability to demonstrate the feedback loop that is charter objective O-5. Topic-organised architecture also tends to expand to fill available effort, because nothing defines when a topic is finished.

### Option 2 — Full TOGAF ADM, applied as specified

Adopt the ADM and its supporting structures as documented.

**For:** Recognised, complete, well-understood. Nothing to invent.

**Against:** The ADM assumes a continuing enterprise architecture function inside an organisation — an Architecture Board, business transformation readiness assessment, capability-based portfolio planning, formal architecture contracts between parties. None of those have a referent here. Applying them literally would produce artefacts describing governance that does not exist, which is worse than having no governance artefact at all: it is a false statement about how the work is controlled. It would also risk reproducing proprietary content, which the project must not do.

### Option 3 — A different framework (C4, arc42, Zachman)

**For:** C4 and arc42 are lighter and well-suited to describing a software system.

**Against:** They describe a *solution*, not an enterprise architecture lifecycle. C4 has no phase for business capability modelling, no requirements management discipline, and no concept of architecture governance or change control. It would document the answer without documenting how the answer was reached — which is the specific thing this project exists to show. Zachman is a classification schema rather than a method; it says what artefacts exist, not what order to produce them in.

### Option 4 — A tailored lifecycle inspired by the ADM

Borrow the ADM's phase structure and requirements-management discipline. Explicitly document what is omitted and why.

**For:** Preserves the dependency ordering, which is the genuinely valuable part. Immediately legible to an architecture audience. Provides a baseline, so architecture change becomes a meaningful and demonstrable event. Reproduces no proprietary content. The tailoring decisions are themselves architecturally interesting — what a method leaves out, and why, says more than what it includes.

**Against:** Requires writing the method rather than adopting one. Carries a risk of *appearing* to claim framework compliance while not delivering it. Some readers will judge the tailoring itself.

## Decision

**Option 4.** Stage One follows a tailored lifecycle inspired by the TOGAF ADM, independently written, with all omissions documented and justified in [`architecture-method.md`](../01-stage-one-architecture/methodology/architecture-method.md).

## Rationale

The dependency ordering was the deciding factor. The single most common failure in this kind of work is answering technology questions before business questions, and the ADM's phase sequence is a well-tested defence against exactly that. No lighter alternative provides it.

The second factor was objective O-5. Demonstrating the architecture-to-implementation feedback loop requires a baseline to change *from* and a defined process for changing it. Option 1 cannot provide this, and Option 3 has no concept of it.

P-10 — no unnecessary infrastructure — applies to method as much as to technology, and drove the rejection of Option 2. Adopting ADM structures with no referent would be the methodological equivalent of deploying a service mesh for a single-user system.

## Consequences

### Positive

- Architectural questions are answered in an order where the answers are actually available.
- A baseline exists, so change is demonstrable.
- Requirements management is continuous rather than an early-phase activity, which matches how requirements actually arrive.
- The structure is immediately navigable by the intended audience.

### Negative

- Method documentation is overhead that produces no direct architectural content.
- Tailoring decisions are exposed to criticism in a way that adopting a framework wholesale would not be.
- The phase structure invites completeness for its own sake — a pull that must be actively resisted, since every phase has a section that *could* be filled.

### Neutral

- The repository's shape will be familiar to architects and unfamiliar to software engineers, who may expect a C4-style layout. The two are not in conflict; C4-style views appear within Phase C.

## Risks

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| Method mistaken for a claim of TOGAF compliance | Medium | Medium | Explicit statement at the head of the method document and in the README |
| Phase structure drives documentation for its own sake | High | Medium | Each phase has an exit *condition*, not a document list; a phase completes on the condition, not on the folder being full |
| Tailoring judged as inadequate | Medium | Low | Omissions documented with reasons, so the judgement is about the reasoning rather than about an unexplained gap |

## Alternatives rejected

**Option 1 (no method)** — rejected for lack of dependency ordering and inability to support architecture change. *Would become right if* the project's goal were a solution design rather than a demonstration of architectural practice.

**Option 2 (full ADM)** — rejected as disproportionate and partly unreferenced. *Would become right if* the project acquired real stakeholders, real governance bodies and multiple contributing parties.

**Option 3 (C4 / arc42)** — rejected for absence of a business architecture and governance lifecycle. *Would become right if* the scope narrowed to Stage Two alone. C4-style views are used *within* Phase C regardless; this decision concerns the overall lifecycle, not the notation.

## Review trigger

Revisit if the project acquires additional contributors, or if a phase's exit condition proves unachievable with the tailoring as specified.
