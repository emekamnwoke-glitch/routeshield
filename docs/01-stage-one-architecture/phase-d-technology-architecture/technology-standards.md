# Technology Standards

| | |
|---|---|
| **Phase** | D — Technology Architecture |
| **Document version** | 1.0 |
| **Status** | Baseline |

---

## 1. Interface and data standards

Apply to both profiles.

| Area | Standard | Use |
|---|---|---|
| Scheduled network | GTFS Schedule | Network source; NetworkPort shape |
| Real-time vehicle data | GTFS-Realtime | FleetPort shape |
| Passenger alerts | GTFS-Realtime Alerts; SIRI-SX | PassengerChannelPort shape |
| Road conditions | DATEX II | RoadConditionPort shape |
| Incidents | OASIS Common Alerting Protocol | IncidentPort shape |
| Road graph | OpenStreetMap data model | Network geometry |
| Identity | OpenID Connect | IdentityPort (operator profile) |
| Telemetry | OpenTelemetry data model | All modules |
| Geometry | WGS 84 (EPSG:4326) for storage and exchange; projected metric CRS for distance computation | All spatial data |
| Time | UTC, ISO 8601 | Everywhere |
| Identifiers | Opaque, immutable, globally unique | All owned entities |
| API | HTTP + JSON, version in path | Workspace API (operator profile) |

Modelling fictional interfaces on these standards keeps the fiction disciplined ([P-4](../methodology/architecture-principles.md#p-4--open-and-standard-before-proprietary)). It does not assert that any operator uses them.

## 2. Reference profile stack

| Layer | Choice | ADR |
|---|---|---|
| Hosting | GitHub Pages (static) | 0008 |
| Core, adapters, simulators | TypeScript, run in a Web Worker | 0006, 0009 |
| UI | React + TypeScript | 0009 |
| Store | SQLite WASM, `opfs-sahpool` | 0010 |
| Optimiser isolation | Dedicated Web Worker with time budget | 0006 |
| Build pipeline | Python | 0009, 0011 |
| Network data | NTA GTFS (CC BY 4.0), OpenStreetMap (ODbL) | 0011 |
| Identity | Simulated personas, real authorisation | 0012 |
| Telemetry | OTel-shaped, in-memory exporter | 0013 |
| CI/CD | GitHub Actions | Phase F |
| Local tooling | Docker (reproducible toolchain only) | — |

Specific libraries (routing graph library, UI build tool, test runners, map rendering, ML framework) are chosen in Phase E and Stage Two, each against a requirement, and recorded where the choice is significant.

## 3. Engineering standards

| Area | Standard |
|---|---|
| Versioning | Semantic versioning for releases; milestone tags per the roadmap |
| Commits | Conventional commits ([CONTRIBUTING](../../../CONTRIBUTING.md)) |
| Dependencies | Pinned via lock files; no runtime dependency loaded from a third-party CDN |
| Formatting and linting | Enforced in CI for both languages |
| Types | Strict type checking in TypeScript; type hints checked in Python |
| Tests | Traceable to requirements by `TC-nnn` |
| Configuration | Environment-based; `.env.example` documents every setting |
| Secrets | None in the reference profile; secret manager in the operator profile |
| Accessibility | WCAG 2.1 AA for the workspace UI |
| Licences | Dependencies must be permissively licensed; data attribution shown in the app |
