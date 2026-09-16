# Risk Register

| | |
|---|---|
| **Phase** | F — Migration Planning |
| **Document version** | 1.0 |
| **Status** | Live — reviewed at every milestone |

---

Two kinds of risk are tracked separately because they have different owners:

- **Project risks** — to this repository delivering what the charter promises. Owner: the author.
- **Solution risks** — to an operator adopting the architecture. Owner: the adopting operator. Recorded because identifying them is part of the architecture's value.

Scales: **L**ikelihood and **I**mpact, each 1 (low) – 3 (high). Score = L × I.

## 1. Project risks

| ID | Risk | L | I | Score | Response | Status |
|---|---|---|---|---|---|---|
| **R-001** | Stage Two is read as a claim about a real operator's systems | 2 | 3 | 6 | Prominent disclaimers; fictional systems labelled at every point of use; no operator branding | Open — mitigated |
| **R-002** | Scope growth leaves many incomplete components | 2 | 3 | 6 | Vertical releases; each milestone must be demonstrable before the next starts | Open |
| **R-003** | Fact/assumption discipline degrades quietly | 3 | 3 | 9 | Register-before-code rule; PR checklist; degradation-mode check at every milestone | Open |
| **R-004** | Synthetic results presented as meaningful | 2 | 3 | 6 | "Synthetic" label at point of display; rule baselines beside every model | Open |
| **R-005** | Browser-only constraint quietly distorts the architecture | 2 | 2 | 4 | Operator profile kept separate; reference-profile gaps listed | Mitigated |
| **R-006** | GTFS→OSM pattern snapping is harder than expected (shapes misaligned, missing links) | 3 | 3 | 9 | Build first (v1.1.0); fall back to straight-line segments between stops for affected-route detection if snapping fails, labelled | Open |
| **R-007** | Road graph for the Dublin area too large for a responsive browser app | 2 | 2 | 4 | Restrict to bus-relevant road classes and a bounded area; compact binary format | Open |
| **R-008** | Snapshot write or optimisation exceeds the 5 s machine budget | 2 | 2 | 4 | Measure from v1.3.0; area-scoped snapshots; time-boxed optimiser | Open |
| **R-009** | Hand-written tree evaluator diverges from trained model | 2 | 2 | 4 | CI parity test (ADR-0016) | Open |
| **R-010** | Open data sources change URL, format or licence | 1 | 2 | 2 | Manifest with checksums; pinned processed outputs committed | Open |
| **R-011** | GitHub Pages unavailable for a private repository | — | — | — | Repository made public on 2026-09-16 after v1.0.0; GitHub Pages available (ADR-0008) | **Closed** |
| **R-012** | Single author — no independent review | 3 | 2 | 6 | Structural controls ([governance](../methodology/architecture-governance.md)); CI-checked traceability | Accepted |
| **R-013** | The feedback loop is staged rather than genuine | 2 | 3 | 6 | Subject and trigger fixed in advance (ADR-0005, BS-2); outcome recorded whatever it is, including "no change needed" | Open |

R-013 deserves a note. The Phase H worked example was chosen before any code existed so that it could not be retrofitted. The corresponding risk is that it is performed rather than found. The response is to record whatever the simulation shows, even if the finding is that ADR-0005 holds.

## 2. Solution risks

Carried from earlier phases.

| ID | Risk | Source | L | I | Score | Response |
|---|---|---|---|---|---|---|
| **R-101** | Approval becomes ceremonial | BR-R1 | 3 | 3 | 9 | Queue bound (BR-023); rubber-stamping indicator (BR-024) |
| **R-102** | Tacit feasibility knowledge is not captured | BR-R2 | 3 | 2 | 6 | Operator constraint data; refusal clustering |
| **R-103** | Manual fallback atrophies | BR-R3 | 3 | 3 | 9 | Scheduled exercises — organisational, not architectural |
| **R-104** | Automation bias | BR-R4 | 3 | 2 | 6 | Uncertainty shown prominently; confidence gates A2 |
| **R-105** | Confident error at scale | BR-R5 | 2 | 3 | 6 | Confidence gates breadth (BR-046); blast-radius limits |
| **R-106** | No authoritative incident feed obtainable | A-002 | 3 | 2 | 6 | Declaration path is the floor; design works without it |
| **R-107** | Drivers cannot act on in-cab sequences | A-005 | 2 | 3 | 6 | Voice relay fallback; latency targets revisited |
| **R-108** | Controllers cannot evaluate within ~60 s | A-011 | 2 | 3 | 6 | Observe in shadow mode before advisory use |
| **R-109** | Static footprints misrepresent moving disruptions | A-007, ADR-0005 | 3 | 2 | 6 | Confidence decay; A2 disabled for mobile types; review in T5 |
| **R-110** | Contingency library automates by accretion | Autonomy §5 | 2 | 3 | 6 | Mandatory expiry; separation of duties; A2 share on governance dashboard |
| **R-111** | Equity: same communities repeatedly lose service | SC-008, P-7 | 2 | 3 | 6 | Criticality term reserved; distribution of skipped stops per corridor reported |
| **R-112** | Audit store outage stops all changes | FR-D3 | 1 | 3 | 3 | Replicated audit store; manual fallback with manual record |
| **R-113** | Industrial relations object to telemetry use | SC-041 | 2 | 2 | 4 | Driver identity structurally absent from analytics; early consultation |

## 3. Review

At every milestone tag, before tagging:

- re-score every open risk;
- close risks whose response is complete, stating the evidence;
- add risks the milestone revealed.
