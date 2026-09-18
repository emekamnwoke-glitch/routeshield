/** Loads the committed network once per test file; it is read-only, so tests share it. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FleetScene } from "../../src/core/modules/ac-01-source-gateway/contract";
import type { NetworkFile, RoadGraphFile } from "../../src/core/kernel/network";
import { Network } from "../../src/core/kernel/network";

const fixture = (path: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../data/fixtures/${path}`, import.meta.url)), "utf-8"));

let cached: { network: Network; fleet: FleetScene } | null = null;

export function dublin(): { network: Network; fleet: FleetScene } {
  cached ??= {
    network: new Network(fixture("osm-graph/road_graph.json") as RoadGraphFile, fixture("network/network.json") as NetworkFile),
    fleet: fixture("scenario/fleet.json") as FleetScene,
  };
  return cached;
}
