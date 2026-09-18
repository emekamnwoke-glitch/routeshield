/**
 * AC-11 Audit Ledger.
 * TC-102 (AR-002): a change and its audit event commit together or not at all.
 * TC-103 (AR-003): audit events are append-only and hash-chained.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { SqliteStore } from "../../src/adapters/sqlite/sqlite-store";
import { ManualClock } from "../../src/core/kernel/primitives";
import { InMemoryTelemetry } from "../../src/core/kernel/telemetry";
import { GENESIS_HASH } from "../../src/core/modules/ac-11-audit-ledger/contract";
import { AuditLedgerModule } from "../../src/core/modules/ac-11-audit-ledger/module";

const snapshotInput = {
  networkVersion: "gtfs-2026-09-15",
  positions: [{ vehicle: "V1", at: [53.35, -6.26] }],
  assignments: [],
  roadConditions: [],
  sourceHealth: { fleet: "fresh", incidents: "stale" },
};

let store: SqliteStore;
let ledger: AuditLedgerModule;

beforeEach(async () => {
  store = await SqliteStore.inMemory();
  ledger = new AuditLedgerModule(new ManualClock(), new InMemoryTelemetry());
  await store.transaction((tx) => ledger.migrate(tx));
});

async function appendThree(): Promise<void> {
  await store.transaction(async (tx) => {
    for (const n of [1, 2, 3]) {
      await ledger.append(tx, { type: "test.event", component: "AC-02", subject: `s${n}`, payload: { n } });
    }
  });
}

describe("hash chain (TC-103)", () => {
  it("chains each event from the one before, starting at the genesis hash", async () => {
    await appendThree();
    const events = await store.read((tx) => ledger.events(tx));
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(events[0]?.prevHash).toBe(GENESIS_HASH);
    expect(events[1]?.prevHash).toBe(events[0]?.hash);
    expect(events[2]?.prevHash).toBe(events[1]?.hash);
    expect(await store.read((tx) => ledger.verify(tx))).toMatchObject({ ok: true, events: 3 });
  });

  it("refuses updates and deletes", async () => {
    await appendThree();
    await expect(store.transaction((tx) => tx.run("update au_event set payload = '{}' where seq = 2"))).rejects.toThrow(
      /append-only/,
    );
    await expect(store.transaction((tx) => tx.run("delete from au_event where seq = 3"))).rejects.toThrow(
      /append-only/,
    );
    expect(await store.read((tx) => ledger.verify(tx))).toMatchObject({ ok: true });
  });

  it("detects an edited event even when the append-only guard is bypassed", async () => {
    await appendThree();
    await store.transaction((tx) => {
      tx.run("drop trigger au_event_no_update");
      tx.run(`update au_event set payload = '{"n":99}' where seq = 2`);
    });
    const report = await store.read((tx) => ledger.verify(tx));
    expect(report.ok).toBe(false);
    expect(report.problems).toContain("event 2 does not match its hash");
  });

  it("detects a deleted event", async () => {
    await appendThree();
    await store.transaction((tx) => {
      tx.run("drop trigger au_event_no_delete");
      tx.run("delete from au_event where seq = 2");
    });
    const report = await store.read((tx) => ledger.verify(tx));
    expect(report.problems).toContain("event 2 is missing (found seq 3)");
    expect(report.problems).toContain("event 3 does not chain from its predecessor");
  });

  it("detects an altered snapshot", async () => {
    await store.transaction((tx) => ledger.freezeSnapshot(tx, snapshotInput, "AC-04", "dis_1"));
    await store.transaction((tx) => {
      tx.run("drop trigger au_snapshot_no_update");
      tx.run(`update au_snapshot set source_health = '{"fleet":"fresh","incidents":"fresh"}'`);
    });
    const report = await store.read((tx) => ledger.verify(tx));
    expect(report.ok).toBe(false);
    expect(report.problems.some((p) => p.endsWith("does not match its hash"))).toBe(true);
  });
});

describe("snapshots", () => {
  it("stores copies of inputs, including stale ones, and records them in the chain", async () => {
    const snap = await store.transaction((tx) => ledger.freezeSnapshot(tx, snapshotInput, "AC-04", "dis_1"));
    const stored = await store.read((tx) => ledger.snapshot(tx, snap.id));
    expect(stored).toEqual(snap);
    expect(stored?.sourceHealth).toEqual({ fleet: "fresh", incidents: "stale" });
    const [event] = await store.read((tx) => ledger.events(tx, { type: "snapshot.frozen" }));
    expect(event).toMatchObject({ snapshotId: snap.id, payload: { contentHash: snap.contentHash } });
  });
});

describe("atomicity with the change it records (TC-102)", () => {
  beforeEach(async () => {
    await store.transaction((tx) => tx.run("create table dm_thing (id text primary key)"));
  });

  it("commits the change and its audit event together", async () => {
    await store.transaction(async (tx) => {
      tx.run("insert into dm_thing values ('a')");
      await ledger.append(tx, { type: "thing.created", component: "AC-02", subject: "a", payload: {} });
    });
    const counts = await store.read((tx) => [
      tx.one<{ n: number }>("select count(*) as n from dm_thing")?.n,
      ledger.events(tx).length,
    ]);
    expect(counts).toEqual([1, 1]);
  });

  it("keeps neither when the change fails after the audit event is written", async () => {
    await expect(
      store.transaction(async (tx) => {
        await ledger.append(tx, { type: "thing.created", component: "AC-02", subject: "a", payload: {} });
        tx.run("insert into dm_thing values ('a')");
        tx.run("insert into dm_thing values ('a')"); // primary key violation
      }),
    ).rejects.toThrow();
    const counts = await store.read((tx) => [
      tx.one<{ n: number }>("select count(*) as n from dm_thing")?.n,
      ledger.events(tx).length,
    ]);
    expect(counts).toEqual([0, 0]);
  });

  it("keeps neither when the audit event cannot be written", async () => {
    await expect(
      store.transaction(async (tx) => {
        tx.run("insert into dm_thing values ('a')");
        await ledger.append(tx, { type: "thing.created", component: "AC-02", subject: "a", payload: { bad: Number.NaN } });
      }),
    ).rejects.toThrow(/non-finite/);
    expect(await store.read((tx) => tx.one<{ n: number }>("select count(*) as n from dm_thing")?.n)).toBe(0);
  });
});

describe("store", () => {
  it("never interleaves transactions, even across awaits", async () => {
    const order: string[] = [];
    const slow = store.transaction(async () => {
      order.push("slow start");
      await new Promise((r) => setTimeout(r, 20));
      order.push("slow end");
    });
    const fast = store.transaction(() => {
      order.push("fast");
    });
    await Promise.all([slow, fast]);
    expect(order).toEqual(["slow start", "slow end", "fast"]);
  });

  it("rejects a transaction handle used after its transaction ended", async () => {
    const leaked = await store.transaction((tx) => tx);
    expect(() => leaked.all("select 1")).toThrow(/after its transaction ended/);
  });
});
