# frontend

The demonstrator site: AC-13 Control Workspace, served as static files from GitHub Pages and running entirely in the visitor's browser ([ADR-0008](../docs/05-architecture-decisions/adr-0008-browser-hosted-static-demonstrator.md)).

**Live:** <https://emekamnwoke-glitch.github.io/routeshield/> (published from `main` by `.github/workflows/pages.yml`)

## How it fits together

```text
page (React)  ──messages──▶  core worker  ──▶  every core component (src/core)
   │                              │
   │ draws                        └──▶  SQLite WASM on OPFS (opfs-sahpool), or memory
   ▼
data/fixtures/site/network.json
```

- **`src/worker/core.worker.ts`:** the only place the store is opened (ADR-0010). It persists to the browser's private file system through the `opfs-sahpool` VFS, which needs no special server headers, so it works on GitHub Pages. Where a browser refuses OPFS (some private windows), it runs in memory and the page says so.
- **`src/workspace/service.ts`:** the Control Workspace's read model and commands. It reaches the core only through component contracts, and runs under Node in the tests.
- **`src/map/`:** draws the network on a canvas from the project's own data, with no map tiles or map library, so the demo depends on no third-party service (ADR-0011).
- **Personas:** switched in the header. Nobody is authenticated; authorisation over the personas is real (ADR-0012).

## Running it

```bash
npm ci
npm run dev
```

Then open <http://localhost:5173/routeshield/>. `npm run build:site` writes the static site to `frontend/dist/`.

## What v1.2.0 does

- Draws the real Dublin sample network, and a synthetic fleet placed from the timetable for Monday 08:00.
- Places an incident on the map, closes the roads inside it, and finds every route pattern, stop and vehicle it affects.
- Suggests one bypass per affected pattern, dashed on the map, with the stops it misses and the extra distance.
- Puts the recommendation on the Disruptions card for a persona to approve or reject, with authority checked at decision time.
- Shows the affected bus numbers on a route status card: yellow while a bypass awaits approval, red once it is in effect.
- Shows the audit trail and verifies its hash chain on every change.

The core worker loads the full road graph (about 1.6 MB compressed) once, for detour search. v1.3.0 ranks several bypass options with their costs.
