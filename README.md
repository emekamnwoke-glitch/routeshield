# RouteShield

**An emergency rerouting system for urban bus networks — taken from business problem, through governed enterprise architecture, to a working reference implementation.**

---

> ### ⚠️ Read this before anything else
>
> This repository contains **two distinct things**, and conflating them would be a serious misreading.
>
> **Stage One** is an enterprise architecture for a disruption-response capability in an urban bus network. It is technology-neutral, method-driven, and stands on its own.
>
> **Stage Two** is a **fictional reference implementation**. Every external system it integrates with is invented for the purpose of demonstration. The author has no access to, and makes no claim about, the real internal architecture, APIs, data models, infrastructure or operational systems of Dublin Bus, the National Transport Authority, or any other transport operator.
>
> Nothing in Stage Two should be read as a description of how any real operator's systems work. See [Fact vs Assumption](docs/02-stage-two-reference-implementation/fact-vs-assumption-model.md) for how every claim in this repository is classified and why.

---

## 1. What RouteShield is

When a city bus network is disrupted — a blocked corridor, a flood, a public-order incident — the operational question is narrow and urgent:

> Which services are affected, what should each one do instead, and how does everyone who needs to know find out in time?

RouteShield is a system design that answers that question mechanically rather than manually. It detects that a disruption has occurred, works out which routes and stops are affected, generates and ranks alternative stop sequences, puts a recommendation in front of a human controller, and — once approved — pushes the change to drivers, passengers and the control room while logging every step for audit.

The organising principle from the original concept is preserved throughout:

> **Skip as few stops as possible, keep as many passengers moving as possible, and leave nobody without information.**

## 2. The problem

Urban bus networks are optimised for the scheduled case. Disruption handling is typically manual: a controller notices or is told, reasons about the network from experience, phones or radios drivers individually, and passenger information lags the actual service by minutes or longer. This works, but it scales badly. One controller handling six simultaneously-affected routes is making six sequential decisions under time pressure with incomplete information, and the passengers standing at the stops are the last to find out.

The cost is not primarily financial. It is the erosion of the thing that makes public transport usable at all — the reasonable expectation that a bus will come. Disruption is exactly when that expectation matters most and is honoured least.

## 3. Why this project exists

This is a personal portfolio project. Its purpose is to demonstrate, end to end and in public, the discipline that connects a business problem to running software:

```
Real-world problem
      ↓
Enterprise Architecture
      ↓
Solution Architecture
      ↓
Requirements
      ↓
Reference Implementation
      ↓
SDLC → Testing → CI/CD → Deployment → Operations
```

Most portfolios show one end of that chain or the other. Architecture repositories contain diagrams that were never tested against an implementation. Code repositories contain implementations whose architectural reasoning was never written down. This repository is an attempt to show the whole chain, including the uncomfortable parts — the assumptions that had to be invented, the decisions that turned out to be wrong, and the feedback loop that carried implementation learning back into the architecture.

### Origin

Walking through the blocked streets of O'Connell Street in Dublin City Centre, I experienced a hardship in getting transport to commute from one end of Dublin to the other. The event was the 2026 Irish Fuel Protests - https://en.wikipedia.org/wiki/2026_Irish_fuel_protests, thereby blocking most traffic. I stumbled upon a flyer on a bus during my commute, which was the Dublin Bus Innovation Challenge and with the power of AI, I did let my thoughts do the talking. The underlying concept was developed as a submission to the **Dublin Bus Innovation Challenge** (Challenge 4: Smart Cities, April 2026). My submitted proposal is the authoritative baseline for the business concept and is treated as a source document, not as a specification. Where the proposal is silent, this repository fills the gap and says so. 

Please note: Where the proposal asserts something that cannot be verified, this repository reclassifies it as an assumption and says so.

## 4. Architecture methodology

Stage One follows a lifecycle **inspired by the TOGAF Architecture Development Method**. It is a tailored method, not a reproduction of TOGAF, and no proprietary TOGAF content is contained here.

| Phase | Concern | Status |
|---|---|---|
| Preliminary | Architecture capability, principles, governance, scope | 🟢 Complete |
| A — Architecture Vision | Problem, vision, stakeholders, target outcomes | 🟢 Complete |
| B — Business Architecture | Capabilities, actors, value streams, as-is/to-be | 🟢 Complete |
| C — Data Architecture | Domains, conceptual & logical models, lifecycle, governance | ⬜ Planned |
| C — Application Architecture | Landscape, components, service boundaries, integration | ⬜ Planned |
| D — Technology Architecture | Infrastructure, runtime, network, security, observability | ⬜ Planned |
| E — Opportunities & Solutions | Building blocks, MVP, transition states | ⬜ Planned |
| F — Migration Planning | Roadmap, releases, dependencies, risk | ⬜ Planned |
| G — Implementation Governance | Compliance, traceability, change control | ⬜ Planned |
| H — Change Management | Architecture evolution, continuous improvement | ⬜ Planned |
| Requirements Management | Continuous across all phases | ⬜ Planned |

Method definition: [`docs/01-stage-one-architecture/methodology/`](docs/01-stage-one-architecture/methodology/)

## 5. Stage One — Architecture

Stage One asks: *what should this capability look like, independent of who builds it or what they build it with?*

It produces a business capability model, a data architecture, an application architecture with explicit service boundaries, a technology architecture, and a governed set of requirements traceable from business need down to test case. It commits to no vendor and no language.

## 6. Stage Two — Fictional reference implementation

Stage Two asks a deliberately narrower question: *if an operational environment of the right shape existed, how would you actually build this?*

Because the real environment is not observable, Stage Two defines a **fictional reference operating environment** — a set of clearly-labelled invented systems that stand in for the real ones:

- Reference Fleet Management System
- Reference Vehicle GPS Platform
- Reference Traffic Data Provider
- Reference Incident Management System
- Reference Passenger Information System
- Reference Driver Communication Platform
- Reference Operations Control Centre

These are **fictional**. They are documented in [`fictional-operating-model.md`](docs/02-stage-two-reference-implementation/fictional-operating-model.md) with the interface each one is assumed to expose and the reason that assumption is necessary.

## 7. The fact / assumption boundary

Every load-bearing statement in Stage Two carries one of four classifications:

| Class | Meaning |
|---|---|
| **FACT** | Supported by the original proposal or a citable public source |
| **ASSUMPTION** | Invented to make the reference implementation possible; not known to reflect any real system |
| **DESIGN DECISION** | A choice made for this implementation, with recorded rationale |
| **FUTURE CONSIDERATION** | Deferred; would need validation before any real implementation |

Assumptions carry stable identifiers (`A-001`, `A-002`, …) and live in the [assumptions register](docs/02-stage-two-reference-implementation/assumptions.md). Nothing in Stage Two is allowed to depend on an unregistered assumption.

This is the single most important convention in the repository. An architecture that cannot distinguish what it knows from what it supposed is not an architecture; it is a wish.

## 8. Architecture diagrams

Diagrams live in [`architecture/diagrams/`](architecture/diagrams/) and inline in the phase documents, authored in Mermaid so they are diffable and reviewable in pull requests.

Every diagram in this repository exists to communicate a decision. There are no decorative diagrams.

## 9. Technology stack

Stage Two is constrained to run **entirely in the browser** with no hosted backend, so the project can be published and demonstrated at zero cost and never sleeps behind a cold start. This is a real constraint with real architectural consequences, and it is recorded as a design decision rather than hidden.

The stack is selected in Phase D and recorded through ADRs. Candidates under evaluation:

| Concern | Candidate | Note |
|---|---|---|
| Domain engine | TypeScript | Runs in-browser and under Node; no runtime lock-in |
| Embedded store | DuckDB-WASM | In-browser analytical + spatial queries |
| Network data | NTA GTFS / GTFS-Realtime, OpenStreetMap | Open, citable, free |
| Routing | Graph search over an OSM-derived network | Algorithm selected by ADR |
| ML | Trained offline in Python, exported to ONNX, inferred in-browser | Training is reproducible in CI |
| Frontend | React + TypeScript | Control dashboard and simulation UI |
| Build data pipeline | Python | Runs at build time, not runtime |
| CI/CD | GitHub Actions | Lint, test, scan, build, publish |

These are **candidates, not commitments**. Each is argued for or against in an ADR before adoption.

## 10. SDLC

Stage Two is delivered through a documented Agile/DevSecOps lifecycle — discovery, requirements, backlog, stories with acceptance criteria, design, build, the full test pyramid, security and performance testing, CI/CD, deployment, monitoring and continuous improvement. See [`docs/03-sdlc/`](docs/03-sdlc/).

## 11. Testing

Unit, integration, system, acceptance, security, performance and resilience testing, with test cases traceable to the requirements that motivated them. See [`docs/03-sdlc/`](docs/03-sdlc/).

## 12. CI/CD

Pull requests run lint → unit → integration → security → build. Merges to `main` additionally build and publish the demonstrator. Workflows in [`.github/workflows/`](.github/workflows/).

## 13. Running locally

> Not yet available. The runnable MVP arrives in Phase 5 — see the [roadmap](#15-roadmap). Instructions will be added here when there is something to run, and not before.

## 14. Repository structure

```text
routeshield/
├── docs/
│   ├── 00-project/                          Charter, scope, glossary
│   ├── 01-stage-one-architecture/           TOGAF-inspired ADM phases
│   ├── 02-stage-two-reference-implementation/   Fictional environment, requirements, design
│   ├── 03-sdlc/                             Lifecycle, testing, CI/CD
│   ├── 04-operations/                       Runbooks, observability, KPIs
│   └── 05-architecture-decisions/           ADRs
├── architecture/                            Diagrams, models, views
├── src/                                     Domain engine
├── frontend/                                Control dashboard & simulation UI
├── pipeline/                                Build-time data & ML pipeline
├── tests/                                   Test suites
├── data/                                    Synthetic datasets & fixtures
├── infrastructure/                          Local containerised environment
└── .github/                                 Workflows, templates
```

## 15. Roadmap

Milestones are published as Git tags, so the repository history reads as the architecture being developed rather than as a finished thing dropped in one commit.

| Tag | Milestone | Status |
|---|---|---|
| `v0.1.0` | Project foundation | 🟢 |
| `v0.2.0` | Architecture Vision | 🟢 |
| `v0.3.0` | Business Architecture | 🟢 Current |
| `v0.4.0` | Information Systems Architecture | ⬜ |
| `v0.5.0` | Technology Architecture | ⬜ |
| `v0.6.0` | Solution Blueprint | ⬜ |
| `v1.0.0` | **Stage One complete** | ⬜ |
| `v1.1.0` | Stage Two foundation | ⬜ |
| `v1.2.0` | Disruption engine | ⬜ |
| `v1.3.0` | Routing engine | ⬜ |
| `v1.4.0` | Control dashboard | ⬜ |
| `v1.5.0` | Notifications | ⬜ |
| `v1.6.0` | ML prototype | ⬜ |
| `v2.0.0` | **Reference implementation complete** | ⬜ |

## 16. Architecture decisions

Significant decisions are recorded as ADRs in [`docs/05-architecture-decisions/`](docs/05-architecture-decisions/), each stating the problem, the options considered, the decision, the rationale, the consequences and the alternatives rejected.

A decision without a recorded alternative is not a decision. It is a habit.

## 17. Limitations

Stated plainly, because a portfolio project that hides its limitations is not demonstrating engineering judgement:

- **The operating environment is invented.** Stage Two integrates with fictional systems. A real implementation would discover that the real interfaces differ in ways that invalidate parts of this design.
- **The machine learning is cold-start.** There is no corpus of historical disruptions. Models are trained on synthetic incidents and demonstrate the mechanism, not predictive accuracy. Any accuracy figure in this repository is a property of the synthetic data.
- **No-backend is a real constraint.** The browser-only deployment target genuinely limits what can be demonstrated — notably multi-user control-room concurrency and server-side event streaming. The architecture accounts for this; the demonstrator cannot fully exercise it.
- **No operational validation.** Nothing here has been tested against a real fleet, real controllers or real passengers. Decision latency, controller trust and driver compliance are the risks most likely to determine whether a system like this would actually work, and none of them can be evaluated from a repository.
- **Safety and liability are addressed on paper only.** Rerouting a bus is an operational instruction with real-world consequences. This repository designs for accountability and audit; it does not discharge it.

## 18. Future development

Beyond `v2.0.0`: multimodal disruption response across rail and light rail, controller-in-the-loop learning from accept/reject decisions, formal accessibility weighting in the optimisation objective, and a hosted multi-user variant that exercises the concurrency the browser-only build cannot.

---

## Licence

[MIT](LICENSE) — Copyright © 2026 Chukwuemeka Nwoke

## Author

**Chukwuemeka Nwoke** — MSc Computer Science, University College Dublin. Business & Enterprise Architect.

This is an independent personal project. It is not affiliated with, endorsed by, or produced in cooperation with Dublin Bus, the National Transport Authority, or any transport operator.
