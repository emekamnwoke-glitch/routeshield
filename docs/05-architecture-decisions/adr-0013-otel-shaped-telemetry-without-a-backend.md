# ADR-0013: OpenTelemetry-shaped telemetry, rendered in-browser in the demonstrator

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | D — Technology Architecture |
| **Principles engaged** | P-3, P-10 |
| **Depends on** | ADR-0008 |
| **Supersedes** | — |

---

## Context

The [observability design](../01-stage-one-architecture/phase-d-technology-architecture/observability.md) requires logs, metrics, traces and health for operations, and KPIs from the audit record for the service. The demonstrator has nowhere to send telemetry.

## Problem

How should telemetry be produced so that it is useful in both profiles?

## Options considered

### Option 1 — Console logging only
**Against:** Unstructured; no metrics; nothing to show a reviewer.

### Option 2 — Free hosted telemetry SaaS
**Against:** Needs an ingestion key in a public bundle; sends visitor data to a third party; adds a dependency for a demo.

### Option 3 — Instrument against the OpenTelemetry data model; export to an in-memory sink in the browser
**For:** Same instrumentation in both profiles; the operator profile swaps the exporter for a collector. The demonstrator renders a diagnostics panel from the in-memory sink.
**Against:** The browser keeps only the current session; no aggregation across visitors.

## Decision

**Option 3.** Core modules emit telemetry through a small internal interface shaped on OpenTelemetry's logs, metrics and traces. The reference profile binds it to an in-memory exporter feeding a diagnostics panel. KPIs are computed separately from the audit record, as the observability design requires.

## Rationale

Instrumentation is the expensive, architectural part; the exporter is configuration. Keeping the shape standard means the demonstrator's instrumentation is the operator profile's instrumentation.

## Consequences

- **Positive:** no third party, no keys; telemetry visible to reviewers.
- **Negative:** session-only; no alerting beyond on-screen banners.

## Review trigger

If a hosted variant is built — add an OTLP exporter.
