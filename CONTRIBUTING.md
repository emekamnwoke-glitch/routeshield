# Contributing

RouteShield is a personal portfolio project with a single author. It is not seeking contributions.

This document exists anyway, because the conventions below are the ones the project holds itself to, and writing them down is part of the point.

## Conventions

### Branching

| Branch | Purpose |
|---|---|
| `main` | Integrated, releasable state. Every milestone tag points here. |
| `architecture/stage-one` | Stage One architecture development |
| `implementation/stage-two` | Stage Two reference implementation |
| `architecture/<change-name>` | A specific architecture change |
| `feature/<feature-name>` | A specific implementation feature |
| `docs/<change-name>` | Documentation-only change |

Work merges into `main` when complete. Completed stages are **not** left isolated in long-lived branches — milestones are marked with tags, so the history of `main` reads as the project developing over time.

### Commits

Conventional-commit style, imperative mood:

```
docs(phase-b): add business capability map
feat(routing): add stop-skip minimisation constraint
fix(disruption): correct geographic footprint bounds check
adr(0007): record decision on embedded store
```

One logical change per commit. A commit that touches an architecture artefact and its traceability entry is one logical change; a commit that touches two unrelated phases is two.

### Authorship

All work in this repository is authored by Chukwuemeka Nwoke. Commits, documents, source files and metadata carry no other attribution, and no contributors — human or otherwise — are to be invented.

### Documentation

- Markdown throughout.
- Mermaid for diagrams, so they diff and review like code. No binary diagram formats committed as the source of truth.
- Every diagram communicates a decision. If a diagram can be deleted without losing information, it should be.

### Requirements and traceability

Every requirement carries a stable identifier and is never renumbered once published:

| Prefix | Meaning |
|---|---|
| `BR-nnn` | Business requirement |
| `AR-nnn` | Architecture requirement |
| `FR-nnn` | Functional requirement |
| `NFR-nnn` | Non-functional requirement |
| `US-nnn` | User story |
| `TC-nnn` | Test case |
| `ADR-nnn` | Architecture decision record |
| `A-nnn` | Assumption |
| `R-nnn` | Risk |

A change that adds a requirement also updates the traceability matrix in the same commit. An orphaned requirement — one with no capability above it or no test below it — is a defect in the architecture, not a documentation gap.

### Architecture decisions

Any decision that is expensive to reverse, constrains later choices, or that a reviewer might reasonably question gets an ADR. Use `docs/05-architecture-decisions/adr-template.md`. ADRs are immutable once accepted: to change a decision, write a new ADR that supersedes the old one and update the old one's status. Do not edit history.

### The Stage One / Stage Two boundary

This is the rule most easily broken and most damaging to break.

Implementation work in Stage Two does not silently amend Stage One. When building reveals an architectural problem — and it will — the sequence is:

1. Document the problem.
2. Raise an ADR.
3. Assess the impact on existing architecture artefacts.
4. Update the affected artefact.
5. Update requirements and traceability.
6. Then implement.

Demonstrating that loop is a deliverable of this project. Short-circuiting it for convenience would remove the thing the repository is trying to show.

### Facts and assumptions

No statement in Stage Two depends on an unregistered assumption. If building something requires supposing that a fictional system behaves a certain way, that supposition gets an `A-nnn` entry in the assumptions register before the code that relies on it is written.
