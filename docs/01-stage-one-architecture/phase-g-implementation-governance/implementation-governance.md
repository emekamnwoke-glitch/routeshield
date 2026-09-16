# Implementation Governance

| | |
|---|---|
| **Phase** | G — Implementation Governance |
| **Document version** | 1.0 |
| **Status** | Baseline |

---

## 1. Purpose

How to know that what Stage Two builds is what Stage One designed — and what happens when it is not. The [governance model](../methodology/architecture-governance.md) sets the principles; this document turns them into checks that run.

## 2. Architecture requirements

Business requirements say what the business needs. **Architecture requirements** (`AR-nnn`) say what the architecture must guarantee to meet them — the constraints an implementation must satisfy regardless of how it is written. There are 32, each traced to its sources (business requirements, ADRs, principles), allocated to components and technical components, and verified by a test.

They are held in the [traceability model](../../../architecture/models/traceability.toml) and listed in the [matrix](traceability-matrix.md#architecture-requirements). Examples of what they pin down:

| AR | Guarantee | Why it needs pinning |
|---|---|---|
| AR-001 | Assessment reads only a snapshot persisted before it starts | Easy to shortcut by reading the live cache "just this once" |
| AR-002 | A change and its audit event commit together | Easy to erode by logging asynchronously for speed |
| AR-004 | Impact is presentable before optimisation begins | Easy to break by awaiting both in one call |
| AR-007 | A2 re-checks all six conditions at execution | Easy to trust the recommendation's earlier check |
| AR-014 | No driver identity in audit or analytics | Easy to add "just for debugging" |
| AR-032 | The missing equity term is displayed | Easy to remove because it looks like an unfinished feature |

Each of these is a place where a reasonable local change would quietly break an architectural commitment. That is the definition of an architecture requirement used here.

## 3. Traceability

### The chain

```
BR → Capability → AR → Component → Technical component → User story → Implementation → Test → Evidence
```

### The mechanism

| Element | Location |
|---|---|
| Model (source of truth) | [`architecture/models/traceability.toml`](../../../architecture/models/traceability.toml) |
| Checker and renderer | [`tools/traceability/check.py`](../../../tools/traceability/check.py) |
| Rendered matrix | [`traceability-matrix.md`](traceability-matrix.md) — generated, never hand-edited |

The checker enforces:

| Rule | |
|---|---|
| Model and documents agree | Every BR, capability and component in the model exists in the architecture documents, and vice versa |
| No orphan capability | Every capability has a requirement and a realising component |
| No unrefined requirement | Every BR is refined by at least one AR |
| No unjustified component | Every component carries at least one AR |
| No unverified requirement | Every BR and AR is verified by at least one test |
| No dangling reference | Every referenced ADR file, principle, component, technical component and user story exists |
| Evidence discipline | A test marked `implemented` names an implementation that exists; a test marked `passing` cites evidence |
| Matrix freshness | `--verify-rendered` fails if the matrix does not match the model |

The checker was itself tested by deliberately breaking the model eleven ways; each break was caught.

This is the one governance control in the project that **does not depend on the person it governs** ([governance §8](../methodology/architecture-governance.md#8-what-this-model-does-not-do)). It runs in CI on every pull request and every push to `main` ([workflow](../../../.github/workflows/architecture.yml)).

### State at Stage One completion

All 79 test cases are `planned`: each requirement has a named test and a test level, but no test code exists yet. User stories do not exist yet — they are written in Stage Two (project phase 4) and added to the model with their links. The matrix is complete in structure and empty in evidence, which is the correct state for an architecture that has not been built.

## 4. Compliance

A change is assessed against the five conditions in [governance §4](../methodology/architecture-governance.md#4-architecture-compliance). In Stage Two they are checked as follows:

| Condition | How checked |
|---|---|
| Realises a requirement in the matrix | PR description names `US-`/`TC-`; traceability check |
| Does not contradict an accepted ADR | PR checklist; review |
| Does not violate a principle | PR checklist; review |
| Depends on no unregistered assumption | PR checklist; `A-nnn` references in code comments where behaviour depends on an assumption |
| Respects component boundaries | **Automated** — dependency rules (below) |

## 5. Technical governance

Checks that run on every pull request from the release where they first apply ([release plan §3](../phase-f-migration-planning/roadmap-and-release-plan.md#3-engineering-cadence-alongside-releases)).

| Gate | Enforces | Blocks merge |
|---|---|---|
| Lint and format | Engineering standards | Yes |
| Type check (TypeScript strict; Python) | Engineering standards | Yes |
| Unit tests | Requirements verified at unit level | Yes |
| Integration and scenario tests | AR-001, AR-002, AR-004 … | Yes |
| **Module dependency rules** | Modules import only other modules' public contracts; only the storage module touches SQL for its own tables (AR-005) | Yes |
| **Schema inspection** | No driver-identifying column in audit or analytics tables (AR-014) | Yes |
| Traceability check + matrix freshness | Section 3 | Yes |
| Markdown link and anchor check (`tools/docs/check_links.py`) | Cross-references between artefacts stay valid | Yes |
| Secret scanning | SECURITY.md | Yes |
| Dependency vulnerability scan | TB-7 | Yes, above a severity threshold |
| Static analysis | TB-7 | Yes, above a severity threshold |
| ML parity test | ADR-0016 | Yes, from v1.6.0 |
| Performance budget | Phase E §6 | Warn only — timing on shared CI runners is noisy |

The two bold rows are the ones that make architecture enforceable rather than documented: they fail a build when code crosses a boundary the architecture drew.

## 6. Change control

When implementation shows that the architecture does not hold, the sequence in [P-11](../methodology/architecture-principles.md#p-11--architecture-changes-before-implementation-does) applies, and the order is visible in the pull request:

1. Architecture change issue raised ([template](../../../.github/ISSUE_TEMPLATE/architecture-change.md)).
2. ADR written; superseded ADR's status updated.
3. Affected architecture documents amended.
4. Traceability model updated; matrix re-rendered.
5. Implementation changed.
6. All in one pull request, or architecture first and implementation second — never the reverse.

The checker supports this ordering: an implementation PR that introduces a requirement not yet in the model fails, because its test would verify an unknown requirement.

## 7. Review points

At each release tag, in addition to the checks in [governance §7](../methodology/architecture-governance.md#7-review-points):

- risk register re-scored ([Phase F](../phase-f-migration-planning/risk-register.md#3-review));
- assumptions register reviewed for drift;
- test status counts in the matrix compared with the release's claims;
- the README's limitations section re-read against what is actually true.
