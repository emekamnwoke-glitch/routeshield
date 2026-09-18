/**
 * One disruption through every core component, over the real sample network.
 * TC-101 (AR-001): assessment reads a snapshot persisted before it starts.
 * TC-102 (AR-002): every state change commits with its audit event.
 * TC-106 (AR-006): authority is verified at decision time.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { PersonaSwitcher } from "../../src/adapters/identity/persona-switcher";
import { SqliteStore } from "../../src/adapters/sqlite/sqlite-store";
import type { Core } from "../../src/core/core";
import { createCore } from "../../src/core/core";
import { MAX_ATTEMPTS } from "../../src/core/kernel/events";
import { ManualClock } from "../../src/core/kernel/primitives";
import { InMemoryTelemetry } from "../../src/core/kernel/telemetry";
import { DecisionRefused } from "../../src/core/modules/ac-07-decision-manager/contract";
import { AuthorityError } from "../../src/core/modules/ac-14-access-control/contract";
import { dublin } from "./network-fixture";

// Crofton Avenue, Dún Laoghaire: a 60 m closure there cuts only southbound E2.
const incident = {
  source: "fictional-incident-feed",
  externalRef: "CAD-0001",
  area: { lat: 53.2957927315715, lon: -6.13820878983198, radiusM: 60 },
  description: "Road closed, Crofton Avenue",
};

let core: Core;
let clock: ManualClock;
let telemetry: InMemoryTelemetry;
const identity = new PersonaSwitcher();

beforeEach(async () => {
  clock = new ManualClock();
  telemetry = new InMemoryTelemetry();
  core = await createCore({ store: await SqliteStore.inMemory(), clock, telemetry, ...dublin() });
  identity.switchTo("controller");
});

/** Reports the incident and lets the core react; returns the recommendation it produced. */
async function reportAndRecommend() {
  await core.sources.reportIncident(incident);
  await core.bus.dispatch();
  const rec = await core.store.read((tx) =>
    tx.one<{ id: string; disruption_id: string }>("select id, disruption_id from ds_recommendation"),
  );
  if (!rec) throw new Error("no recommendation was issued");
  return { recommendationId: rec.id, disruptionId: rec.disruption_id };
}

describe("walking skeleton", () => {
  it("carries one disruption from incident to passenger notice", async () => {
    const { recommendationId, disruptionId } = await reportAndRecommend();
    clock.advance(30);
    const decision = await core.decisions.decide(identity.current(), recommendationId, "approve", "take the bypass");
    await core.bus.dispatch();
    await core.analytics.refresh();

    const state = await core.store.read((tx) => ({
      service: core.serviceState.current(tx, disruptionId),
      notices: core.communications.notices(tx, disruptionId),
      trail: core.ledger.events(tx, { subject: disruptionId }).map((e) => `${e.component} ${e.type}`),
      counts: core.analytics.eventCounts(tx),
    }));

    expect(decision).toMatchObject({ verdict: "approve", decidedBy: { kind: "persona", id: "controller" } });
    expect(state.service).toMatchObject([{ state: "diverted", decisionId: decision.id }]);
    expect(state.notices).toMatchObject([{ channel: "passenger", kind: "diverted" }]);
    expect(state.trail).toEqual([
      "AC-02 disruption.declared",
      "AC-04 snapshot.frozen",
      "AC-04 impact.assessed",
      "AC-05 options.generated",
      "AC-06 recommendation.issued",
      "AC-07 decision.made",
      "AC-08 service_state.changed",
      "AC-09 notice.issued",
    ]);
    expect(state.counts).toContainEqual({ type: "notice.issued", component: "AC-09", count: 1 });
    expect(await core.store.read((tx) => core.ledger.verify(tx))).toMatchObject({ ok: true, problems: [] });
  });

  it("gives every component its own tables, and only those (TC-105)", async () => {
    const tables = await core.store.read((tx) =>
      tx.all<{ name: string }>("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'"),
    );
    const prefixes = new Set(core.modules.map((m) => m.tablePrefix));
    expect(prefixes.size).toBe(core.modules.length);
    for (const m of core.modules) {
      expect(tables.some((t) => t.name.startsWith(m.tablePrefix)), m.id).toBe(true);
    }
    for (const { name } of tables) {
      expect(name.startsWith("kn_") || [...prefixes].some((p) => name.startsWith(p)), name).toBe(true);
    }
  });

  it("assesses only against a snapshot frozen before the assessment (TC-101)", async () => {
    const { disruptionId } = await reportAndRecommend();
    const events = await core.store.read((tx) => core.ledger.events(tx, { subject: disruptionId }));
    const frozen = events.find((e) => e.type === "snapshot.frozen");
    const assessed = events.find((e) => e.type === "impact.assessed");
    if (!frozen?.snapshotId || !assessed) throw new Error("snapshot or assessment was not recorded");
    const snapshotId = frozen.snapshotId;
    expect(assessed.snapshotId).toBe(snapshotId);
    expect(frozen.seq).toBeLessThan(assessed.seq);
    const snapshot = await core.store.read((tx) => core.ledger.snapshot(tx, snapshotId));
    expect(snapshot?.sourceHealth).toEqual([
      { source: "fictional-incident-feed", lastSeenAt: "2026-09-21T08:00:00.000Z", status: "fresh" },
      { source: "fictional-vehicle-gps", lastSeenAt: "2026-09-21T08:00:00.000Z", status: "fresh" },
    ]);
    // Copies of the positions of every vehicle on the affected pattern, and nothing else.
    const positions = snapshot?.positions as { vehicle: string; pattern: number }[];
    expect(positions.length).toBeGreaterThan(0);
    expect(new Set(positions.map((p) => p.pattern)).size).toBe(1);
  });

  it("replays the outbox without repeating any work", async () => {
    await reportAndRecommend();
    const before = await core.store.read((tx) => core.ledger.events(tx).length);
    expect(await core.bus.dispatch()).toBe(0);
    expect(await core.store.read((tx) => core.ledger.events(tx).length)).toBe(before);
  });
});

describe("authority at decision time (TC-106)", () => {
  it("refuses a persona without authority, and records the refusal", async () => {
    const { recommendationId, disruptionId } = await reportAndRecommend();
    identity.switchTo("administrator");
    await expect(core.decisions.decide(identity.current(), recommendationId, "approve", "")).rejects.toThrow(
      DecisionRefused,
    );
    const types = await core.store.read((tx) => core.ledger.events(tx, { subject: disruptionId }).map((e) => e.type));
    expect(types).toContain("decision.refused");
    expect(types).not.toContain("decision.made");
  });

  it("refuses a controller whose authority was revoked after the recommendation was issued", async () => {
    const { recommendationId } = await reportAndRecommend();
    await core.store.transaction((tx) =>
      core.access.revoke(tx, { kind: "persona", id: "administrator" }, "controller", "decide"),
    );
    await expect(core.decisions.decide(identity.current(), recommendationId, "approve", "")).rejects.toThrow(
      /does not hold decide/,
    );
  });

  it("never lets a system actor decide", async () => {
    const { recommendationId } = await reportAndRecommend();
    await expect(
      core.decisions.decide({ kind: "system", id: "AC-06" }, recommendationId, "approve", ""),
    ).rejects.toThrow(/system actor cannot decide/);
  });

  it("only lets a persona holding grant authority change grants", async () => {
    await expect(
      core.store.transaction((tx) => core.access.grant(tx, identity.current(), "controller", "grant_authority")),
    ).rejects.toThrow(AuthorityError);
  });

  it("decides a recommendation once", async () => {
    const { recommendationId } = await reportAndRecommend();
    await core.decisions.decide(identity.current(), recommendationId, "reject", "not needed");
    await expect(core.decisions.decide(identity.current(), recommendationId, "approve", "")).rejects.toThrow(
      /already been decided/,
    );
  });
});

describe("failing subscribers", () => {
  it("dead-letters a subscriber that keeps failing, and records it in the audit chain", async () => {
    let calls = 0;
    core.bus.subscribe("source.incident_reported", "AC-99", () => {
      calls++;
      throw new Error("handler exploded");
    });
    await reportAndRecommend();
    expect(calls).toBe(MAX_ATTEMPTS);
    const dead = await core.store.read((tx) => core.ledger.events(tx, { type: "event.dead_lettered" }));
    expect(dead).toMatchObject([{ component: "AC-99", payload: { error: "handler exploded" } }]);
    expect(telemetry.counters.get('event.dead_lettered{"event.type":"source.incident_reported","subscriber":"AC-99"}')).toBe(1);
  });

  it("rolls back a subscriber's partial work when it fails", async () => {
    core.bus.subscribe("source.incident_reported", "AC-98", async (tx) => {
      await core.ledger.append(tx, { type: "partial.work", component: "AC-98", subject: "x", payload: {} });
      throw new Error("failed after writing");
    });
    await reportAndRecommend();
    const partial = await core.store.read((tx) => core.ledger.events(tx, { type: "partial.work" }));
    expect(partial).toEqual([]);
  });
});
