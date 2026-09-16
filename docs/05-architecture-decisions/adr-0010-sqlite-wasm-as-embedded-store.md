# ADR-0010: Use SQLite (official WASM build) as the embedded store

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | D — Technology Architecture |
| **Principles engaged** | P-2, P-8, P-10 |
| **Requirements** | FR-D3, INV-01 → INV-13, BR-006 → BR-008 |
| **Depends on** | ADR-0006, ADR-0007, ADR-0008 |
| **Supersedes** | — |

---

## Context

The operator profile specifies a transactional relational store with spatial support — PostgreSQL with PostGIS is the obvious family. The reference profile runs in a browser on static hosting that cannot set custom HTTP headers.

The store must give: ACID transactions spanning a domain change and its audit event (FR-D3); per-module separation (ADR-0006); persistence across page reloads; and enough spatial capability to find which patterns a footprint blocks. The README listed DuckDB-WASM as the leading candidate.

## Problem

Which embedded store should the reference implementation use?

## Options considered

### Option 1 — DuckDB-WASM
**For:** SQL; a spatial extension; excellent for analytics.
**Against:** Optimised for analytical scans, not the small transactional writes that dominate here. Larger download. Browser persistence less mature. The spatial extension is fetched at runtime. Chosen mainly for analytics — which is the smallest workload in this system.

### Option 2 — IndexedDB (directly or via a wrapper)
**For:** Built in; no download.
**Against:** Key-value, not relational; invariants and joins move into application code; transactions exist but are awkward to span across modules cleanly.

### Option 3 — In-memory only
**For:** Simplest. **Against:** State lost on reload; a demo that forgets the decision you just showed is not demonstrating auditability.

### Option 4 — PGlite (Postgres compiled to WASM)
**For:** Closest to the operator profile's store; real Postgres SQL.
**Against:** Larger runtime; PostGIS availability in-browser uncertain; younger project. Closest in dialect, heavier in everything else.

### Option 5 — SQLite, official WASM build, `opfs-sahpool` persistence
**For:** Mature, small, fully transactional. `opfs-sahpool` persists to the browser's origin-private file system **without** the cross-origin-isolation headers GitHub Pages cannot send. Node ships a built-in SQLite, so the same schema runs in tests.
**Against:** No built-in spatial types. `opfs-sahpool` must run in a Worker and supports a single connection.

## Decision

**Option 5.** SQLite (official WASM build) with the `opfs-sahpool` VFS, owned by a single **core worker** that hosts all core modules. The UI talks to the core worker by message; the optimiser runs in its own worker and receives snapshots by message, never a database handle.

Spatial work is done in TypeScript against geometry prepared at build time: a static spatial index over road segments and patterns, with footprint–segment intersection computed in code. Per-module separation uses table-name prefixes enforced by each module's repository and checked in CI.

## Rationale

The dominant workload is small transactional writes with strict invariants — exactly SQLite's strength. The spatial requirement is narrow (which segments does this area cover; which patterns use those segments), and precomputation makes it cheap without a spatial database. DuckDB was the brief's leading candidate; it loses here because it is best at the workload this system has least of ([P-10](../01-stage-one-architecture/methodology/architecture-principles.md#p-10--no-unnecessary-infrastructure)).

The single-connection limit fits the architecture: the core worker is the one writer, which is the modular monolith's shape anyway.

## Consequences

- **Positive:** exact local transactions for FR-D3; persistence on static hosting; same SQL in browser and tests.
- **Negative:** spatial logic lives in application code, not the store — a divergence from the operator profile. Module separation is by convention plus CI check, not by credentials.
- **Neutral:** the operator profile still specifies a spatial relational store; the storage port hides the difference.

## Alternatives rejected

**DuckDB-WASM** — *would become right if* analytics became the dominant workload. It could be added later for AC-12 alone, reading exported audit data.
**PGlite** — *would become right if* dialect parity with the operator profile mattered more than size and maturity.
**IndexedDB / in-memory** — used only as test doubles, if at all.

## Review trigger

If spatial logic in code becomes a correctness or performance problem in Stage Two.
