# ADR-0008: Deploy the reference implementation as a browser-hosted static site

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-16 |
| **Phase** | D — Technology Architecture |
| **Principles engaged** | P-4, P-9, P-10 |
| **Constraints** | C-2 (zero cost) |
| **Supersedes** | — |

---

## Context

The reference implementation must be publicly demonstrable at no cost, and should not disappear or cold-start when an interviewer opens it. The operator profile requires a server, a replicated database and an identity provider; none of those are free to run permanently.

The repository is private at the time of writing and is intended to become public at the `v1.0.0` milestone.

## Problem

Where and how should the reference implementation run?

## Options considered

### Option 1 — Local only (Docker Compose with a server and database)
**For:** Closest to the operator profile. **Against:** No link to share; a reviewer must clone and run it.

### Option 2 — Free-tier server hosting (container or serverless API + free managed Postgres)
**For:** Real client–server split; real multi-user. **Against:** Free tiers sleep, expire, change terms, or cap hours; a demo that takes 30 seconds to wake or has been deleted by a provider policy change fails at the moment it is shown. Adds credentials to manage.

### Option 3 — Static site; the whole system runs in the browser
**For:** Free indefinitely on static hosting; never sleeps; no secrets; one artefact. The Phase C architecture (modular monolith, local transactions, in-process events) already fits a single runtime.
**Against:** No multi-user state, no real authentication, no server-side telemetry, and storage the visitor controls ([technology architecture §6](../01-stage-one-architecture/phase-d-technology-architecture/technology-architecture.md#6-what-the-reference-profile-cannot-provide)).

## Decision

**Option 3.** The reference implementation is a static bundle — application, processed data and models — served from **GitHub Pages**, executing entirely in the visitor's browser.

GitHub Pages serves private repositories only on paid plans. Until the repository is public, deployment is to a local preview; **Cloudflare Pages** (free tier, supports private repositories) is the documented alternative if the repository stays private. The build output is host-agnostic.

## Rationale

The demonstration has to work when opened, every time, for years, at zero cost. Only Option 3 meets that. Its limitations are real but fall on capabilities the operator profile documents and the demonstrator was never going to exercise faithfully anyway — a free-tier "multi-user" deployment with one user demonstrates concurrency no better than a browser does.

## Consequences

- **Positive:** zero cost; permanent; no secrets; simplest CI deployment.
- **Negative:** multi-user and authentication are simulated; storage persistence is per-browser; hosting cannot set custom HTTP headers, which constrains storage choice ([ADR-0010](adr-0010-sqlite-wasm-as-embedded-store.md)).
- **Neutral:** the operator profile is unaffected and remains the architecture.

## Alternatives rejected

**Option 1** — kept as the local development path for tooling, not as the demonstration. *Would become right if* no public demo were needed.
**Option 2** — *would become right if* a stable free tier with no sleep existed, or if multi-user behaviour became the thing to demonstrate.

## Review trigger

If the repository will not be made public, switch the deployment job to Cloudflare Pages.
