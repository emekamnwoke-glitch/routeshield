import { describe, expect, it } from "vitest";
import { SqliteStore } from "../../src/adapters/sqlite/sqlite-store";
import { createCore } from "../../src/core/core";
import { SCHEMA_VERSION, SchemaMismatch } from "../../src/core/kernel/schema";

describe("schema version", () => {
  it("records the version on a fresh store and accepts it again", async () => {
    const store = await SqliteStore.inMemory();
    await createCore({ store });
    expect(await store.read((tx) => tx.one("select value from kn_meta where key = 'schema'"))).toEqual({
      value: String(SCHEMA_VERSION),
    });
    await expect(createCore({ store })).resolves.toBeDefined();
  });

  it("refuses a store written by an older release", async () => {
    const store = await SqliteStore.inMemory();
    // A v1.1.0 store: tables but no kn_meta.
    await store.transaction((tx) => tx.run("create table ds_recommendation (id text primary key, option_id text)"));
    await expect(createCore({ store })).rejects.toThrow(SchemaMismatch);
  });
});
