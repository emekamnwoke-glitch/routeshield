# Phase F — Migration Planning

> **Status: complete.** Exit condition satisfied — see [below](#exit-condition).

How to get from nothing to the target, and what could stop it.

## Documents

| | |
|---|---|
| [Roadmap and Release Plan](roadmap-and-release-plan.md) | Stage Two releases v1.1.0 → v2.0.0 as vertical increments, dependencies, critical path |
| [Risk Register](risk-register.md) | 13 project risks and 13 solution risks, scored, with responses |
| [Migration Strategy](migration-strategy.md) | How an operator would introduce RouteShield: shadow → impact view → advisory → operational → pre-approved |

## What this settles

**Releases are vertical.** Each Stage Two release ends with something a person can do that they could not before.

**Notifications move ahead of the dashboard.** The suggested milestone order is swapped so the least-served stakeholder is not deferred again after the MVP. Names are kept; order follows the architecture.

**The network pipeline is the critical path and the largest technical risk** — matching GTFS shapes onto an OpenStreetMap road graph. It is built first.

**An operator migrates by earning trust, not by cutover.** Nothing is replaced; the manual process becomes the fallback, and each increase in RouteShield's role is gated on evidence and reversible in minutes.

## Exit condition

| Check | |
|---|---|
| Every transition architecture has a release | ✅ T0 → v1.1.0 · T1 → v1.2.0–v1.3.0 · T2 → v1.4.0 · T3 → v1.5.0 · T4 → v1.6.0 · T5 → v2.0.0 |
| Every risk has an owner and a response | ✅ Project risks: author · Solution risks: adopting operator |

**Phase F exit condition satisfied.**
