/**
 * The core worker (ADR-0010): the only place the store is opened. It hosts
 * every core component, persists to OPFS through the opfs-sahpool VFS where
 * the browser allows it, and falls back to memory where it does not.
 */
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { SqliteStore } from "../../../src/adapters/sqlite/sqlite-store";
import { createCore } from "../../../src/core/core";
import type { Core } from "../../../src/core/core";
import type { Request, Response, Storage } from "../workspace/service";
import { handle, readState } from "../workspace/service";

type Session = { core: Core; store: SqliteStore; storage: Storage; wipe: () => Promise<void> };

type WorkerScope = {
  onmessage: ((event: MessageEvent<{ id: number; req: Request }>) => void) | null;
  postMessage(message: { id: number; res: Response }): void;
};

const scope = globalThis as unknown as WorkerScope;
const DB_FILE = "/routeshield.sqlite3";

const sqlite = sqlite3InitModule();
// The OPFS pool can be installed once per worker; a reset reuses it.
const pool = sqlite.then((s) => s.installOpfsSAHPoolVfs({ name: "routeshield" })).catch(() => null);

async function open(): Promise<Session> {
  const sqlite3 = await sqlite;
  const opfs = await pool;
  if (opfs) {
    const store = new SqliteStore(new opfs.OpfsSAHPoolDb(DB_FILE));
    return { core: await createCore({ store }), store, storage: "opfs", wipe: () => opfs.wipeFiles() };
  }
  // Private windows and some browsers refuse OPFS; the demonstrator still runs, in memory.
  const store = new SqliteStore(new sqlite3.oo1.DB(":memory:"));
  return { core: await createCore({ store }), store, storage: "memory", wipe: async () => {} };
}

let session = open();

async function respond(req: Request): Promise<Response> {
  if (req.kind === "reset") {
    const s = await session;
    s.store.close();
    await s.wipe();
    session = open();
    const fresh = await session;
    return { ok: true, state: await readState(fresh.core, fresh.storage), notice: "Started again with an empty store." };
  }
  const s = await session;
  return handle(s.core, s.storage, req);
}

scope.onmessage = (event) => {
  const { id, req } = event.data;
  respond(req)
    .catch((err: unknown): Response => ({ ok: false, error: err instanceof Error ? err.message : String(err) }))
    .then((res) => scope.postMessage({ id, res }));
};
