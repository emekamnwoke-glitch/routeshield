# Operations

> **Status: not yet written.** Scheduled for project Phase 8.

How the system would be run, observed and supported — including KPIs that measure whether it is actually helping, not merely whether it is up.

## Planned contents

- Observability design
- Logging and audit logging
- Metrics and KPI definitions
- Health, readiness and liveness checks
- Error tracking
- Operational dashboards
- Runbooks
- Incident response

**KPIs under development:** disruption detection latency, route recommendation latency, decision latency, reroute acceptance rate, stops skipped per disruption, passengers affected, notification delivery rate, system availability.

Acceptance rate deserves particular care as a metric. A low rate may mean the recommendations are poor — or that controllers do not trust the system. Those call for opposite responses, and the metric alone does not distinguish them.
