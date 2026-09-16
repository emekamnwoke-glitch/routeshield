# Data Lifecycle and Governance

| | |
|---|---|
| **Phase** | C — Data Architecture |
| **Document version** | 1.0 |
| **Status** | Baseline |

---

## 1. Lifecycle by domain

| Domain | Created | Active life | Retained | Disposed | Basis |
|---|---|---|---|---|---|
| DD-1 Network (cache) | Per release | Until superseded | Superseded versions kept while any snapshot references them | With the last referencing snapshot | Reconstruction |
| DD-2 Fleet (cache) | Continuously | Minutes | Not retained in cache; copies live in snapshots | Rolling | Operational only |
| DD-3 Road conditions (cache) | Continuously | Minutes | As DD-2 | Rolling | Operational only |
| DD-4 Disruption | On detection | Until `closed` | Retention period *R* | After *R* | Accountability |
| DD-5 Response | On assessment | Until decided or superseded | *R* | After *R* | Accountability |
| DD-6 Decision | On decision | Permanent in effect until reverted | *R* | After *R* | Accountability |
| DD-7 Service State | On first activation | Until trip ends | Not retained — history is in DD-11 | End of service day | Operational |
| DD-8 Communication | On activation | Until response or expiry | *R* | After *R* | Accountability |
| DD-9 Contingency | On authoring | Until expiry or revocation | Superseded versions for *R* after supersession | After *R* | Governance |
| DD-10 Source Health | Continuously | Minutes | Copies in snapshots; aggregate for *R*<sub>ops</sub> | Rolling | Operations |
| DD-11 Audit | With each change | Never "active" | *R* | Only by retention policy, only whole records past *R* | Evidential |
| DD-12 Analytics | Batch | Until recomputed | Aggregates may outlive *R* | At policy review | Service improvement |

## 2. Retention period *R*

**Deliberately unset.** Retention of decision records about a public service is a legal and regulatory question — contract terms with the transport authority, complaint and claims limitation periods, public-records obligations. It cannot be set from a desk and should not be guessed ([SC-036](../../phase-a-architecture-vision/stakeholder-map.md#s-11--data-protection-officer)).

What the architecture fixes is the *shape* of retention:

- **One period for the whole decision chain.** A decision retained without the recommendation it resolved, or without the snapshot the recommendation was computed from, cannot be reconstructed. BR-038 fails silently if these are retained on different clocks.
- **Disposal is by whole disruption.** Everything belonging to a disruption — versions, assessments, snapshots, recommendations, decisions, instructions, events — ages out together.
- **Disposal is itself recorded.** A retention sweep writes an audit event stating what was removed and under which policy. The hash chain is preserved by retaining a disposal tombstone carrying the removed record's hash.
- **Legal hold overrides disposal.** A disruption subject to complaint or enquiry is exempt until released.

Stage Two will use a short demonstration value and label it as such.

## 3. Data quality

| Domain | Dimension that matters most | Control |
|---|---|---|
| DD-1 Network | **Completeness of vehicle constraints** | `VehicleConstraint.source` tagged; feasibility result states which kind it relied on |
| DD-2 Fleet | **Timeliness** | Freshness recorded in DD-10 and frozen into every snapshot |
| DD-3 Road conditions | **Provenance** | `IncidentReport.authority` distinguishes authoritative, inferred and declared |
| DD-4 Disruption | **Accuracy of footprint** | Human confirmation before action; versions rather than edits |
| DD-5 Response | **Explicability** | Rationale and cost mandatory on every recommendation |
| DD-11 Audit | **Integrity** | Hash chain; append-only |

The general stance: RouteShield does not try to fix upstream data. It measures it, records what it measured, and lets the controller see the measurement. A system that silently cleaned its inputs would produce confident recommendations whose confidence the controller could not audit.

## 4. Governance roles

| Role | Accountable for | Held by, in a real deployment |
|---|---|---|
| **Domain owner** | Definition, quality and access to one owned domain | Operations management |
| **Source owner** | Each sourced domain | The owning system's organisation |
| **Audit custodian** | Integrity and retention of DD-11 | Independent of the control room |
| **Contingency approver** | Entries in DD-9 | Senior operations, named individuals |
| **Data protection officer** | LINK handling, lawful basis, DPIA | DPO |

**The audit custodian must not report to the people whose decisions the audit records.** An evidential record controlled by its subjects is not evidential. In Stage Two, with one author, this separation cannot exist and is declared as a gap.

## 5. Data protection position

| Question | Position |
|---|---|
| Does RouteShield process personal data? | **Not directly.** No entity stores a person's identity other than `Actor`, which identifies staff in their role. |
| Is anything linkable? | **Yes.** `duty_ref` can be resolved to a driver by the fleet system; `Actor.id` identifies a controller. Both are classified LINK. |
| Is vehicle position personal data? | **Arguably yes, in combination.** A vehicle's position plus its duty is the driver's position. RouteShield holds both but never joins them to a person, and strips `duty_ref` before analytics. |
| Are passengers identified? | **No.** Notices target stops. Individually targeted notification would change this answer and is out of scope ([A-003](../../../02-stage-two-reference-implementation/assumptions.md#a-003)). |
| Is a DPIA needed for a real deployment? | **Yes.** The LINK fields and the monitoring character of position data are sufficient reason. Not attempted here — **FUTURE CONSIDERATION**. |

## 6. Incident data scope of use

Authoritative incident information from emergency services carries a scope-of-use obligation ([SC-033](../../phase-a-architecture-vision/stakeholder-map.md#s-10--emergency-services-and-local-authority)). The architecture's commitments:

- SEC-classified detail is used to derive a footprint and blocked segments, then retained only inside the snapshot that used it.
- It is never published (FR-D6) and never flows to analytics beyond disruption type and corridor.
- Export to reviewers (F9) includes SEC detail only under the same scope as the original sharing.

Whether any such data can be obtained at all is [A-002](../../../02-stage-two-reference-implementation/assumptions.md#a-002), rated low confidence. These commitments describe how it would be handled if it could.

## 7. Governance gaps declared

| Gap | Why |
|---|---|
| Retention period *R* unset | Legal question — §2 |
| Audit custodian independence | One author |
| DPIA | Requires qualified assessment |
| Data-sharing agreements for incident data | Do not exist; [A-002](../../../02-stage-two-reference-implementation/assumptions.md#a-002) |
| Operator constraint data ownership | Unknown who in an operator would own it; [A-008](../../../02-stage-two-reference-implementation/assumptions.md#a-008) |
