# Documentation

Start here if you are reading the project rather than looking for something specific.

## Suggested reading order

For a first pass, this order builds the context each document assumes:

1. [Project Charter](00-project/project-charter.md) — what this is and why
2. [Scope](00-project/scope.md) — and, more usefully, what it is not
3. [Architecture Method](01-stage-one-architecture/methodology/architecture-method.md) — how the work is structured, and what was left out of the method
4. [Architecture Principles](01-stage-one-architecture/methodology/architecture-principles.md) — the rules that decide close calls, and what each one costs
5. [Architecture Governance](01-stage-one-architecture/methodology/architecture-governance.md) — how decisions are controlled with no second person to control them
6. [The Fact / Assumption Model](02-stage-two-reference-implementation/fact-vs-assumption-model.md) — the convention the whole of Stage Two rests on
7. [Assumptions Register](02-stage-two-reference-implementation/assumptions.md) — what is being supposed, and what it costs if wrong

If you have time for three documents, read 4, 6 and 7. The principles say what the project will trade away; the assumption model and register say what it does not know. Together those are the parts a reader cannot reconstruct from the rest.

## Map

| Area | Contents |
|---|---|
| [`00-project/`](00-project/) | Charter, scope, glossary |
| [`01-stage-one-architecture/`](01-stage-one-architecture/) | Method, principles, governance, and the ADM-inspired phases A–H |
| [`02-stage-two-reference-implementation/`](02-stage-two-reference-implementation/) | Fictional operating environment, assumptions, requirements, design |
| [`03-sdlc/`](03-sdlc/) | Lifecycle, testing strategy, CI/CD |
| [`04-operations/`](04-operations/) | Observability, KPIs, runbooks |
| [`05-architecture-decisions/`](05-architecture-decisions/) | ADRs |

## Conventions

**Identifiers are stable.** `BR-`, `AR-`, `FR-`, `NFR-`, `US-`, `TC-`, `ADR-`, `A-`, `R-`, `P-`. Once published, never reused and never renumbered. Full list in the [glossary](00-project/glossary.md#identifier-prefixes).

**ADRs are immutable.** A decision changes by supersession, never by edit.

**Stage Two claims are classified.** FACT, ASSUMPTION, DESIGN DECISION or FUTURE CONSIDERATION — every one of them.

**Diagrams are Mermaid, inline, and each one communicates a decision.** If a diagram can be deleted without losing information, it should be.

## Current state

Project Phase 1 (foundation) is complete. Phase 2 produces the Stage One architecture artefacts; every phase folder currently holds a README stating what will go in it and the exit condition it must satisfy.

The [roadmap](../README.md#15-roadmap) tracks milestones as Git tags.
