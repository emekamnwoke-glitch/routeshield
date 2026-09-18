/**
 * v1.2.0: impact assessment (AC-04) and the first bypass (AC-05, ADR-0014),
 * on a hand-built grid where the answer is obvious and on the real network.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { SqliteStore } from "../../src/adapters/sqlite/sqlite-store";
import type { Core } from "../../src/core/core";
import { createCore } from "../../src/core/core";
import type { NetworkFile, RoadGraphFile } from "../../src/core/kernel/network";
import { Network, toXY } from "../../src/core/kernel/network";
import { ManualClock } from "../../src/core/kernel/primitives";
import { cutPatterns, relate } from "../../src/core/modules/ac-04-impact-assessor/module";
import { findBypass } from "../../src/core/modules/ac-05-route-optimiser/module";
import { DecisionRefused } from "../../src/core/modules/ac-07-decision-manager/contract";
import { dublin } from "./network-fixture";

/**
 * A 3 x 2 grid, 100 m spacing, with the bus pattern along the bottom row:
 *
 *   3 ---- 4 ---- 5        top row, two-way
 *   |      |      |
 *   0 ---- 1 ---- 2        bottom row: pattern 0 -> 1 -> 2, stops on edges 0 and 1
 *
 * Edges: 0 (0-1), 1 (1-2), 2 (3-4), 3 (4-5), 4 (0-3), 5 (1-4), 6 (2-5)
 */
const LAT = 53.35;
const LON = -6.26;
const DLAT = 100 / 111_320;
const DLON = 100 / (111_320 * Math.cos((53.35 * Math.PI) / 180));

function grid(dirs: number[] = [0, 0, 0, 0, 0, 0, 0]): Network {
  const coord: [number, number][] = [
    [LAT, LON],
    [LAT, LON + DLON],
    [LAT, LON + 2 * DLON],
    [LAT + DLAT, LON],
    [LAT + DLAT, LON + DLON],
    [LAT + DLAT, LON + 2 * DLON],
  ];
  const ends = [
    [0, 1],
    [1, 2],
    [3, 4],
    [4, 5],
    [0, 3],
    [1, 4],
    [2, 5],
  ];
  const graph: RoadGraphFile = {
    format: "routeshield-road-graph/1",
    nodes: { osm_id: coord.map((_, i) => i), coord },
    edges: {
      u: ends.map((e) => e[0] ?? 0),
      v: ends.map((e) => e[1] ?? 0),
      length_m: ends.map(() => 100),
      dir: dirs,
      geom: ends.map(() => []),
    },
  };
  const cells: Record<string, number[]> = {};
  coord.forEach(([lat, lon]) => {
    const [x, y] = toXY(lat, lon);
    const key = `${Math.floor(x / 250)},${Math.floor(y / 250)}`;
    cells[key] = [0, 1, 2, 3, 4, 5, 6];
  });
  const network: NetworkFile = {
    format: "routeshield-network/1",
    graph_sha256: "0".repeat(64),
    routes: [{ gtfs_route_id: "r", public_code: "T1", name: "Test" }],
    stops: [
      { gtfs_stop_id: "a", code: "1", name: "West", location: [LAT, LON + 0.5 * DLON] },
      { gtfs_stop_id: "b", code: "2", name: "East", location: [LAT, LON + 1.5 * DLON] },
    ],
    patterns: [
      {
        id: "T1-0-0",
        route: 0,
        direction: 0,
        trips: 4,
        stops: [0, 1],
        path: [0, 2], // edge 0 forwards, edge 1 forwards
        stop_positions: [
          [0, 50, 0],
          [1, 50, 0],
        ],
      },
    ],
    edge_index: { cell_m: 250, cells },
  };
  return new Network(graph, network);
}

describe("network model on a grid", () => {
  it("finds the shortest path and never uses a blocked edge", () => {
    const net = grid();
    expect(net.shortestPath(0, 2, new Set())).toEqual({ edges: [0, 2], lengthM: 200 });
    // With edge 1 (1-2) closed, the only way from 1 to 2 is up, across and down.
    expect(net.shortestPath(1, 2, new Set([1]))).toEqual({ edges: [10, 6, 13], lengthM: 300 });
  });

  it("respects one-way rules", () => {
    // Make the top row one-way from right to left (dir -1 on edges 2 and 3).
    const net = grid([0, 0, -1, -1, 0, 0, 0]);
    expect(net.shortestPath(1, 2, new Set([1]))).toBeNull();
    expect(net.allowed(2 * 2)).toBe(false);
    expect(net.allowed(2 * 2 + 1)).toBe(true);
  });

  it("finds the edges a footprint covers", () => {
    const net = grid();
    const covered = net.edgesWithin({ lat: LAT, lon: LON + 1.5 * DLON, radiusM: 20 });
    expect([...covered]).toEqual([1]);
  });

  it("cuts the pattern and bypasses the closure", () => {
    const net = grid();
    const blocked = new Set([1]);
    const [cut] = cutPatterns(net, blocked);
    expect(cut).toMatchObject({ patternIndex: 0, blockedFrom: 1, blockedTo: 1, stopsInside: [1], divertStop: 0, rejoinStop: null });
    // The last stop is on the closed edge, so there is nowhere to rejoin: hold only.
    expect(cut && findBypass(net, cut, blocked)).toBeNull();
  });

  it("relates vehicles to the closure", () => {
    const net = grid();
    const cuts = cutPatterns(net, new Set([1]));
    const at = (vehicle: string, pathIndex: number) => ({ vehicle, trip: "t", pattern: 0, pathIndex, offsetM: 0, lat: 0, lon: 0, observedAt: "" });
    expect(relate(cuts, [at("V1", 0), at("V2", 1)])).toEqual([
      { vehicle: "V1", patternIndex: 0, relation: "approaching" },
      { vehicle: "V2", patternIndex: 0, relation: "inside" },
    ]);
  });
});

describe("the first bypass on the real network", () => {
  const { network } = dublin();

  function bypassAt(lat: number, lon: number, radiusM: number) {
    const blocked = network.edgesWithin({ lat, lon, radiusM });
    return cutPatterns(network, blocked).map((cut) => ({ cut, blocked, bypass: findBypass(network, cut, blocked) }));
  }

  it("diverts southbound E2 around a closure at Crofton Avenue", () => {
    const [only, ...rest] = bypassAt(53.2957927315715, -6.13820878983198, 60);
    expect(rest).toEqual([]);
    expect(only?.cut.patternId).toMatch(/^E2-0/);
    const b = only?.bypass;
    if (!only || !b) throw new Error("no bypass");
    const pattern = network.patterns[only.cut.patternIndex];
    if (!pattern) throw new Error("no pattern");

    expect(b.stopsLost.length).toBe(1);
    expect(b.extraM).toBeGreaterThan(0);
    // Continuous, legal, clear of the closure, and joining the pattern at both ends.
    expect(b.detour.every((de) => network.allowed(de) && !only.blocked.has(de >> 1))).toBe(true);
    expect(b.detour.slice(1).every((de, i) => network.tail(de) === network.head(b.detour[i] ?? -1))).toBe(true);
    const leave = pattern.path[pattern.stopPositions[b.divertStop]?.pathIndex ?? -1] ?? -1;
    const rejoin = pattern.path[pattern.stopPositions[b.rejoinStop]?.pathIndex ?? -1] ?? -1;
    expect(network.tail(b.detour[0] ?? -1)).toBe(network.head(leave));
    expect(network.head(b.detour.at(-1) ?? -1)).toBe(network.tail(rejoin));
  });

  it("leaves a one-way dual carriageway earlier when it must (N11 at the Radisson)", () => {
    const results = bypassAt(53.3033395733521, -6.20780413886588, 80);
    expect(results.length).toBeGreaterThan(0);
    for (const { cut, bypass } of results) {
      expect(bypass, cut.patternId).not.toBeNull();
      // Diverting at the nearest stop is impossible here, so an earlier or later stop is used.
      expect(bypass && (bypass.divertStop < (cut.divertStop ?? 0) || bypass.rejoinStop > (cut.rejoinStop ?? 0))).toBe(true);
    }
  });
});

describe("recommendation and decision", () => {
  let core: Core;

  beforeEach(async () => {
    core = await createCore({ store: await SqliteStore.inMemory(), clock: new ManualClock(), ...dublin() });
  });

  async function report(lat: number, lon: number, radiusM: number) {
    await core.sources.reportIncident({ source: "fictional-incident-feed", externalRef: `x-${lat}`, area: { lat, lon, radiusM }, description: "test" });
    await core.bus.dispatch();
    return core.store.read((tx) => {
      const [d] = core.disruptions.list(tx);
      const rec = d && core.support.forDisruption(tx, d.id);
      const assessment = rec && core.impact.assessment(tx, rec.assessmentId);
      const options = rec ? core.optimiser.options(tx, rec.assessmentId) : [];
      return { rec, assessment, options };
    });
  }

  it("recommends the bypass for a person to approve (band A1)", async () => {
    const { rec, assessment, options } = await report(53.2957927315715, -6.13820878983198, 60);
    expect(rec).toMatchObject({ band: "A1", confidence: "medium" });
    expect(assessment?.patterns).toHaveLength(1);
    expect(assessment?.vehicles.length).toBeGreaterThan(0);
    expect(options.map((o) => o.kind).sort()).toEqual(["hold", "reroute"]);
    const chosen = options.find((o) => o.id === rec?.items[0]?.optionId);
    expect(chosen?.kind).toBe("reroute");
  });

  it("has nothing to decide where no bus route runs (band A0)", async () => {
    // Phoenix Park, away from every route in the sample.
    const { rec, assessment } = await report(53.3559, -6.3298, 50);
    expect(assessment?.patterns).toEqual([]);
    expect(rec).toMatchObject({ band: "A0", items: [] });
    await expect(core.decisions.decide({ kind: "persona", id: "controller" }, rec?.id ?? "", "approve", "")).rejects.toThrow(
      DecisionRefused,
    );
  });

  it("records in the snapshot the network version it assessed against", async () => {
    const { assessment } = await report(53.2957927315715, -6.13820878983198, 60);
    expect(assessment?.networkVersion).toBe(dublin().network.version);
  });
});
