/**
 * The core worker (ADR-0010): the only place the store is opened. It hosts
 * every core component, persists to OPFS through the opfs-sahpool VFS where
 * the browser allows it, and falls back to memory where it does not. It also
 * loads the published network and the synthetic fleet scene the core reads.
 */
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import graphUrl from "../../../data/fixtures/osm-graph/road_graph.json?url";
import networkUrl from "../../../data/fixtures/network/network.json?url";
import fleetUrl from "../../../data/fixtures/scenario/fleet.json?url";
import { SqliteStore } from "../../../src/adapters/sqlite/sqlite-store";
import type { Core } from "../../../src/core/core";
import { createCore } from "../../../src/core/core";
import type { NetworkFile, RoadGraphFile } from "../../../src/core/kernel/network";
import { Network } from "../../../src/core/kernel/network";
import { SchemaMismatch } from "../../../src/core/kernel/schema";
import type { FleetScene } from "../../../src/core/modules/ac-01-source-gateway/contract";
import type { Request, Response, Storage } from "../workspace/service";
import { FIGMA_INCIDENT, handle, readState } from "../workspace/service";

type Session = { core: Core; store: SqliteStore; storage: Storage; wipe: () => Promise<void>; notice?: string };

type WorkerScope = {
  onmessage: ((event: MessageEvent<{ id: number; req: Request }>) => void) | null;
  postMessage(message: { id: number; res: Response }): void;
};

const scope = globalThis as unknown as WorkerScope;
const DB_FILE = "/routeshield.sqlite3";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not load ${url} (${res.status})`);
  return (await res.json()) as T;
}

// The road graph is the large one (about 1.6 MB compressed); the browser caches it.
const reference = Promise.all([
  fetchJson<RoadGraphFile>(graphUrl),
  fetchJson<NetworkFile>(networkUrl),
  fetchJson<FleetScene>(fleetUrl),
]).then(([graph, network, fleet]) => ({ network: new Network(graph, network), fleet }));

const sqlite = sqlite3InitModule();
// The OPFS pool can be installed once per worker; a reset reuses it.
const pool = sqlite.then((s) => s.installOpfsSAHPoolVfs({ name: "routeshield" })).catch(() => null);

async function open(): Promise<Session> {
  const [sqlite3, opfs, { network, fleet }] = await Promise.all([sqlite, pool, reference]);
  if (!opfs) {
    // Private windows and some browsers refuse OPFS; the demonstrator still runs, in memory.
    const store = new SqliteStore(new sqlite3.oo1.DB(":memory:"));
    return { core: await createCore({ store, network, fleet }), store, storage: "memory", wipe: async () => {} };
  }
  const connect = async (): Promise<Session> => {
    const store = new SqliteStore(new opfs.OpfsSAHPoolDb(DB_FILE));
    try {
      return { core: await createCore({ store, network, fleet }), store, storage: "opfs", wipe: () => opfs.wipeFiles() };
    } catch (err) {
      store.close();
      throw err;
    }
  };
  try {
    return await connect();
  } catch (err) {
    if (!(err instanceof SchemaMismatch)) throw err;
    // A store from an older release: clear it and start again.
    await opfs.wipeFiles();
    return { ...(await connect()), notice: "Data saved by an earlier release was cleared; this release stores more." };
  }
}

let session = open();

/**
 * A failed open is not kept: the next request tries again. Without this, one failed
 * open would fail every later request until the page is reloaded.
 */
function current(): Promise<Session> {
  const attempt = session;
  attempt.catch(() => {
    if (session === attempt) session = open();
  });
  return attempt;
}

/** Requests run one at a time, so a reset cannot close the store under a request in flight. */
let queue: Promise<unknown> = Promise.resolve();
function serialise<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

async function respond(req: Request): Promise<Response> {
  if (req.kind === "reset" || req.kind === "scenario") {
    // If the store never opened there is nothing to close or wipe; the reset still starts it again.
    const old = await current().catch(() => null);
    old?.store.close();
    await old?.wipe();
    session = open();
    const fresh = await session;
    if (req.kind === "scenario") {
      const res = await handle(fresh.core, fresh.storage, { persona: "controller", kind: "report", incident: FIGMA_INCIDENT });
      if (!res.ok) return res;
      return {
        ok: true,
        state: await readState(fresh.core, fresh.storage, req.persona),
        notice: "Loaded the incident in the Figma frames. Propose as the controller, then review as the duty manager.",
      };
    }
    return {
      ok: true,
      state: await readState(fresh.core, fresh.storage, req.persona),
      notice: "Started again with an empty store.",
    };
  }
  const s = await current();
  const res = await handle(s.core, s.storage, req);
  if (s.notice && res.ok) {
    const notice = s.notice;
    delete s.notice;
    return { ...res, notice: res.notice ? `${notice} ${res.notice}` : notice };
  }
  return res;
}

scope.onmessage = (event) => {
  const { id, req } = event.data;
  serialise(() => respond(req))
    .catch((err: unknown): Response => ({ ok: false, error: err instanceof Error ? err.message : String(err) }))
    .then((res) => scope.postMessage({ id, res }));
};
