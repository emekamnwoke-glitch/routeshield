/**
 * AC-13 Control Workspace service: what the site's core worker runs, driven
 * here under Node over in-memory SQLite WASM.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { handle, readState } from "../../frontend/src/workspace/service";
import { SqliteStore } from "../../src/adapters/sqlite/sqlite-store";
import type { Core } from "../../src/core/core";
import { createCore } from "../../src/core/core";
import { ManualClock } from "../../src/core/kernel/primitives";

const incident = { lat: 53.3498, lon: -6.2603, radiusM: 150, description: "Road closed" };

let core: Core;

beforeEach(async () => {
  core = await createCore({ store: await SqliteStore.inMemory(), clock: new ManualClock() });
});

async function reportedRecommendation(): Promise<string> {
  const res = await handle(core, "memory", { kind: "report", incident });
  if (!res.ok) throw new Error(res.error);
  const rec = res.state.disruptions[0]?.recommendation;
  if (!rec) throw new Error("no recommendation");
  return rec.id;
}

describe("workspace service", () => {
  it("starts with the access grants and a verified chain", async () => {
    const state = await readState(core, "memory");
    expect(state.disruptions).toEqual([]);
    expect(state.chain).toMatchObject({ ok: true, events: 4 });
    expect(state.components).toEqual(["AC-14"]);
  });

  it("reports an incident through to a recommendation awaiting a person", async () => {
    const res = await handle(core, "memory", { kind: "report", incident });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.disruptions).toMatchObject([
      {
        status: "reported",
        footprint: { lat: 53.3498, lon: -6.2603, radiusM: 150 },
        recommendation: { band: "A1", optionKind: "hold", confidence: "low" },
        decision: null,
        serviceState: null,
        notices: [],
      },
    ]);
    expect(res.state.trail[0]).toMatchObject({ component: "AC-06", type: "recommendation.issued" });
  });

  it("records a refusal, then an approval, and reaches every decision-path component", async () => {
    const recommendationId = await reportedRecommendation();
    const refused = await handle(core, "memory", { kind: "decide", persona: "administrator", recommendationId, verdict: "approve" });
    expect(refused).toMatchObject({ ok: true, notice: expect.stringContaining("administrator does not hold decide") });

    const approved = await handle(core, "memory", { kind: "decide", persona: "controller", recommendationId, verdict: "approve" });
    if (!approved.ok) throw new Error(approved.error);
    expect(approved.state.disruptions[0]).toMatchObject({
      decision: { verdict: "approve", decidedBy: "controller" },
      serviceState: "held",
      notices: [{ channel: "passenger", kind: "not_served" }],
    });
    expect(approved.state.components).toEqual(["AC-02", "AC-04", "AC-05", "AC-06", "AC-07", "AC-08", "AC-09", "AC-14"]);
    expect(approved.state.chain.ok).toBe(true);
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
