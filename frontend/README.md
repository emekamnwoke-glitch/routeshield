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

## What v1.1.0 does

- Draws the real Dublin sample network and highlights any route.
- Places an incident on the map and runs it through every core component.
- Lets a persona approve or reject the recommendation, with authority checked at decision time.
- Shows the audit trail and verifies its hash chain on every change.

It does not yet find affected routes or propose a bypass; the only option is to hold. v1.2.0 adds both: the affected routes and stops, and a suggested bypass drawn on the map and recommended for approval on the Disruptions card. v1.3.0 ranks several bypass options with their costs.
