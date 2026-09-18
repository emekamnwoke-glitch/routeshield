import { describe, expect, it } from "vitest";
import { routeStatuses } from "../../frontend/src/routeStatus";
import type { DisruptionView, WorkspaceState } from "../../frontend/src/workspace/service";

const pattern = (routeCode: string) => ({
  patternIndex: 0,
  patternId: `${routeCode}-0-0`,
  routeCode,
  towards: "x",
  trips: 1,
  stopsInside: [],
  approaching: 0,
  inside: 0,
});

function disruption(cut: string[], states: { routeCode: string; state: string }[] = []): DisruptionView {
  return {
    id: "d",
    status: "reported",
    footprint: { lat: 0, lon: 0, radiusM: 1 },
    createdAt: "",
    impact: { blockedRoads: 1, blockedLines: [], affectedTrips: 1, patterns: cut.map(pattern), vehicles: { approaching: 0, inside: 0, past: 0 } },
    recommendation: null,
    decision: null,
    serviceStates: states.map((s) => ({ ...s, towards: "x" })),
    notices: [],
  };
}

const state = (...disruptions: DisruptionView[]) => ({ disruptions }) as unknown as WorkspaceState;

describe("route status card", () => {
  it("is empty when nothing is affected", () => {
    expect(routeStatuses(null)).toEqual([]);
    expect(routeStatuses(state(disruption([])))).toEqual([]);
  });

  it("shows each cut route once, yellow, in bus-number order", () => {
    expect(routeStatuses(state(disruption(["E2", "39A", "E2", "142"])))).toEqual([
      { routeCode: "39A", status: "recommended" },
      { routeCode: "142", status: "recommended" },
      { routeCode: "E2", status: "recommended" },
    ]);
  });

  it("turns a route red once its bypass is approved and in effect", () => {
    const s = state(disruption(["E1", "E2"], [{ routeCode: "E2", state: "diverted" }]));
    expect(routeStatuses(s)).toEqual([
      { routeCode: "E1", status: "recommended" },
      { routeCode: "E2", status: "diverted" },
    ]);
  });

  it("takes the strongest status when disruptions overlap", () => {
    const s = state(disruption(["F1"], [{ routeCode: "F1", state: "held" }]), disruption(["F1"], [{ routeCode: "F1", state: "diverted" }]));
    expect(routeStatuses(s)).toEqual([{ routeCode: "F1", status: "diverted" }]);
  });
});
