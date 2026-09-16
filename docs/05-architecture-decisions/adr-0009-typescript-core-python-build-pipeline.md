# ADR-0009: TypeScript for the core and UI; Python for the build-time pipeline

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | D — Technology Architecture |
| **Principles engaged** | P-9, P-10 |
| **Depends on** | ADR-0008 |
| **Supersedes** | — |

---

## Context

The core must run in a browser ([ADR-0008](adr-0008-browser-hosted-static-demonstrator.md)) and in tests. Separately, open network data must be downloaded, cleaned and turned into a road graph and patterns, synthetic data must be generated, and ML models trained. The project brief proposed Python, FastAPI, React and TypeScript as candidates.

## Problem

Which language(s) should implement the core, the UI and the data/ML pipeline?

## Options considered

### Option 1 — Python everywhere, core run in the browser via Pyodide
**For:** One language; the brief's candidate stack; strong geospatial and ML libraries. **Against:** Pyodide adds a multi-megabyte runtime and seconds of start-up before anything works; calling into it from the UI adds a boundary on every interaction; many geospatial Python libraries depend on native code unavailable in Pyodide.

### Option 2 — TypeScript everywhere, including data processing and ML
**For:** One language. **Against:** GTFS/OSM processing and model training are far better served in Python (mature, well-tested libraries); rewriting them buys nothing.

### Option 3 — TypeScript at runtime, Python at build time
**For:** Each language where it is strongest. The runtime is small and starts instantly. Python work happens once, in CI, and its outputs are static files. Models are trained in Python and exported to a portable format for in-browser inference.
**Against:** Two toolchains. Shared data formats must be specified carefully so the two sides agree.

### Option 4 — Python server (FastAPI) + TypeScript client
**For:** The brief's candidate stack. **Against:** Requires hosting a server, rejected in ADR-0008.

## Decision

**Option 3.** The core, adapters, simulators and UI are TypeScript. The build-time pipeline — ingestion, graph building, synthetic data generation, model training — is Python. The contract between them is a versioned set of data files with a schema, validated on both sides.

## Rationale

The runtime has to start instantly and be small; the data work has to be correct and use proven libraries. Option 3 is the only one that serves both. The candidate FastAPI server is not rejected on merit — it is rejected because ADR-0008 removed the place it would run. The operator profile could implement the Workspace API in any server language; the core's TypeScript modules would run under Node there.

## Consequences

- **Positive:** fast start; strong libraries for data work; core testable under Node.
- **Negative:** two toolchains in CI; a schema contract to maintain.
- **Neutral:** pytest covers the pipeline; a TypeScript test runner covers the core.

## Review trigger

If ML inference needs capabilities not available in-browser, revisit alongside ADR-0006's review trigger.
