# Phase H — Architecture Change Management

> **Status: process defined. Exit condition pending** — it requires a change originating in implementation, which cannot exist until Stage Two. Designated subject: ADR-0005 / BS-2, due at v2.0.0.

What happens when the architecture turns out to be wrong.

## Documents

| | |
|---|---|
| [Architecture Change Management](architecture-change-management.md) | Sources of change, process, classification, impact checklist, review, evolution, the designated worked example |
| [Change Log](change-log.md) | Every change to a baselined artefact |

## What this settles

**Being wrong has a procedure.** Triggered changes go through an issue, an ADR, an impact assessment that includes past milestone claims, artefact amendment, traceability update — then implementation. Never the reverse.

**Reaffirming is a result.** An ADR reviewed and left unchanged is recorded as reviewed.

**The worked example was chosen before any code existed** — the static-footprint disruption model, tested against a moving protest. Its outcome will be recorded whichever way it falls.

## Exit condition

| Check | |
|---|---|
| Process exercised at least once on a change originating from implementation | ⏳ **Pending** — v2.0.0 |

The change log already holds three changes (two data-domain splits caught during Phase C, one release-order change). They show the process working; none originated in implementation, so none of them counts.
