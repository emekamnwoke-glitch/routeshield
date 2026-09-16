# Stage One — Enterprise Architecture

Stage One answers one question: **what should this capability look like, independent of who builds it or what they build it with?**

It is technology-neutral and stands on its own. Its value does not depend on Stage Two being finished.

## Methodology

| Document | |
|---|---|
| [Architecture Method](methodology/architecture-method.md) | The tailored lifecycle, what was omitted from it, and why |
| [Architecture Principles](methodology/architecture-principles.md) | P-1 to P-11 — the rules that decide close calls, each with its cost |
| [Architecture Governance](methodology/architecture-governance.md) | How decisions are controlled when there is no second person to control them |

## Phases

| Phase | Question it answers | Status |
|---|---|---|
| Preliminary | Are we set up to do architecture work here at all? | 🟢 Complete |
| [A — Architecture Vision](phase-a-architecture-vision/) | What are we trying to achieve, for whom, and how will we know? | ⬜ |
| [B — Business Architecture](phase-b-business-architecture/) | What does the business need to be able to do? | ⬜ |
| [C — Data Architecture](phase-c-information-systems/data-architecture/) | What information does this depend on, and who owns it? | ⬜ |
| [C — Application Architecture](phase-c-information-systems/application-architecture/) | What components exist, and where are the boundaries? | ⬜ |
| [D — Technology Architecture](phase-d-technology-architecture/) | What does this run on, and how is it secured and observed? | ⬜ |
| [E — Opportunities & Solutions](phase-e-opportunities-solutions/) | What gets built, in what order? | ⬜ |
| [F — Migration Planning](phase-f-migration-planning/) | How do we get there, and what could stop us? | ⬜ |
| [G — Implementation Governance](phase-g-implementation-governance/) | Is the thing being built the thing that was designed? | ⬜ |
| [H — Change Management](phase-h-change-management/) | What do we do when we learn we were wrong? | ⬜ |

Each phase completes on an **exit condition**, not on its folder being full. The conditions are stated in the [method](methodology/architecture-method.md#5-phase-definitions) and repeated in each phase README.

Data Architecture precedes Application Architecture within Phase C. That ordering is deliberate: boundaries that cut across data ownership are the most expensive kind to get wrong ([P-8](methodology/architecture-principles.md#p-8--boundaries-follow-data-ownership)).

## Relationship to Stage Two

Stage Two is narrower than Stage One, deliberately. Where it is narrower, the gap is recorded rather than closed by trimming Stage One to match — an architecture that shrinks to fit its prototype has stopped being an architecture.

Implementation does not silently amend architecture. When building reveals an architectural problem, the change goes through the [feedback loop](methodology/architecture-method.md#6-the-architecture--implementation-feedback-loop) first ([P-11](methodology/architecture-principles.md#p-11--architecture-changes-before-implementation-does)).
