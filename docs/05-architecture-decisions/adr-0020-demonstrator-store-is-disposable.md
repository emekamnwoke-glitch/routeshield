# ADR-0020: Treat the demonstrator's store as disposable

| | |
|---|---|
| **Status** | Accepted — recorded retrospectively |
| **Date** | 2026-09-19 |
| **Phase** | H — raised from Stage Two implementation (v1.1.0, v1.2.0) |
| **Principles engaged** | P-2, P-5, P-11 |
| **Requirements** | BR-036, BR-038 · AR-003 |
| **Supersedes** | — |

---

> **Recorded after the code.** The "Start again" button (v1.1.0) and the clearing of stores from older releases (v1.2.0) both delete audit records. Neither was decided in writing first, which breaks [P-11](../01-stage-one-architecture/methodology/architecture-principles.md#p-11--architecture-changes-before-implementation-does). See [change log CH-008](../01-stage-one-architecture/phase-h-change-management/change-log.md).

## Context

AR-003 makes audit events append-only and hash-chained, and the Audit Ledger enforces it with triggers that refuse updates and deletes. P-2 says every decision is auditable.

The demonstrator keeps its store in the visitor's browser (ADR-0010). Two things delete that store whole:

- **Start again**, so a visitor can run a scenario from a clean state.
- **A schema change between releases.** v1.2.0 changed several tables. A store written by v1.1.0 cannot be opened by v1.2.0, so the site clears it and says so.

Everything in the store is fictional: invented incidents, decisions by personas, a synthetic fleet.

## Problem

May the demonstrator delete a store that holds an append-only audit chain?

## Options considered

### Option 1 — Never delete; migrate every schema change

**For:** The audit chain survives for ever, as it would for an operator.
**Against:** A migration for every schema change, for data that is fictional and belongs to one visitor's browser. No "start again", so a visitor who has run five scenarios cannot show a sixth cleanly.

### Option 2 — The store is disposable as a whole; the chain is append-only within it

A visitor may delete the whole store, and a release may clear a store it cannot read. Within a store, nothing is ever updated or deleted, and the chain verifies from its first event.

**For:** Keeps AR-003's guarantee where it means something, inside one continuous record, while letting a demonstrator be reset. No migrations for fictional data.
**Against:** "Append-only" becomes "append-only until the whole record is discarded", which is a real weakening if copied into an operator deployment.

### Option 3 — Export the chain before deleting it

**For:** Nothing is lost.
**Against:** Adds an export nobody has asked for, for fictional data (P-10).

## Decision

**Option 2**, for the reference profile only. The store records its schema version; the core refuses a store from another version (`SchemaMismatch`); the core worker then clears it and tells the visitor. "Start again" deletes the store on request. Inside a store, the Audit Ledger's triggers and hash chain are unchanged.

**The operator profile must not inherit this.** An operator's audit store is retained and migrated, never cleared.

## Rationale

P-5: the data is fictional and belongs to one visitor. Pretending its audit trail needs preserving would misrepresent what it is. P-2 is kept where it applies: every decision in a store can be reconstructed from that store, and tampering within it is detected.

## Consequences

### Positive
- Releases can change the schema without migrations; visitors can reset.

### Negative
- Audit records are deleted, deliberately, in the reference profile. Anyone reading the code without this ADR could take it as the pattern.
- The site cannot show a decision made before a reset or an upgrade.

### Neutral
- The schema version (`kn_meta`) is also the hook an operator profile would use to run migrations.

## Risks

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| The disposable-store pattern is copied into an operator design | Low | High | This ADR; the operator profile in Phase D keeps a separate, retained audit store |

## Alternatives rejected

**Option 1** — *would become right if* the store held anything real, for example a trial with an operator.

**Option 3** — *would become right if* visitors wanted to keep and compare runs (for example the v2.0.0 scenario write-ups), in which case export beats migration.

## Review trigger

Any use of the reference implementation with real operational data, or a request to keep runs across releases.
