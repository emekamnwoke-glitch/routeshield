# Project Charter

| | |
|---|---|
| **Project** | RouteShield |
| **Owner** | Chukwuemeka Nwoke |
| **Type** | Personal Enterprise Architecture & Software Engineering portfolio project |
| **Baseline concept** | RouteShield proposal, Dublin Bus Innovation Challenge (Challenge 4: Smart Cities), April 2026 |
| **Status** | Active — Phase 1, Project Foundation |
| **Document version** | 1.0 |

---

## 1. Purpose

To design, document and partially build an emergency rerouting capability for an urban bus network, in a way that demonstrates the full path from business problem to operated software under architectural governance.

The project has two outputs of roughly equal weight:

1. **A governed enterprise architecture** for the capability, developed through a TOGAF-ADM-inspired lifecycle.
2. **A fictional reference implementation** that shows the architecture is buildable, and that surfaces the places where building it teaches you something the architecture got wrong.

## 2. Background

Urban bus networks handle disruption manually. A controller learns of an incident, reasons about the affected services from experience, contacts drivers individually, and passenger-facing information updates last. The approach is workable at low volume and degrades badly when several routes are affected simultaneously — precisely the condition a significant disruption creates.

The RouteShield concept proposes automating the detection-to-decision path while keeping a human controller accountable for the outcome. That concept was developed for a public innovation challenge. This project takes it as a starting point and subjects it to the treatment a real architecture would receive.

## 3. Objectives

| # | Objective | Success criterion |
|---|---|---|
| O-1 | Produce a coherent, governed enterprise architecture for the capability | All ADM phases complete; every requirement traceable from business need to test case |
| O-2 | Establish an unambiguous boundary between what is known and what is supposed | Every Stage Two claim classified; no unregistered assumption load-bearing anywhere |
| O-3 | Demonstrate the architecture is implementable | A running demonstrator executing the full disruption lifecycle on open network data |
| O-4 | Demonstrate a complete, disciplined SDLC | Requirements → stories → design → build → test → pipeline → deploy → operate, all evidenced in the repository |
| O-5 | Demonstrate the architecture ↔ implementation feedback loop | At least one architectural change originating from implementation learning, carried through ADR, impact assessment and traceability update |
| O-6 | Produce an artefact suitable for technical interview discussion | The repository can be walked at any level from business case to source file without a gap in the reasoning |

Objective O-5 deserves emphasis. It is easy to produce an architecture and an implementation that agree, by writing the architecture after the code. The harder and more honest demonstration is an architecture written first, implemented, found wanting in some specific respect, and then formally amended. That sequence is a deliverable, not an accident.

## 4. Scope summary

In scope, at a headline level: the disruption lifecycle from detection through decision to communication and audit, for a bus network, using open network data and synthetic disruptions.

Out of scope: real operator integration, real-time production operation, safety certification, commercial viability analysis, and anything requiring access to systems or data the author does not have.

Full definition: [`scope.md`](scope.md).

## 5. Deliverables

### Stage One — Architecture

| Deliverable | Phase |
|---|---|
| Architecture method, principles, governance model | Preliminary |
| Architecture vision, stakeholder map, target outcomes | A |
| Business capability map, value streams, as-is and to-be process | B |
| Data domains, conceptual and logical data models, data governance | C |
| Application landscape, components, service boundaries, integration architecture | C |
| Technology, runtime, network, security and observability architecture | D |
| Solution building blocks, MVP definition, transition architectures | E |
| Implementation roadmap, release plan, dependency and risk register | F |
| Governance model, compliance approach, traceability mechanism | G |
| Architecture change management process | H |
| Requirements traceability matrix | Continuous |

### Stage Two — Reference implementation

| Deliverable |
|---|
| Fictional operating model and assumptions register |
| Functional and non-functional requirements, product backlog, user stories with acceptance criteria |
| Solution and technical design |
| Working demonstrator covering the MVP disruption lifecycle |
| Test suites across the full pyramid, plus security, performance and resilience testing |
| CI/CD pipelines |
| Operations documentation: runbooks, observability design, KPI definitions |
| Architecture decision records |

## 6. Approach

Eight phases, delivered incrementally, each leaving the repository internally consistent:

| Phase | Content |
|---|---|
| 1 | Repository foundation, charter, scope, assumptions framework, method, principles |
| 2 | Stage One architecture artefacts |
| 3 | Stage Two fictional operating model and assumptions |
| 4 | Requirements and solution design |
| 5 | Working MVP |
| 6 | Tests and CI/CD |
| 7 | ML and advanced capability |
| 8 | Operations, observability, final documentation |

Milestones are published as Git tags on `main`.

## 7. Constraints

| # | Constraint | Consequence |
|---|---|---|
| C-1 | No access to any real operator's systems, APIs, data models or infrastructure | The Stage Two operating environment must be fictional and explicitly labelled as such |
| C-2 | No budget; the demonstrator must be hostable at zero cost | Rules out paid traffic APIs and hosted backends; drives a browser-only deployment target |
| C-3 | No real personal data, and no data requiring a licence the project does not hold | Network data must be open-licensed; disruption and demand data must be synthetic |
| C-4 | Single author, part-time | Favours a smaller working system over a larger incomplete one |
| C-5 | No proprietary framework content may be reproduced | The method is TOGAF-*inspired* and independently written |

Constraint C-2 is the most architecturally consequential and is treated as a first-class design input rather than an inconvenience. It is recorded and reasoned about in the technology architecture, not worked around silently.

## 8. Assumptions

Project-level assumptions are recorded here. System-level assumptions about the fictional operating environment are registered separately in [`../02-stage-two-reference-implementation/assumptions.md`](../02-stage-two-reference-implementation/assumptions.md).

| # | Assumption |
|---|---|
| PA-1 | Open network data of sufficient quality (GTFS, OpenStreetMap) remains freely available for the project's duration |
| PA-2 | Free hosting tiers adequate for a static demonstrator remain available |
| PA-3 | The original proposal remains an accurate statement of the intended business concept |

## 9. Risks

Headline risks only; the full register is maintained from Phase F onward.

| # | Risk | Response |
|---|---|---|
| R-1 | The fictional operating environment diverges so far from reality that the implementation demonstrates nothing useful | Model interfaces on published open standards (GTFS-Realtime, SIRI) rather than inventing freely |
| R-2 | Scope growth produces a large collection of incomplete components | Milestone tags gate progression; a phase does not start until the previous phase is internally consistent |
| R-3 | The browser-only constraint quietly distorts the architecture | The architecture is developed technology-neutral in Stage One; the constraint is applied and justified in Stage Two only |
| R-4 | Synthetic data makes the ML appear more capable than it is | Accuracy figures reported as properties of the synthetic corpus, and stated as such wherever they appear |
| R-5 | The project reads as a claim about a real operator's systems | Prominent disclaimer in the README, the fictional systems labelled at every point of use, and no operator branding anywhere |

## 10. Governance

Single author, therefore no separation between architect and reviewer. This is a genuine weakness in the governance model and is compensated for structurally rather than pretended away:

- Decisions are recorded with alternatives, so the reasoning is auditable after the fact even though it was not challenged at the time.
- ADRs are immutable once accepted; changes supersede rather than edit.
- The Stage One / Stage Two boundary acts as an internal control — implementation cannot silently rewrite architecture.
- Traceability is mechanical, so an unjustified requirement or an untested one is visible rather than hidden.

The governance model is defined in full in [`../01-stage-one-architecture/methodology/architecture-governance.md`](../01-stage-one-architecture/methodology/architecture-governance.md).

## 11. Definition of done

The project is complete when:

- Every ADM phase has produced its deliverables and they do not contradict one another.
- The traceability matrix has no orphaned requirements in either direction.
- The demonstrator executes the full MVP disruption lifecycle reproducibly from a clean checkout.
- Every assumption in Stage Two is registered, classified and justified.
- At least one architectural change has completed the full implementation-to-architecture feedback loop.
- The limitations section of the README is honest rather than defensive.
