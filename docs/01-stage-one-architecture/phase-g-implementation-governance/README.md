# Phase G — Implementation Governance

> **Status: complete** for Stage One. Exit condition satisfied in structure; evidence is filled in by Stage Two — see [below](#exit-condition).

How to know that what is built is what was designed.

## Documents

| | |
|---|---|
| [Implementation Governance](implementation-governance.md) | Architecture requirements, traceability mechanism, compliance, CI gates, change control |
| [Traceability Matrix](traceability-matrix.md) | **Generated.** 47 BR → 32 capabilities → 32 AR → 13 components → 79 tests |

Model: [`architecture/models/traceability.toml`](../../../architecture/models/traceability.toml) · Checker: [`tools/traceability/check.py`](../../../tools/traceability/check.py)

```bash
python tools/traceability/check.py --render
```

## What this settles

**Traceability is data, checked by code.** The matrix is generated from a model and cannot be hand-edited into agreement. The checker compares the model with the architecture documents, refuses orphans in either direction, and refuses a test marked passing without evidence. It was tested by breaking the model eleven ways; it caught all eleven.

**Architecture requirements name the easy mistakes.** The 32 ARs are the places where a reasonable local change — reading live data once, logging asynchronously, awaiting two calls together, adding a debug column — would quietly break a commitment.

**Two boundaries are enforced by the build, not by review.** Module dependency rules and schema inspection fail a pull request that crosses a line the architecture drew.

## Exit condition

| Check | |
|---|---|
| No requirement without a test | ✅ Every BR and AR has a named, levelled test case (all `planned`) |
| No component without a requirement | ✅ Every component carries at least one AR |
| Mechanism is automated | ✅ Checker passes; runs in CI on every pull request |

The matrix is complete in structure and empty in evidence — correct for an architecture not yet built. Stage Two fills in user stories, implementations and evidence; the checker will then refuse any claim of `passing` without evidence.
