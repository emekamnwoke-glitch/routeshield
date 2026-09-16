# Service Contracts and APIs

| | |
|---|---|
| **Phase** | C — Application Architecture |
| **Document version** | 1.0 |
| **Status** | Baseline |

---

Contracts are stated at the logical level: operations, events, rules. Protocols and serialisation are Phase D decisions. Physical API specifications are produced in [Stage Two](../../../02-stage-two-reference-implementation/api/).

## 1. Contract conventions

| Convention | Rule |
|---|---|
| **Commands** | Imperative name. Return a definite outcome or a typed rejection. Idempotent by caller-supplied key. |
| **Queries** | Never change state. |
| **Events** | Past-tense name. Immutable. Carry identifiers of the records they announce, not copies of mutable state. |
| **Actor** | Every command that changes state carries the acting `Actor` or declares itself system-initiated. |
| **Versioning** | Contracts are versioned as a whole (`v1`). Additive changes do not bump the version; removals and meaning changes do. |
| **Time** | All instants UTC. |

## 2. Component contracts

### AC-02 · Disruption Manager

| Kind | Name | Notes |
|---|---|---|
| Command | `DeclareDisruption(area, type, window?, actor)` | Manual path; always available ([BR-002](../../phase-b-business-architecture/business-requirements.md#disruption-awareness)) |
| Command | `ConfirmDisruption(id, actor)` / `DismissDisruption(id, actor, reason)` | |
| Command | `ReviseDisruption(id, area?, type?, window?, actor?)` | Creates a new version; never edits |
| Command | `SignalClearance(id, source)` / `WithdrawClearance(id)` | |
| Query | `GetDisruption(id)` · `ListActiveDisruptions()` | |
| Event | `DisruptionCandidateRaised` · `DisruptionConfirmed` · `DisruptionDismissed` · `DisruptionVersionCreated` · `DisruptionClearing` · `DisruptionClosed` | |

### AC-04 · Impact Assessor

| Kind | Name | Notes |
|---|---|---|
| Command | `AssessImpact(disruption_version)` | System-initiated on confirmation or new version |
| Query | `GetAssessment(id)` · `GetLatestAssessment(disruption)` | |
| Event | `ImpactAssessed(assessment, completeness)` | |

### AC-05 · Route Optimiser

| Kind | Name | Notes |
|---|---|---|
| Command | `GenerateOptions(assessment, budget_ms)` | Time-boxed; partial results are valid |
| Command | `GenerateOptionsForTrip(assessment, trip, excluded_options)` | Used after refusal |
| Query | `GetOptions(assessment)` | |
| Event | `OptionsGenerated(assessment, count, complete)` · `OptionGenerationFailed(assessment, reason)` | |

### AC-06 · Decision Support

| Kind | Name | Notes |
|---|---|---|
| Command | `ComposeRecommendation(assessment)` | |
| Command | `RequestReDecision(trip, excluded, reason)` | |
| Query | `GetRecommendation(id)` · `GetQueue(actor)` · `GetApprovalTiming(period)` | Last one feeds the rubber-stamping detector |
| Event | `RecommendationIssued(id, band, assigned_to)` · `RecommendationSuperseded(id, by)` · `RecommendationEscalated(id, to)` · `ApprovalTimingAnomaly(actor, period)` | |

### AC-07 · Decision Manager

| Kind | Name | Notes |
|---|---|---|
| Command | `Decide(recommendation, outcome, option?, modification?, reason?, actor, presented_at)` | Rejected if authority does not hold at decision time |
| Command | `ExecutePreApproved(recommendation)` | System-initiated; re-checks all A2 conditions |
| Command | `Revoke(activation, actor, reason)` | Within revocation window |
| Command | `DecideReversion(disruption, per_trip_outcomes, actor)` | Revert or retain, each with reason |
| Query | `GetDecision(id)` · `ListActivations(disruption)` | |
| Event | `DecisionMade` · `ActivationCreated` · `ActivationRevoked` · `ReversionPrompted` · `ReDecisionRequired` | |

### AC-08 · Service State

| Kind | Name | Notes |
|---|---|---|
| Command | `ApplyActivation(activation)` · `HoldTrip(trip)` | |
| Query | `GetServiceState(trip)` · `ListDeviations(disruption?)` · `ListUngovernedDeviations()` | Last one enforces INV-07 |
| Event | `ServiceStateChanged(trip, from, to, activation)` | |

### AC-09 · Communication Hub

| Kind | Name | Notes |
|---|---|---|
| Command | `IssueInstructions(activation)` · `PublishNotices(activation)` · `WithdrawNotices(activation)` | |
| Command | `RecordDriverResponse(instruction, kind, reason?)` | Called by the driver channel adapter |
| Query | `GetDeliveryStatus(activation)` | |
| Event | `InstructionIssued` · `DriverAcknowledged` · `DriverRefused` · `DriverDidNotRespond` · `NoticePublished` · `NoticeWithdrawn` · `ChannelUnavailable` | |

### AC-10 · Contingency Library

| Kind | Name | Notes |
|---|---|---|
| Command | `AuthorRoute(...)` · `ProposeRoute(candidate)` | Proposed routes are inert until approved |
| Command | `ApproveRoute(route, conditions, expires_at, actor)` | `expires_at` mandatory; actor must hold approver role |
| Command | `RevokeApproval(approval, actor, reason)` | |
| Query | `MatchingRoutes(corridor, type, extent, network_version, at)` | Returns only valid, unexpired, unrevoked matches |
| Event | `RouteProposed` · `RouteApproved` · `ApprovalRevoked` · `ApprovalExpired` | |

### AC-11 · Audit Ledger

| Kind | Name | Notes |
|---|---|---|
| Command | `FreezeSnapshot(area, disruption_version)` | Returns an id only after durable write |
| Command | `Append(event)` | Part of the caller's unit of work |
| Query | `Reconstruct(decision)` | Recommendation, options, assessment, snapshot, health, actor, timings |
| Query | `Export(disruption)` | Interpretable outside the operator; LINK fields excluded ([FR-D7](../data-architecture/data-flows.md#5-flow-rules)) |
| Query | `VerifyChain(from, to)` | Tamper evidence |

There is no update or delete operation, and no parameter that could express one.

### AC-14 · Access Control

| Kind | Name |
|---|---|
| Query | `ResolveActor(identity)` · `MayDecide(actor, blast_radius, at)` · `IsOnDuty(actor, at)` · `AnyControllerOnDuty(at)` |
| Command | `Grant(...)` · `RevokeGrant(...)` · `SetDuty(actor, on_duty)` |

## 3. Workspace API — `v1`

The one contract exposed outside the core to a human-facing client. Resource-oriented, versioned in the path.

| Method | Resource | Maps to |
|---|---|---|
| `GET` | `/v1/disruptions` · `/v1/disruptions/{id}` | AC-02 queries |
| `POST` | `/v1/disruptions` | `DeclareDisruption` |
| `POST` | `/v1/disruptions/{id}/confirmation` · `/dismissal` | Confirm / dismiss |
| `GET` | `/v1/disruptions/{id}/impact` | AC-04 |
| `GET` | `/v1/recommendations?assigned=me` · `/v1/recommendations/{id}` | AC-06 |
| `POST` | `/v1/recommendations/{id}/decision` | `Decide` |
| `POST` | `/v1/activations/{id}/revocation` | `Revoke` |
| `POST` | `/v1/disruptions/{id}/reversion` | `DecideReversion` |
| `GET` | `/v1/service-state?deviating=true` | AC-08 |
| `GET` | `/v1/sources/health` | DD-10 |
| `GET` | `/v1/decisions/{id}/reconstruction` | AC-11 |
| stream | `/v1/events` | Server-to-client push of events relevant to the actor |

`POST .../decision` requires `presented_at` — when the client displayed the recommendation. Without it the rubber-stamping detector ([BR-024](../../phase-b-business-architecture/business-requirements.md#decision)) has nothing to measure. A client that omits it is rejected, not defaulted.

## 4. Error model

Rejections are typed so that clients can act on them, not merely display them.

| Type | Meaning | Example |
|---|---|---|
| `not_authorised` | Actor lacks authority now | Grant expired between presentation and decision |
| `stale` | The subject has been superseded | Deciding on a recommendation replaced by a newer version |
| `conflict` | State changed incompatibly | Revoking after the window closed |
| `invalid` | Input fails validation | Area outside the network |
| `unavailable_degraded` | Refused because a required dependency is down | Audit Ledger unavailable ([FR-D3](../data-architecture/data-flows.md#5-flow-rules)) |
| `precondition_failed` | A guard does not hold | Closing a disruption with ungoverned deviations |

`stale` matters most in practice. Under a moving disruption ([BS-2](../../phase-b-business-architecture/business-scenarios.md#bs-2--moving-protest--the-case-the-model-does-not-handle-well)), recommendations are superseded frequently, and a decision on a superseded one must be rejected with a pointer to its successor rather than silently applied.
