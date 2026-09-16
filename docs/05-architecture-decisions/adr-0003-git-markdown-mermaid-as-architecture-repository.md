# ADR-0003: Use Git, Markdown and Mermaid as the architecture repository

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | Preliminary |
| **Principles engaged** | P-4, P-10 |
| **Requirements** | — (predates requirements) |
| **Supersedes** | — |

---

## Context

The method requires an architecture repository: somewhere artefacts live, are versioned, are related to each other, and can be reviewed. It also requires traceability that can be checked, ideally automatically, since that is the only governance control in this project that does not depend on the person it governs.

There is no budget, no organisational tooling, and one author. The repository must also be readable by anyone who opens the project on GitHub without installing anything.

## Problem

What should hold the architecture artefacts and their relationships?

## Options considered

### Option 1 — A modelling tool (Archi, Sparx EA, or similar)

A dedicated architecture tool with a formal metamodel.

**For:** Real model semantics rather than prose. Relationships are typed and queryable. Traceability is a native feature rather than something maintained by hand. Generates views from a single underlying model, so a component renamed in one place is renamed everywhere.

**Against:** The model is a binary or tool-specific file, so it does not diff, does not review in a pull request, and cannot be read by anyone who has not installed the tool. That is disqualifying for a portfolio artefact whose primary consumption path is someone browsing GitHub. Archi is free; Sparx is not, which engages constraint C-2. Both add a tool dependency for a single-author project, which engages P-10.

### Option 2 — A documentation site generator (MkDocs, Docusaurus)

Markdown source, rendered to a published site.

**For:** Markdown source diffs and reviews normally. Produces a polished browsable site. Search and navigation come free.

**Against:** Adds a build step and a hosting target for documentation, before the project has any implementation to host. The navigation and search benefits are real but modest for a repository of this size, and GitHub already renders Markdown with working links. This is infrastructure ahead of requirement — precisely what P-10 prohibits. Worth revisiting once the volume justifies it.

### Option 3 — Git, Markdown and Mermaid, rendered by GitHub

Plain Markdown in the same repository as the code. Diagrams as Mermaid, inline in the documents that depend on them. Identifiers and relative links as the relationship mechanism.

**For:** Architecture and implementation share one history, so an architecture change and the code change it governs can appear in the same commit and the same review — which is what P-11 requires structurally rather than merely by convention. Diagrams are text, so they diff and can be reviewed line by line. No tooling, no build, no hosting. Readable by anyone with a browser. Identifier-based traceability is greppable, which means it is automatable.

**Against:** No model semantics. Relationships are conventions maintained by hand, not constraints enforced by a tool — so a renamed component must be renamed everywhere by search, and nothing will complain if it is not. Mermaid's layout control is limited and it handles large diagrams poorly. Traceability correctness depends on discipline until a checker is written.

## Decision

**Option 3.** Architecture artefacts are Markdown in this repository, diagrams are Mermaid inline in the documents that depend on them, and relationships are expressed through stable identifiers and relative links.

## Rationale

The deciding factor was that architecture and implementation share one history. P-11 requires that architecture change precede implementation change, and the governance model lists that as its weakest control because it rests on discipline alone. Putting both in one repository makes the two changes reviewable *as a single unit*. That is not a complete enforcement mechanism, but it is a meaningful structural improvement over a separate model file that nobody opens during a code review.

The second factor was the consumption path. This is a portfolio artefact, and its most likely reader is someone browsing GitHub who will not install a modelling tool. An architecture that cannot be read where it is published has failed at its primary job.

Option 1's loss of model semantics is the real cost of this decision and should not be minimised. It is accepted because greppable identifiers recover the *checkable* portion of what a metamodel provides — the part that matters most here — without the tooling. Consistency of naming is genuinely worse under this decision, and a future traceability checker in CI is the planned mitigation.

## Consequences

### Positive

- Architecture and implementation change together, in one reviewable history.
- Diagrams diff, so a change to a diagram is visible as a change rather than as a replaced image.
- No tooling, no build, no cost.
- Traceability is greppable, therefore automatable later.

### Negative

- No model semantics. Nothing prevents a component from being named two different things in two documents.
- Manual relationship maintenance; a renamed identifier must be propagated by search.
- Mermaid degrades on large or dense diagrams, which will constrain how much any single diagram is allowed to carry — arguably a benefit, but a constraint regardless.
- No generated views. Each view is written by hand and can drift from the others.

### Neutral

- Diagram quality will be adequate rather than excellent. For communicating a decision this is sufficient; for a published document it would not be.

## Risks

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| Naming drift across documents | High | Medium | Stable identifiers as the primary reference; automated traceability check planned in Phase G |
| Traceability matrix rots | Medium | High | Same-commit update rule; milestone review check; CI automation once the matrix stabilises |
| A diagram outgrows Mermaid | Medium | Low | Split the diagram. A diagram too large for Mermaid is usually too large to communicate one decision, per the no-decoration rule |

## Alternatives rejected

**Option 1 (modelling tool)** — rejected because binary models do not diff, do not review, and cannot be read without the tool. *Would become right if* the artefact count grew past the point where manual consistency is maintainable, or if multiple architects needed to work on one model.

**Option 2 (documentation site)** — rejected as infrastructure ahead of requirement. *Would become right if* the documentation volume grows enough that GitHub's navigation becomes genuinely inadequate — a plausible outcome by Stage One completion, and worth revisiting at the `v1.0.0` milestone.

## Review trigger

Revisit at `v1.0.0` (Stage One complete), when the full artefact volume is known and the cost of manual consistency maintenance can be assessed against evidence rather than estimate.
