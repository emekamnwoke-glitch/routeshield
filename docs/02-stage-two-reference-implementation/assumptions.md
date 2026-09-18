# Assumptions Register

| | |
|---|---|
| **Document version** | 1.0 |
| **Status** | Seeded at Phase 1 — expanded in Phase 3 alongside the fictional operating model |
| **Governed by** | [The Fact / Assumption Model](fact-vs-assumption-model.md) · [P-5](../01-stage-one-architecture/methodology/architecture-principles.md#p-5--distinguish-what-is-known-from-what-is-supposed) |

---

## How to read this register

Every entry records seven fields. Two of them do the real work:

**If wrong** distinguishes an assumption that costs an afternoon from one that invalidates a phase. An assumption register without this field is a list, not a risk instrument.

**Validation** is what a real implementation would check on day one. Taken together, these fields are the day-one discovery backlog for anyone attempting this for real — arguably the most directly useful output of the whole Stage Two exercise.

**Impact** grades what failure costs:

| Grade | Meaning |
|---|---|
| 🔴 **High** | Invalidates an architecture artefact; requires the P-11 feedback loop |
| 🟡 **Medium** | Requires design rework within a component |
| 🟢 **Low** | Parameter or configuration change |

---

## Index

| ID | Statement | Impact | Status |
|---|---|---|---|
| [A-001](#a-001) | Fleet telemetry is available through a queryable interface | 🔴 High | Open |
| [A-002](#a-002) | An authoritative emergency incident feed can be obtained | 🔴 High | Open |
| [A-003](#a-003) | A passenger notification channel exists and is reachable | 🟡 Medium | Open |
| [A-004](#a-004) | Vehicle position is reported at roughly 30-second intervals | 🟡 Medium | Open |
| [A-005](#a-005) | Drivers can receive a revised stop sequence in service | 🔴 High | Open |
| [A-006](#a-006) | A control room exists with authority to alter live services | 🟢 Low | Open |
| [A-007](#a-007) | A disruption can be represented as a geographic footprint plus a time window | 🔴 High | Open |
| [A-008](#a-008) | The road network permits a feasible bus detour in most disruption cases | 🟡 Medium | Open |
| [A-009](#a-009) | Published GTFS accurately reflects the operated network | 🟡 Medium | Open |
| [A-010](#a-010) | Stop-level boarding counts are unavailable | 🟡 Medium | Open |
| [A-011](#a-011) | Controllers will act on a recommendation within ~60 seconds | 🔴 High | Open |
| [A-012](#a-012) | Reference systems expose synchronous request/response interfaces | 🟡 Medium | Open |

---

## A-001

**Statement.** The Reference Fleet Management System exposes current vehicle assignments — which vehicle is operating which trip on which route — through a queryable interface.

| Field | |
|---|---|
| **Classification** | ASSUMPTION |
| **Reason** | No operator's fleet management interface is publicly documented. The existence of such a system is near-certain; its interface is not. |
| **Purpose** | Required to answer "which vehicles are affected by this disruption?", which is the first question after detection and the input to every subsequent step. |
| **Confidence** | High that the capability exists. Low on its shape — it could equally be a database view, a message stream, or a batch export with latency that makes it useless for real-time decisions. |
| **If wrong** | 🔴 If assignment data is not available in near-real-time, affected-vehicle identification must be inferred from position against route geometry. That is a different component with different accuracy and a different failure mode, and it changes the application architecture. |
| **Validation** | Day one: ask what system holds vehicle-to-trip assignment, how it is queried, and what its freshness guarantee is. |

---

## A-002

**Statement.** An authoritative emergency incident feed — road closures and public-safety incidents from police or emergency services — can be obtained in near-real-time.

| Field | |
|---|---|
| **Classification** | ASSUMPTION |
| **Reason** | The baseline proposal names An Garda Síochána feeds. No public An Garda Síochána incident API exists. A real-time feed to a third party would need a legal basis, a data-sharing agreement and an interface that are not publicly documented. |
| **Purpose** | This is the input that distinguishes a *confirmed* closure from *inferred* congestion. Detection confidence, and therefore the autonomy model, depends on having an authoritative trigger. |
| **Confidence** | Low. Emergency services data sharing is governed by considerations — operational security, live investigations, public safety — that frequently preclude third-party real-time access regardless of technical feasibility. |
| **If wrong** | 🔴 Disruption detection loses its authoritative trigger and falls back to inference plus control-room confirmation. False-positive rates rise materially, the confidence model needs rebuilding, and the case for any automatic activation weakens to the point of collapse. |
| **Validation** | Day one: establish whether any emergency-services data-sharing arrangement exists or could exist, and on what latency. Treat a negative answer as likely and design the fallback first. |

---

## A-003

**Statement.** A passenger-facing notification channel exists, reaches an opted-in audience, and can be addressed programmatically at stop-level granularity.

| Field | |
|---|---|
| **Classification** | ASSUMPTION, with an associated FUTURE CONSIDERATION |
| **Reason** | Assumes access to a mobile estate, a notification platform and an opted-in user base, none of which are observable. |
| **Purpose** | Realises the Passenger Alerts output capability from the baseline concept. |
| **Confidence** | Moderate that a channel exists. Low that stop-level targeting is available, since that requires knowing which passengers care about which stop — journey inference about identifiable individuals. |
| **If wrong** | 🟡 Passenger communication degrades to broadcast (route-level, not stop-level). The notification component simplifies; the passenger outcome is materially worse. |
| **If right** | The GDPR exposure is significant and is **not** addressed by this project. Stop-level targeting implies location and journey inference about identifiable individuals, requiring a lawful basis, a DPIA and a retention policy. Declared as a FUTURE CONSIDERATION. |
| **Validation** | Day one: establish the channel, the opt-in base, the targeting granularity — and involve a data protection officer before writing any code. |

---

## A-004

**Statement.** The Reference Vehicle GPS Platform emits position updates at approximately 30-second intervals.

| Field | |
|---|---|
| **Classification** | ASSUMPTION |
| **Reason** | Real telemetry cadence is unknown. 30 seconds is chosen as a plausible midpoint of observed public-transport AVL practice, which ranges from roughly 5 to 60 seconds. |
| **Purpose** | Sets the granularity of affected-vehicle identification and bounds the detection-to-decision latency budget. |
| **Confidence** | Moderate. The order of magnitude is defensible; the specific value is not. |
| **If wrong** | 🟡 Faster is harmless. Substantially slower — a 60-second-plus cadence — means a vehicle may already have entered the disruption zone before the system knows it is approaching, which changes the decision from "reroute ahead" to "recover from within", a different problem. |
| **Validation** | Day one: measure actual cadence and jitter, not the documented cadence. |

---

## A-005

**Statement.** Drivers can receive a revised stop sequence while in service, and act on it.

| Field | |
|---|---|
| **Classification** | ASSUMPTION |
| **Reason** | In-cab hardware, its capability, and the operational rules governing driver interaction with it while driving are all unknown. |
| **Purpose** | Realises the Driver Interface output capability. Without it, the entire decision chain terminates at the control room and the system's value collapses to advisory. |
| **Confidence** | Moderate on the technical capability. **Low on the operational reality** — driver distraction rules, union agreements and safety policy may constrain what can be displayed or acknowledged while a vehicle is moving, independently of what the hardware can do. |
| **If wrong** | 🔴 The output architecture changes fundamentally. Instructions would route through voice or via a supervisor, adding a human relay step to the latency budget and removing any guarantee of acknowledgement. The end-to-end design premise — seconds, not minutes — does not survive this. |
| **Validation** | Day one: in-cab hardware capability, *and separately* the operational and safety rules governing its use in motion. These are different questions with different answers and the second one is the one that bites. |

---

## A-006

**Statement.** A control room exists, is staffed during service hours, and has the authority to alter live services.

| Field | |
|---|---|
| **Classification** | ASSUMPTION (near-fact) |
| **Reason** | Universal practice for operators of this scale, but the specific authority model — who may authorise what without escalation — is unknown. |
| **Purpose** | Realises P-1, the human-decides principle, on which the whole autonomy model rests. |
| **Confidence** | Very high on existence. Moderate on the authority model. |
| **If wrong** | 🟢 Low impact on architecture; the approval step remains, only its actor changes. Would affect role modelling and authorisation design, not component boundaries. |
| **Validation** | Day one: the authority matrix — who approves what, and what escalates. |

---

## A-007

**Statement.** A disruption can be adequately represented as a geographic footprint plus a time window.

| Field | |
|---|---|
| **Classification** | ASSUMPTION — and the most consequential in this register |
| **Reason** | Chosen as a tractable model. It is an approximation of a messier reality, and its inadequacy is known in advance rather than discovered later. |
| **Purpose** | It is the core data structure. Detection produces it, impact assessment consumes it, optimisation routes around it, and the audit log records it. Everything downstream inherits its shape. |
| **Confidence** | Good for static disruptions — a flooded road, a cordoned incident, a closed bridge. **Poor for dynamic ones.** A marching protest moves. A developing flood grows. A partial closure restricts capacity without blocking it, which a binary footprint cannot express. |
| **If wrong** | 🔴 Affects the data architecture, the detection model and the optimisation input simultaneously. Supporting moving or graduated disruptions would require a time-varying footprint and a cost-weighted rather than binary network penalty — a change to the conceptual data model, propagating through every dependent artefact. |
| **Validation** | Day one: characterise the real distribution of disruption types by shape and mobility. If moving disruptions are common rather than exceptional, this model needs replacing before the first component is built. |
| **Note** | Recorded now, at Phase 1, as a deliberate candidate for the P-11 feedback loop. It is the assumption most likely to be contradicted by implementation, which makes it the best available worked example for charter objective O-5. |

---

## A-008

**Statement.** In most disruption cases the road network offers a feasible alternative path that a bus can physically use.

| Field | |
|---|---|
| **Classification** | ASSUMPTION |
| **Reason** | Feasibility depends on turning circles, bridge heights, weight limits, bus-lane access, one-way systems and street furniture. OpenStreetMap carries some of this inconsistently and much of it not at all. |
| **Purpose** | If no feasible detour exists, the decision is "hold or terminate", not "reroute" — a different branch of the decision engine. The assumption determines which branch is the common case. |
| **Confidence** | Moderate in a dense urban grid. Low on radial corridors and river crossings, where the alternative to a closed bridge may be several kilometres away or may not exist. |
| **If wrong** | 🟡 The decision engine's hold/terminate branch becomes the primary path rather than the exception, shifting the system's value from rerouting to impact communication. |
| **Validation** | Day one: obtain the operator's own network constraint data. Operators know which roads their buses can use; OpenStreetMap does not. |

**Stage Two evidence (v1.1.0, 2026-09-17).** Building the road graph and matching the GTFS sample onto it showed three ways OpenStreetMap falls short of describing where buses run. The assumption stays open: these findings concern network data, not detour feasibility itself.

- **A road-class filter misses real bus roads.** A drivable graph of motorway through residential roads left out 231 service roads that OSM's own bus route relations use, including hospital access roads. Without them, route N4 had to detour around Connolly Hospital grounds. See the [road graph](../../data/fixtures/osm-graph/README.md).
- **OSM's bus route relations are incomplete.** Route 40D's published shape runs through Blanchardstown Corporate Park, but OSM's 40D relation does not include the park's roads. Four stops remain 84–145 m from the graph. See the [network fixture](../../data/fixtures/network/README.md#match-quality).
- **Contraflow bus lanes are unevenly tagged.** On Custom House Quay and Eden Quay, only some one-way segments record a contraflow bus lane (`lanes:psv:backward`). The rest are plain `oneway=yes`.

---

## A-009

**Statement.** Published GTFS accurately reflects the network as operated.

| Field | |
|---|---|
| **Classification** | ASSUMPTION |
| **Reason** | GTFS is a *scheduled* representation. Divergence between published schedule and operated reality is normal in every transit system. |
| **Purpose** | GTFS is the source of route, stop and sequence data for the entire reference implementation. |
| **Confidence** | High for topology — routes and stops are stable and well-maintained. Lower for timing and for temporary variations already in effect. |
| **If wrong** | 🟡 The demonstrator reasons about a network slightly different from the real one. Acceptable for demonstration; unacceptable for operation, where a real implementation would need the operator's live service state rather than the published schedule. |
| **Validation** | Day one: reconcile published GTFS against the operator's internal service definition and measure the delta. |

---

## A-010

**Statement.** Stop-level boarding counts are not available to the system.

| Field | |
|---|---|
| **Classification** | ASSUMPTION |
| **Reason** | Ticketing and automatic passenger counting data may exist but is assumed inaccessible — commercially sensitive, separately governed, or simply held by another system. |
| **Purpose** | Determines whether "passengers affected" is a measured quantity or a modelled one. In this implementation it is modelled from synthetic demand. |
| **Confidence** | Moderate. Such data often exists somewhere; whether it is obtainable, timely and usable is a different matter. |
| **If wrong** — *i.e. if the data IS available* | 🟡 The optimisation objective improves substantially, becoming measurement-driven rather than model-driven. This is the one entry in this register where being wrong is good news. |
| **Validation** | Day one: establish whether AFC or APC data exists, at what granularity and latency, and under what governance. |
| **Note** | Interacts directly with [P-7](../01-stage-one-architecture/methodology/architecture-principles.md#p-7--stop-skipping-is-not-neutral). Even with boarding counts, volume is not need — a stop serving a hospital is not interchangeable with an equally busy stop that has three alternatives nearby. Counting better does not by itself make the decision fairer. |

---

## A-011

**Statement.** A controller can evaluate and act on a recommendation within approximately 60 seconds.

| Field | |
|---|---|
| **Classification** | ASSUMPTION |
| **Reason** | No observational basis. Chosen as a plausible figure for a trained operator acting on a pre-analysed recommendation with the reasoning presented alongside it. |
| **Purpose** | It is the dominant term in the end-to-end latency budget. Under this assumption, human deliberation exceeds all machine processing combined, which is what makes P-1 a real cost rather than a slogan. |
| **Confidence** | Low, and dependent on a variable the system controls: trust. A controller who does not trust the system will verify independently, and verification takes minutes. A controller managing six simultaneous disruptions is queueing, not deliberating. |
| **If wrong** | 🔴 If realistic response times are minutes rather than seconds, the "within seconds" premise of the whole concept fails, and the design must shift toward pre-approved contingency activation — which raises the autonomy question the concept was structured to avoid. |
| **Validation** | Day one, and it cannot be answered from a repository: observe real controllers under real disruption. This is the assumption most likely to determine whether a system like this works at all, and the least amenable to desk analysis. |

---

## A-012

**Statement.** Reference external systems expose synchronous request/response interfaces (HTTP/REST or equivalent) rather than batch or file-based integration.

| Field | |
|---|---|
| **Classification** | ASSUMPTION |
| **Reason** | Unknown, and operational transport systems frequently include older integration styles — scheduled file drops, message queues with delivery windows, proprietary protocols. |
| **Purpose** | Shapes the integration architecture and the latency budget for every external call. |
| **Confidence** | Moderate for newer components. Low for anything that has been in place for a decade or more, which in this domain is most things. |
| **If wrong** | 🟡 Integration moves to an adapter-with-caching pattern and freshness guarantees weaken. The architecture already favours adapter boundaries ([P-8](../01-stage-one-architecture/methodology/architecture-principles.md#p-8--boundaries-follow-data-ownership)), which limits the blast radius — but the latency budget would need rebuilding. |
| **Validation** | Day one: integration style and freshness guarantee for each system, asked separately. They are not the same question and the answers are often uncomfortable. |

---

## Deferred to Phase 3

The register is seeded here with the assumptions that Phase 1 artefacts already depend on. Phase 3 defines the fictional operating model in full and will add assumptions covering: authentication and identity federation, service-to-service trust, data retention and residency, network topology and connectivity, operational support model, and incident escalation paths.
