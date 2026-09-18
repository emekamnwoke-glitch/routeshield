/**
 * AC-13 Control Workspace service: what the site's core worker runs, driven
 * here under Node over in-memory SQLite WASM and the real sample network.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { handle, readState } from "../../frontend/src/workspace/service";
import { SqliteStore } from "../../src/adapters/sqlite/sqlite-store";
import type { Core } from "../../src/core/core";
import { createCore } from "../../src/core/core";
import { ManualClock } from "../../src/core/kernel/primitives";
import { dublin } from "../core/network-fixture";

// Crofton Avenue, Dún Laoghaire: cuts only southbound E2.
const incident = { lat: 53.2957927315715, lon: -6.13820878983198, radiusM: 60, description: "Road closed" };

let core: Core;

beforeEach(async () => {
  core = await createCore({ store: await SqliteStore.inMemory(), clock: new ManualClock(), ...dublin() });
});

async function reportedRecommendation(): Promise<string> {
  const res = await handle(core, "memory", { kind: "report", incident });
  if (!res.ok) throw new Error(res.error);
  const rec = res.state.disruptions[0]?.recommendation;
  if (!rec) throw new Error("no recommendation");
  return rec.id;
}

describe("workspace service", () => {
  it("starts with the access grants, the fleet and a verified chain", async () => {
    const state = await readState(core, "memory");
    expect(state.disruptions).toEqual([]);
    expect(state.network).toEqual({ loaded: true, version: dublin().network.version });
    expect(state.vehicles.length).toBe(dublin().fleet.vehicles.length);
    expect(state.vehicles.every((v) => v.relation === null)).toBe(true);
    expect(state.chain).toMatchObject({ ok: true, events: 4 });
    expect(state.components).toEqual(["AC-14"]);
  });

  it("shows the impact and a bypass awaiting a person", async () => {
    const res = await handle(core, "memory", { kind: "report", incident });
    if (!res.ok) throw new Error(res.error);
    expect(res.notice).toBe("Incident assessed: 1 route pattern affected.");
    const [d] = res.state.disruptions;
    expect(d?.impact?.patterns).toMatchObject([{ routeCode: "E2" }]);
    expect(d?.impact?.blockedLines.length).toBeGreaterThan(0);
    expect(d?.recommendation).toMatchObject({ band: "A1", confidence: "medium" });
    const [item] = d?.recommendation?.items ?? [];
    expect(item).toMatchObject({ routeCode: "E2", kind: "reroute" });
    expect(item?.stopsLost).toHaveLength(1);
    expect(item?.divertStop).toEqual(expect.any(String));
    expect(item?.detour.length).toBeGreaterThan(2);
    expect(d?.decision).toBeNull();
    // Vehicles on the affected pattern are marked on the map.
    expect(res.state.vehicles.some((v) => v.relation === "approaching" || v.relation === "inside")).toBe(true);
  });

  it("records a refusal, then an approval, and reaches every decision-path component", async () => {
    const recommendationId = await reportedRecommendation();
    const refused = await handle(core, "memory", { kind: "decide", persona: "administrator", recommendationId, verdict: "approve" });
    expect(refused).toMatchObject({ ok: true, notice: expect.stringContaining("administrator does not hold decide") });

    const approved = await handle(core, "memory", { kind: "decide", persona: "controller", recommendationId, verdict: "approve" });
    if (!approved.ok) throw new Error(approved.error);
    expect(approved.state.disruptions[0]).toMatchObject({
      decision: { verdict: "approve", decidedBy: "controller" },
      serviceStates: [{ routeCode: "E2", state: "diverted" }],
      notices: [{ routeCode: "E2", channel: "passenger", kind: "diverted" }],
    });
    expect(approved.state.components).toEqual(["AC-02", "AC-04", "AC-05", "AC-06", "AC-07", "AC-08", "AC-09", "AC-14"]);
    expect(approved.state.chain.ok).toBe(true);
  });

  it("says so when no route is affected", async () => {
    const res = await handle(core, "memory", { kind: "report", incident: { lat: 53.3559, lon: -6.3298, radiusM: 50, description: "Phoenix Park" } });
    expect(res).toMatchObject({ ok: true, notice: "Incident assessed: no bus route in the sample runs through it." });
    if (res.ok) expect(res.state.disruptions[0]?.recommendation).toMatchObject({ band: "A0", items: [] });
  });

  it("returns errors as responses rather than throwing", async () => {
    const res = await handle(core, "memory", {
      kind: "decide",
      persona: "controller",
      recommendationId: "rec_missing",
      verdict: "approve",
    });
    expect(res).toMatchObject({ ok: true, notice: expect.stringContaining("not found") });
    expect(await handle(core, "memory", { kind: "reset" })).toMatchObject({ ok: false });
  });
});
