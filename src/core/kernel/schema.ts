/**
 * The store's schema version. The demonstrator keeps no data worth migrating,
 * so a store written by an older release is cleared and started again rather
 * than altered in place; the core worker does that on SchemaMismatch.
 */
import type { Tx } from "./store";

/** 1: v1.1.0 walking skeleton. 2: v1.2.0 impact, per-pattern options and states. */
export const SCHEMA_VERSION = 2;

export class SchemaMismatch extends Error {
  override readonly name = "SchemaMismatch";
}

/** Throws SchemaMismatch if the store holds tables from a different schema version. */
export function checkSchema(tx: Tx): void {
  const tables = tx.all<{ name: string }>("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'");
  if (tables.length === 0) return;
  const found = tables.some((t) => t.name === "kn_meta")
    ? tx.one<{ value: string }>("select value from kn_meta where key = 'schema'")?.value
    : undefined;
  if (found !== String(SCHEMA_VERSION)) {
    throw new SchemaMismatch(`store has schema ${found ?? "1"}, this release needs ${SCHEMA_VERSION}`);
  }
}

export function writeSchema(tx: Tx): void {
  tx.run("create table if not exists kn_meta (key text primary key, value text not null)");
  tx.run("insert into kn_meta (key, value) values ('schema', ?) on conflict (key) do update set value = excluded.value", [
    String(SCHEMA_VERSION),
  ]);
}
