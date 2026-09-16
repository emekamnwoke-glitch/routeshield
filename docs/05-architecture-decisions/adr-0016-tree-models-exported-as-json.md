# ADR-0016: Train tree models in Python and evaluate them in TypeScript from JSON

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | E — Opportunities & Solutions |
| **Principles engaged** | P-5, P-10 |
| **Depends on** | ADR-0008, ADR-0009 |
| **Supersedes** | — |

---

## Context

M-1 (type classifier) and M-2 (duration estimator) operate on a handful of tabular features, trained on synthetic data at build time, and must run in the browser ([ML approach](../01-stage-one-architecture/phase-e-opportunities-solutions/ml-approach.md)). ADR-0009 mentioned exporting to a portable format.

## Problem

How are models trained and executed?

## Options considered

### Option 1 — Neural models with a browser ML framework
**Against:** Tabular, low-dimensional, small-data problems are where tree ensembles are the stronger default; a neural stack adds size and opacity for no benefit.

### Option 2 — scikit-learn → ONNX → ONNX Runtime Web
**For:** Standard, portable, exact. **Against:** The runtime is several megabytes of WASM to evaluate a few hundred small trees; another dependency on the critical start-up path.

### Option 3 — scikit-learn tree ensemble → JSON → small TypeScript evaluator
**For:** Tiny; fully inspectable; no runtime dependency; the model file is readable in a pull request. **Against:** A hand-written evaluator could diverge from the trained model.

### Option 4 — Rules only, no ML
**For:** Simplest; honest given no real data. **Against:** Does not demonstrate the ML pipeline the concept calls for.

## Decision

**Option 3, with Option 4 kept as the baseline.** Models are scikit-learn tree ensembles, trained in the Python pipeline and exported to a documented JSON format. A TypeScript evaluator runs them in the core worker. A rule-based baseline is always computed and reported; a model is only enabled if it beats the baseline on held-out synthetic data.

**Parity test:** CI evaluates the same fixture inputs in Python and TypeScript and fails if any prediction differs beyond floating-point tolerance.

## Rationale

The parity test turns Option 3's single weakness into a checked property, and removes the reason to ship a general runtime. Keeping the rule baseline visible is the guard against presenting synthetic accuracy as meaningful.

## Consequences

- **Positive:** small, transparent, reproducible; model files reviewable.
- **Negative:** only tree models supported; the evaluator is project code to maintain.

## Review trigger

If a model type other than trees becomes necessary.
