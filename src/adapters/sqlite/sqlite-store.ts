/**
 * The Store port over the official SQLite WASM build (ADR-0010). Tests run it
 * in memory under Node, so they exercise the same SQL as the browser, where
 * the core worker will open it on OPFS.
 */
import sqlite3InitModule, { type Database } from "@sqlite.org/sqlite-wasm";
import type { Row, SqlValue, Store, Tx } from "../../core/kernel/store";

class SqliteTx implements Tx {
  open = true;

  constructor(private readonly db: Database) {}

  private check(): void {
    if (!this.open) throw new Error("transaction handle used after its transaction ended");
  }

  run(sql: string, params: readonly SqlValue[] = []): void {
    this.check();
    this.db.exec(params.length ? { sql, bind: [...params] } : { sql });
  }

  all<T extends Row = Row>(sql: string, params: readonly SqlValue[] = []): T[] {
    this.check();
    return this.db.selectObjects(sql, params.length ? [...params] : undefined) as T[];
  }

  one<T extends Row = Row>(sql: string, params: readonly SqlValue[] = []): T | undefined {
    this.check();
    return this.db.selectObject(sql, params.length ? [...params] : undefined) as T | undefined;
  }
}

export class SqliteStore implements Store {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: Database) {
    db.exec("pragma foreign_keys = on");
  }

  static async inMemory(): Promise<SqliteStore> {
    const sqlite3 = await sqlite3InitModule();
    return new SqliteStore(new sqlite3.oo1.DB(":memory:"));
  }

  /** Runs work strictly one at a time; a failure does not block what follows. */
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => undefined);
    return next;
  }

  transaction<T>(fn: (tx: Tx) => Promise<T> | T): Promise<T> {
    return this.enqueue(async () => {
      const tx = new SqliteTx(this.db);
      this.db.exec("begin immediate");
      try {
        const result = await fn(tx);
        this.db.exec("commit");
        return result;
      } catch (err) {
        this.db.exec("rollback");
        throw err;
      } finally {
        tx.open = false;
      }
    });
  }

  read<T>(fn: (tx: Tx) => Promise<T> | T): Promise<T> {
    return this.enqueue(async () => {
      const tx = new SqliteTx(this.db);
      try {
        return await fn(tx);
      } finally {
        tx.open = false;
      }
    });
  }

  close(): void {
    this.db.close();
  }
}
