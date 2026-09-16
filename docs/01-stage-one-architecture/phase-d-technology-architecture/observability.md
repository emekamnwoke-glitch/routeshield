# Observability and KPIs

| | |
|---|---|
| **Phase** | D — Technology Architecture |
| **Document version** | 1.0 |
| **Status** | Baseline |

---

## 1. Two questions, two kinds of telemetry

| Question | Answered by | Audience |
|---|---|---|
| **Is the system working?** | Operational telemetry: logs, metrics, traces, health | Platform operations (S-12) |
| **Is the system helping?** | Service KPIs derived from the audit record | Duty manager, executive, authority (S-06, S-08, S-09) |

They are kept separate on purpose. Operational telemetry is high-volume, short-lived and allowed to be lossy. KPIs describe decisions about a public service and must be exact, so they are computed from the audit record ([DD-11](../phase-c-information-systems/data-architecture/data-domains.md#append-only-domain)), never from logs.

## 2. Operational telemetry

### Signals

| Signal | Content | Notes |
|---|---|---|
| **Logs** | Structured, one event per line, with correlation id | Never contain LINK or SEC fields |
| **Metrics** | Counters, gauges, histograms | See §2.3 |
| **Traces** | Spans across modules for one disruption's path | Correlation id = disruption version id |
| **Health** | Liveness, readiness, dependency state | See §2.2 |

Format is **OpenTelemetry-shaped** so that the operator profile can ship to any compatible collector and the reference profile can render the same data in the browser ([ADR-0013](../../../05-architecture-decisions/adr-0013-otel-shaped-telemetry-without-a-backend.md)).

**Audit logging is not logging.** Audit events are business records written transactionally (FR-D3). Application logs may duplicate them for diagnosis; they are never the source of truth.

### 2.2 Health

| Check | Meaning | Fails when |
|---|---|---|
| **Liveness** | The process can make progress | Event loop blocked; worker deadlocked |
| **Readiness** | This instance can safely accept decisions | Store or audit store unreachable (FR-D3); identity validation unavailable for new sessions |
| **Degraded** | Ready, but with reduced capability | Any source `stale` or `absent` |

Readiness deliberately **does not** fail when sources fail. A system that takes itself out of service because traffic data is late has turned a degradation into an outage ([P-3](../../methodology/architecture-principles.md#p-3--degrade-do-not-fail)). It fails only when a change could not be recorded.

### 2.3 Metrics

| Metric | Type | Why |
|---|---|---|
| `source_freshness_seconds{source}` | Gauge | Staleness drives confidence |
| `source_status{source,status}` | Gauge | Degraded-mode visibility |
| `adapter_rejected_total{source,reason}` | Counter | Malformed or implausible input (T-08) |
| `assessment_duration_seconds` | Histogram | OBJ-1, OBJ-2 |
| `assessment_routes_affected` | Histogram | Flatness check for OBJ-2 |
| `optimisation_duration_seconds` | Histogram | Budget tuning |
| `optimisation_timeouts_total` | Counter | BR-011 |
| `snapshot_write_seconds` | Histogram | ADR-0004 risk |
| `recommendation_queue_depth{actor}` | Gauge | BR-023 |
| `audit_append_failures_total` | Counter | FR-D3 — any non-zero value is an incident |
| `audit_chain_verification_failures_total` | Counter | T-04 — any non-zero value is a security incident |
| `driver_channel_delivery_seconds` | Histogram | OBJ-1 |
| `notice_publish_seconds` | Histogram | OBJ-4 |
| `outbox_lag_seconds` | Gauge | ADR-0007 health |

### 2.4 Alerts

Only conditions that require a person to act.

| Alert | Condition | Severity |
|---|---|---|
| Audit append failing | `audit_append_failures_total` increasing | Critical — decisions cannot be made |
| Audit chain broken | Any verification failure | Critical — security |
| Not ready | All instances not ready > 1 min | Critical — invoke manual fallback |
| Source absent | Any source absent > 5 min during service hours | Warning |
| Queue saturated | Queue depth at bound for > 2 min | Warning — escalate staffing |
| Outbox lag | > 30 s | Warning |

## 3. Service KPIs

Every KPI has a definition, a source in the audit record, and a note on how it can mislead. That last column is not optional; each of these numbers can improve while the service gets worse.

| KPI | Definition | Source | How it misleads |
|---|---|---|---|
| **Detection latency** | Incident report received → disruption confirmed | `IncidentReported`, `DisruptionConfirmed` | Dominated by human confirmation, which is intended. A fall may mean less scrutiny. |
| **Recommendation latency** | Confirmed → recommendation issued | `DisruptionConfirmed`, `RecommendationIssued` | Can be improved by generating fewer options. |
| **Decision latency** | Recommendation presented → decided | `presented_at`, `decided_at` | **Faster is not better.** See rubber-stamping below. |
| **Time to driver** | Confirmed → driver acknowledged | + `DriverAcknowledged` | Excludes refusals unless reported alongside. |
| **Time to passenger** | Approved → notice published | `DecisionMade`, `NoticePublished` | Says nothing about whether anyone saw it. |
| **Reroute acceptance rate** | Approved ÷ recommendations | `DecisionMade` | **Ambiguous.** Low may mean poor recommendations *or* low trust; high may mean good ones *or* rubber-stamping. |
| **Refusal rate** | Refused ÷ instructions | `DriverRefused` | Clusters by junction indicate feasibility model errors (BR-R2), not driver behaviour. |
| **Stops skipped** | Per disruption | `OptionCost` of chosen options | Minimising it alone ignores who depends on those stops (P-7). |
| **Stops covered** | Skipped stops served by a following service | `OptionCost` | — |
| **Passengers affected** | Estimated, per disruption | `AffectedStop` estimates | **Synthetic in Stage Two**; an estimate even in the operator profile. |
| **Time to reversion** | Clearance signalled → all trips reverted or retained | `DisruptionClearing`, `DisruptionClosed` | — |
| **Ungoverned deviations** | Count at any time | AC-08 query | Should be zero. Non-zero is a defect (INV-07). |
| **A2 share** | Pre-approved activations ÷ all activations | `DecisionMade.basis` | Rising share may be learning — or automation by accretion (autonomy §5). |
| **Degraded-mode share** | Recommendations issued at reduced or low confidence | `ConfidenceState` | — |
| **Notification delivery rate** | Published ÷ attempted | `NoticePublished`, `ChannelUnavailable` | — |
| **Availability** | Ready time ÷ service hours | Health | — |

### The rubber-stamping indicator

[BR-024](../../phase-b-business-architecture/business-requirements.md#decision) requires the system to detect approvals made faster than the reasoning could be read.

| Input | Source |
|---|---|
| Deliberation time | `decided_at − presented_at` |
| Reading load | Length of rationale and number of options presented |
| Context | Queue depth at the time; autonomy band |

The indicator is the proportion of approvals whose deliberation time falls below a reading-time floor scaled by reading load, **aggregated per period and per corridor, not per person**. Surfacing it per controller would turn a system-design signal into a performance measure on individuals, which is the misuse [SC-018](../../phase-a-architecture-vision/stakeholder-map.md#s-05--control-room-controller) and [SC-041](../../phase-a-architecture-vision/stakeholder-map.md#s-13--driver-representative-body) warn against. A rising value means the system is producing more than people can evaluate — a design problem to fix, not a staff problem.

The floor value cannot be set from a desk. Stage Two uses a demonstration value and labels it.

## 4. Dashboards

| Dashboard | For | Shows |
|---|---|---|
| **Live disruption** | Controller, duty manager | Active disruptions, affected services, queue, source health, confidence |
| **Platform** | Operations | Health, metrics, alerts, outbox, audit chain status |
| **Service outcomes** | Duty manager, executive | KPIs per period, per corridor, with the "how it misleads" notes inline |
| **Governance** | Authority, audit | A2 share, contingency approvals nearing expiry, rubber-stamping indicator, reconstruction access |

The governance dashboard exists because [OBJ-10](../../phase-a-architecture-vision/objectives.md#obj-10--make-the-capability-governable-and-explicable) requires the autonomy model to be observable from outside, not just enforced inside.

## 5. Reference profile

| Element | Realisation |
|---|---|
| Logs, metrics, traces | Collected in memory in the browser; shown in a diagnostics panel |
| Health | Computed and shown; no external probe |
| KPIs | Computed from the local audit record by AC-12 |
| Dashboards | Live disruption and service outcomes built; platform and governance views simplified |
| Alerts | Rendered as banners |

All figures shown in the demonstrator are **computed from synthetic scenarios** and say so on screen.

## 6. Exit condition

| Check | |
|---|---|
| Every KPI has a defined source | ✅ All sourced from audit events or AC-08 |
| Health semantics do not turn degradation into outage | ✅ §2.2 |
