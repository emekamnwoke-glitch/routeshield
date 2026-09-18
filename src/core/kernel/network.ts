/**
 * DD-1 Network as a read-only, in-memory model (ADR-0010: spatial work in
 * TypeScript against geometry prepared at build time). It is loaded from the
 * committed pipeline outputs and never written, so components share it.
 *
 * Directed edges follow the pipeline: 2e runs edge e from u to v, 2e + 1 from v to u.
 */
import type { Circle } from "./primitives";

const M_PER_DEG = 111_320;
const K_LON = Math.cos((53.35 * Math.PI) / 180);

/** data/fixtures/osm-graph/road_graph.json */
export type RoadGraphFile = {
  format: "routeshield-road-graph/1";
  nodes: { osm_id: number[]; coord: [number, number][] };
  edges: { u: number[]; v: number[]; length_m: number[]; dir: number[]; geom: [number, number][][] };
};

/** data/fixtures/network/network.json */
export type NetworkFile = {
  format: "routeshield-network/1";
  graph_sha256: string;
  routes: { gtfs_route_id: string; public_code: string; name: string }[];
  stops: { gtfs_stop_id: string; code: string; name: string; location: [number, number] }[];
  patterns: {
    id: string;
    route: number;
    direction: number;
    trips: number;
    stops: number[];
    path: number[];
    stop_positions: [number, number, number][];
  }[];
  edge_index: { cell_m: number; cells: Record<string, number[]> };
};

export type Pattern = {
  index: number;
  id: string;
  routeCode: string;
  routeName: string;
  direction: number;
  trips: number;
  /** Stop indexes into Network.stops, in order. */
  stops: number[];
  /** Directed edges. */
  path: number[];
  /** Where each stop sits on the path: path index and metres along that edge. */
  stopPositions: { pathIndex: number; offsetM: number }[];
};

export type Stop = { gtfsStopId: string; code: string; name: string; lat: number; lon: number };

export type Route = { edges: number[]; lengthM: number };

type XY = [number, number];

export function toXY(lat: number, lon: number): XY {
  return [lon * K_LON * M_PER_DEG, lat * M_PER_DEG];
}

function distanceToSegment(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const span = dx * dx + dy * dy;
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / span));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** A binary min-heap of [priority, value] pairs. */
class Heap {
  private readonly items: [number, number][] = [];

  get size(): number {
    return this.items.length;
  }

  push(priority: number, value: number): void {
    const items = this.items;
    items.push([priority, value]);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const p = items[parent];
      const c = items[i];
      if (!p || !c || p[0] <= c[0]) break;
      items[parent] = c;
      items[i] = p;
      i = parent;
    }
  }

  pop(): [number, number] | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length === 0 || !last) return top;
    items[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      const lv = items[l];
      const rv = items[r];
      const mv = items[m];
      if (lv && mv && lv[0] < mv[0]) m = l;
      const mv2 = items[m];
      if (rv && mv2 && rv[0] < mv2[0]) m = r;
      if (m === i) return top;
      const a = items[i];
      const b = items[m];
      if (!a || !b) return top;
      items[i] = b;
      items[m] = a;
      i = m;
    }
  }
}

export class Network {
  readonly version: string;
  readonly patterns: Pattern[];
  readonly stops: Stop[];
  private readonly coord: [number, number][];
  private readonly u: number[];
  private readonly v: number[];
  private readonly lengthM: number[];
  private readonly dir: number[];
  private readonly geom: [number, number][][];
  private readonly cellM: number;
  private readonly cells: Record<string, number[]>;
  private out: { de: number; to: number; w: number }[][] | null = null;

  constructor(graph: RoadGraphFile, network: NetworkFile) {
    if (graph.format !== "routeshield-road-graph/1") throw new Error(`unexpected road graph format ${graph.format}`);
    if (network.format !== "routeshield-network/1") throw new Error(`unexpected network format ${network.format}`);
    this.version = `net-${network.graph_sha256.slice(0, 12)}`;
    this.coord = graph.nodes.coord;
    this.u = graph.edges.u;
    this.v = graph.edges.v;
    this.lengthM = graph.edges.length_m;
    this.dir = graph.edges.dir;
    this.geom = graph.edges.geom;
    this.cellM = network.edge_index.cell_m;
    this.cells = network.edge_index.cells;
    this.stops = network.stops.map((s) => ({
      gtfsStopId: s.gtfs_stop_id,
      code: s.code,
      name: s.name,
      lat: s.location[0],
      lon: s.location[1],
    }));
    this.patterns = network.patterns.map((p, index) => {
      const route = network.routes[p.route];
      return {
        index,
        id: p.id,
        routeCode: route?.public_code ?? "?",
        routeName: route?.name ?? "?",
        direction: p.direction,
        trips: p.trips,
        stops: p.stops,
        path: p.path,
        stopPositions: p.stop_positions.map(([pathIndex, offsetM]) => ({ pathIndex, offsetM })),
      };
    });
  }

  tail(de: number): number {
    return (de & 1 ? this.v[de >> 1] : this.u[de >> 1]) ?? -1;
  }

  head(de: number): number {
    return (de & 1 ? this.u[de >> 1] : this.v[de >> 1]) ?? -1;
  }

  length(edge: number): number {
    return this.lengthM[edge] ?? 0;
  }

  /** Whether OSM lets a bus use this directed edge. */
  allowed(de: number): boolean {
    const d = this.dir[de >> 1] ?? 0;
    return de & 1 ? d <= 0 : d >= 0;
  }

  /** [lat, lon] points of a directed edge, from its tail to its head. */
  line(de: number): [number, number][] {
    const e = de >> 1;
    const a = this.coord[this.u[e] ?? 0];
    const b = this.coord[this.v[e] ?? 0];
    if (!a || !b) return [];
    const pts: [number, number][] = [a, ...(this.geom[e] ?? []), b];
    return de & 1 ? pts.reverse() : pts;
  }

  /** Undirected edges whose geometry comes within the circle. */
  edgesWithin(area: Circle): Set<number> {
    const [x, y] = toXY(area.lat, area.lon);
    const r = area.radiusM;
    const found = new Set<number>();
    const seen = new Set<number>();
    for (let cx = Math.floor((x - r) / this.cellM); cx <= Math.floor((x + r) / this.cellM); cx++) {
      for (let cy = Math.floor((y - r) / this.cellM); cy <= Math.floor((y + r) / this.cellM); cy++) {
        for (const e of this.cells[`${cx},${cy}`] ?? []) {
          if (seen.has(e)) continue;
          seen.add(e);
          const pts = this.line(2 * e).map(([lat, lon]) => toXY(lat, lon));
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1];
            const b = pts[i];
            if (a && b && distanceToSegment([x, y], a, b) <= r) {
              found.add(e);
              break;
            }
          }
        }
      }
    }
    return found;
  }

  private adjacency(): { de: number; to: number; w: number }[][] {
    if (!this.out) {
      const out: { de: number; to: number; w: number }[][] = this.coord.map(() => []);
      for (let e = 0; e < this.u.length; e++) {
        for (const de of [2 * e, 2 * e + 1]) {
          if (this.allowed(de)) out[this.tail(de)]?.push({ de, to: this.head(de), w: this.length(e) });
        }
      }
      this.out = out;
    }
    return this.out;
  }

  private straightLine(a: number, b: number): number {
    const pa = this.coord[a];
    const pb = this.coord[b];
    if (!pa || !pb) return 0;
    const [x1, y1] = toXY(pa[0], pa[1]);
    const [x2, y2] = toXY(pb[0], pb[1]);
    return Math.hypot(x2 - x1, y2 - y1);
  }

  /**
   * A* between two nodes over the edges a bus may use, never touching a
   * blocked edge in either direction. The straight-line heuristic is
   * admissible because no road is shorter than the straight line.
   */
  shortestPath(
    from: number,
    to: number,
    blocked: ReadonlySet<number>,
    maxLengthM = Infinity,
    maxExpansions = 250_000,
  ): Route | null {
    if (from === to) return { edges: [], lengthM: 0 };
    const out = this.adjacency();
    const dist = new Map<number, number>([[from, 0]]);
    const via = new Map<number, number>();
    const heap = new Heap();
    heap.push(this.straightLine(from, to), from);
    let expansions = 0;
    while (heap.size > 0 && expansions < maxExpansions) {
      const next = heap.pop();
      if (!next) break;
      const node = next[1];
      if (node === to) break;
      const d = dist.get(node) ?? Infinity;
      if (next[0] - this.straightLine(node, to) > d + 1e-6) continue;
      expansions++;
      for (const { de, to: m, w } of out[node] ?? []) {
        if (blocked.has(de >> 1)) continue;
        const nd = d + w;
        // No path through m can be shorter than nd plus the straight line to the target.
        if (nd + this.straightLine(m, to) > maxLengthM) continue;
        if (nd < (dist.get(m) ?? Infinity)) {
          dist.set(m, nd);
          via.set(m, de);
          heap.push(nd + this.straightLine(m, to), m);
        }
      }
    }
    const total = dist.get(to);
    if (total === undefined) return null;
    const edges: number[] = [];
    for (let n = to; n !== from; ) {
      const de = via.get(n);
      if (de === undefined) return null;
      edges.push(de);
      n = this.tail(de);
    }
    return { edges: edges.reverse(), lengthM: total };
  }
}
