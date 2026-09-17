"""Match the GTFS sample onto the OSM road graph and write the DD-1 network.

    python pipeline/network.py

Reads data/fixtures/gtfs-sample/ and data/fixtures/osm-graph/, and writes
data/fixtures/network/: routes, stops, patterns (each with its path as road
graph edges and its stops placed on that path), the trip-to-pattern mapping,
and a grid index of road edges.

A pattern is one route, direction and exact stop sequence. Shapes are matched
with a hidden Markov model map matcher (Newson and Krumm, 2009). Where a shape
leaves the graph, usually onto a service road the graph does not hold, the
matcher breaks and the pieces are joined by a shortest path; the skipped shape
length is recorded on the pattern.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import heapq
import json
import math
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GTFS_DIR = ROOT / "data" / "fixtures" / "gtfs-sample"
GRAPH_DIR = ROOT / "data" / "fixtures" / "osm-graph"
OUT_DIR = ROOT / "data" / "fixtures" / "network"

M_PER_DEG = 111_320.0
K_LON = math.cos(math.radians(53.35))  # Dublin; local equirectangular projection

STEP_M = 25.0        # shape resampling interval
RADIUS_M = 60.0      # candidate search radius around each shape point
MAX_CANDIDATES = 12  # nearest road edges kept per point
KEEP_RADIUS_M = 120.0  # a road already being followed stays a candidate this far out
SIGMA_M = 20.0       # how far a drawn GTFS shape strays from its road
BETA_M = 10.0        # tolerance for road distance differing from shape distance
UTURN_M = 50.0       # extra cost for turning back onto the same road
MAX_SKIP_M = 400.0   # shape skipped before the matcher gives up and starts a new stretch
# The published schedule outranks OSM one-way tags: a pattern may run against
# one, at a cost, when its shape clearly does (A-008). Detour search does not.
CONTRA_FACTOR = 4.0  # cost per metre against a one-way restriction
CONTRA_STEP = 2.0    # extra emission cost per shape point matched against one
GAP_ALLOWANCE_M = 2_000.0  # extra road distance allowed when joining across an unmatched gap
BRIDGE_M = 20_000.0  # longest shortest-path join across an unmatched stretch
INDEX_CELL_M = 250.0  # spatial index cell size


def xy(lat: float, lon: float) -> tuple[float, float]:
    return lon * K_LON * M_PER_DEG, lat * M_PER_DEG


def project(p: tuple[float, float], line: list[tuple[float, float]]) -> tuple[float, float]:
    """Distance from p to a polyline, and how far along the polyline the closest point is."""
    best, along, run = math.inf, 0.0, 0.0
    for (x1, y1), (x2, y2) in zip(line, line[1:]):
        dx, dy = x2 - x1, y2 - y1
        seg = math.hypot(dx, dy)
        t = 0.0 if seg == 0 else max(0.0, min(1.0, ((p[0] - x1) * dx + (p[1] - y1) * dy) / (seg * seg)))
        d = math.hypot(p[0] - x1 - t * dx, p[1] - y1 - t * dy)
        if d < best:
            best, along = d, run + t * seg
        run += seg
    return best, along


def resample(line: list[tuple[float, float]], step: float) -> list[tuple[float, float]]:
    out = [line[0]]
    carry = 0.0
    for (x1, y1), (x2, y2) in zip(line, line[1:]):
        seg = math.hypot(x2 - x1, y2 - y1)
        pos = step - carry
        while pos <= seg:
            t = pos / seg
            out.append((x1 + t * (x2 - x1), y1 + t * (y2 - y1)))
            pos += step
        carry = (carry + seg) % step
    if out[-1] != line[-1]:
        out.append(line[-1])
    return out


class Graph:
    """The OSM road graph with directed edges: 2e runs u to v, 2e+1 runs v to u.

    Both directions of every edge exist here, so a published pattern can be
    matched where OSM's one-way tags are wrong or incomplete; running against a
    restriction costs CONTRA_FACTOR per metre.
    """

    def __init__(self, raw: dict):
        self.raw = raw
        coord = raw["nodes"]["coord"]
        e = raw["edges"]
        self.length = e["length_m"]
        self.lines: list[list[tuple[float, float]]] = [
            [xy(*coord[u]), *(xy(*p) for p in g), xy(*coord[v])] for u, v, g in zip(e["u"], e["v"], e["geom"])
        ]
        self.line_m = [sum(math.dist(a, b) for a, b in zip(ln, ln[1:])) or 1.0 for ln in self.lines]
        self.ends = list(zip(e["u"], e["v"]))
        self.dir = e["dir"]
        self.out: dict[int, list[tuple[int, int, float]]] = defaultdict(list)
        for i, (u, v) in enumerate(self.ends):
            self.out[u].append((2 * i, v, self.length[i] * self.factor(2 * i)))
            self.out[v].append((2 * i + 1, u, self.length[i] * self.factor(2 * i + 1)))
        self.cells: dict[tuple[int, int], set[int]] = defaultdict(set)
        for i, line in enumerate(self.lines):
            for (x1, y1), (x2, y2) in zip(line, line[1:]):
                for cx in range(int(min(x1, x2) // RADIUS_M), int(max(x1, x2) // RADIUS_M) + 1):
                    for cy in range(int(min(y1, y2) // RADIUS_M), int(max(y1, y2) // RADIUS_M) + 1):
                        self.cells[(cx, cy)].add(i)

    def tail(self, de: int) -> int:
        return self.ends[de >> 1][de & 1]

    def head(self, de: int) -> int:
        return self.ends[de >> 1][1 - (de & 1)]

    def contra(self, de: int) -> bool:
        """True if the directed edge runs against an OSM one-way restriction."""
        d = self.dir[de >> 1]
        return (d == 1 and de & 1 == 1) or (d == -1 and de & 1 == 0)

    def factor(self, de: int) -> float:
        return CONTRA_FACTOR if self.contra(de) else 1.0

    def candidates(self, p: tuple[float, float], keep: set[int] = frozenset()) -> list[tuple[int, float, float]]:
        """Directed edges near p, as (directed edge, offset from its tail, distance).

        Edges in keep stay candidates out to KEEP_RADIUS_M, so a road the shape
        was following is not lost where the drawn shape wanders off it.
        """
        cx, cy = int(p[0] // RADIUS_M), int(p[1] // RADIUS_M)
        near = set().union(*(self.cells.get((cx + a, cy + b), ()) for a in (-1, 0, 1) for b in (-1, 0, 1)))
        scored = []
        for i in near:
            d, along = project(p, self.lines[i])
            if d <= RADIUS_M:
                scored.append((d, i, along))
        scored.sort()
        scored = scored[:MAX_CANDIDATES]
        chosen = {i for _, i, _ in scored}
        for i in keep - chosen:
            d, along = project(p, self.lines[i])
            if d <= KEEP_RADIUS_M:
                scored.append((d, i, along))
        out = []
        for d, i, along in scored:
            off = along / self.line_m[i] * self.length[i]
            out.append((2 * i, off, d))
            out.append((2 * i + 1, self.length[i] - off, d))
        return out

    def dijkstra(self, source: int, limit: float, targets: set[int] | None = None):
        """Shortest distances from a node, up to limit metres; stops early once all targets are settled."""
        dist = {source: 0.0}
        pred: dict[int, int] = {}
        heap = [(0.0, source)]
        remaining = set(targets) if targets else None
        while heap:
            d, n = heapq.heappop(heap)
            if d > dist[n]:
                continue
            if remaining is not None:
                remaining.discard(n)
                if not remaining:
                    break
            for de, m, w in self.out.get(n, ()):
                nd = d + w
                if nd <= limit and nd < dist.get(m, math.inf):
                    dist[m] = nd
                    pred[m] = de
                    heapq.heappush(heap, (nd, m))
        return dist, pred

    def walk(self, pred: dict[int, int], source: int, target: int) -> list[int]:
        path = []
        n = target
        while n != source:
            de = pred[n]
            path.append(de)
            n = self.tail(de)
        return path[::-1]


def match(graph: Graph, points: list[tuple[float, float]]) -> tuple[list[int], list[int], float]:
    """Match resampled shape points to a path of directed edges.

    Returns the path, the path index each point landed on (-1 if unmatched),
    and the shape length that had to be bridged.
    """
    cands: list[list[tuple[int, float, float]]] = []
    for p in points:
        cands.append(graph.candidates(p, {de >> 1 for de, _, _ in cands[-1]} if cands else set()))
    emits = [
        [0.5 * (d / SIGMA_M) ** 2 + (CONTRA_STEP if graph.contra(de) else 0.0) for de, _, d in cs] for cs in cands
    ]
    along = [0.0]
    for a, b in zip(points, points[1:]):
        along.append(along[-1] + math.dist(a, b))

    chains: list[list[tuple[int, int]]] = []  # each: [(point index, candidate index)]
    # (t, b) -> (previous point, previous candidate, edges between them; None if on the same edge)
    back: dict[tuple[int, int], tuple[int, int, list[int] | None]] = {}
    score: dict[int, float] = {}
    last_t = -1

    def finish() -> None:
        if score:
            t, c = last_t, min(score, key=score.get)
            chain = [(t, c)]
            while (t, c) in back:
                t, c, _ = back[(t, c)]
                chain.append((t, c))
            chains.append(chain[::-1])

    def start(t: int) -> dict[int, float]:
        return {j: e for j, e in enumerate(emits[t])}

    def step(t: int, cap: float) -> dict[int, float]:
        """Viterbi scores for point t, from the last matched point, over routes no longer than cap."""
        cs, prev = cands[t], cands[last_t]
        gc = along[t] - along[last_t]
        new: dict[int, float] = {}
        trees: dict[int, tuple[dict, dict]] = {}
        tails = {graph.tail(de) for de, _, _ in cs}
        for a, sa in score.items():
            de_a, off_a, _ = prev[a]
            rest = (graph.length[de_a >> 1] - off_a) * graph.factor(de_a)
            head = graph.head(de_a)
            for b, (de_b, off_b, _) in enumerate(cs):
                if de_b == de_a and off_b >= off_a - 2:
                    route, via = max(0.0, off_b - off_a) * graph.factor(de_a), None
                else:
                    if rest > cap:
                        continue
                    if head not in trees:
                        trees[head] = graph.dijkstra(head, cap, tails)
                    dist, _ = trees[head]
                    tb = graph.tail(de_b)
                    if tb not in dist:
                        continue
                    route = rest + dist[tb] + off_b * graph.factor(de_b)
                    if de_b == de_a ^ 1:
                        route += UTURN_M
                    via = (head, tb)
                if route > cap:
                    continue
                total = sa + abs(route - gc) / BETA_M + emits[t][b]
                if total < new.get(b, math.inf):
                    new[b] = total
                    back[(t, b)] = (last_t, a, graph.walk(trees[head][1], *via) if via else None)
        return new

    bridged = 0.0
    for t, cs in enumerate(cands):
        if not score:
            score, last_t = start(t), t
            continue
        if not cs:
            continue
        gc = along[t] - along[last_t]
        new = step(t, gc + max(3 * gc, 150.0))
        if not new and gc > MAX_SKIP_M:
            # Too much shape has gone unmatched: join across the gap by the best-scoring route.
            new = step(t, 4 * gc + GAP_ALLOWANCE_M)
            if new:
                bridged += gc
        if new:
            score, last_t = new, t
        elif gc > MAX_SKIP_M:
            finish()
            score, last_t = start(t), t
    finish()

    if not chains:
        raise ValueError("shape does not come near the road graph")

    path: list[int] = []
    where = [-1] * len(points)
    last: tuple[int, int] | None = None
    for chain in chains:
        t0, c0 = chain[0]
        de0 = cands[t0][c0][0]
        if last is not None:
            lt, lc = last
            head = graph.head(cands[lt][lc][0])
            dist, pred = graph.dijkstra(head, BRIDGE_M, {graph.tail(de0)})
            if graph.tail(de0) not in dist:
                raise ValueError(f"cannot join the path across shape points {lt}-{t0}")
            path.extend(graph.walk(pred, head, graph.tail(de0)))
            bridged += along[t0] - along[lt]
        path.append(de0)
        where[t0] = len(path) - 1
        for t, c in chain[1:]:
            via = back[(t, c)][2]
            if via is not None:
                path.extend(via)
                path.append(cands[t][c][0])
            where[t] = len(path) - 1
        last = chain[-1]
    return path, where, bridged


def place_stops(
    graph: Graph, path: list[int], where: list[int], points: list[tuple[float, float]], stops: list[tuple[float, float]]
) -> list[tuple[int, float, float]]:
    """Put each stop, in order, at its nearest position on the path: (path index, offset, distance)."""
    placed = []
    t_prev, pos_prev = 0, (0, 0.0)
    matched = [t for t, w in enumerate(where) if w >= 0]
    for s in stops:
        # Nearest shape point at or after the previous stop; take the first close approach, so loops are not skipped.
        best_t, best_d = t_prev, math.inf
        for t in range(t_prev, len(points)):
            d = math.dist(s, points[t])
            if d < best_d:
                best_t, best_d = t, d
            elif best_d < 60 and d > best_d + 60:
                break
        t_prev = best_t
        lo = max((w for t, w in ((t, where[t]) for t in matched) if t <= best_t - 2), default=0)
        hi = min((w for t, w in ((t, where[t]) for t in matched) if t >= best_t + 2), default=len(path) - 1)
        lo, hi = max(lo, pos_prev[0]), max(hi, pos_prev[0])
        best = (math.inf, pos_prev[0], pos_prev[1])
        for k in range(lo, hi + 1):
            de = path[k]
            line = graph.lines[de >> 1] if de % 2 == 0 else graph.lines[de >> 1][::-1]
            d, along = project(s, line)
            off = along / graph.line_m[de >> 1] * graph.length[de >> 1]
            if (k, off) < pos_prev:
                continue
            if d < best[0]:
                best = (d, k, off)
        d, k, off = best
        if math.isinf(d):  # nothing at or after the previous stop; keep the previous position
            de = path[k]
            d = project(s, graph.lines[de >> 1])[0]
        pos_prev = (k, off)
        placed.append((k, round(off, 1), round(d, 1)))
    return placed


def edge_index(graph: Graph) -> dict:
    cells: dict[str, set[int]] = defaultdict(set)
    for i, line in enumerate(graph.lines):
        for (x1, y1), (x2, y2) in zip(line, line[1:]):
            for cx in range(int(min(x1, x2) // INDEX_CELL_M), int(max(x1, x2) // INDEX_CELL_M) + 1):
                for cy in range(int(min(y1, y2) // INDEX_CELL_M), int(max(y1, y2) // INDEX_CELL_M) + 1):
                    cells[f"{cx},{cy}"].add(i)
    return {
        "projection": {"k_lon": K_LON, "m_per_deg": M_PER_DEG, "x": "lon * k_lon * m_per_deg", "y": "lat * m_per_deg"},
        "cell_m": INDEX_CELL_M,
        "cells": {k: sorted(v) for k, v in sorted(cells.items())},
    }


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def build(gtfs: Path, graph_dir: Path, log=print) -> dict:
    graph = Graph(json.loads((graph_dir / "road_graph.json").read_bytes()))
    routes = read_csv(gtfs / "routes.txt")
    stops = read_csv(gtfs / "stops.txt")
    trips = {t["trip_id"]: t for t in read_csv(gtfs / "trips.txt")}
    seq: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for r in read_csv(gtfs / "stop_times.txt"):
        seq[r["trip_id"]].append((int(r["stop_sequence"]), r["stop_id"]))
    shapes: dict[str, list[tuple[int, float, float]]] = defaultdict(list)
    for r in read_csv(gtfs / "shapes.txt"):
        shapes[r["shape_id"]].append((int(r["shape_pt_sequence"]), float(r["shape_pt_lat"]), float(r["shape_pt_lon"])))

    stop_index = {s["stop_id"]: i for i, s in enumerate(stops)}
    route_index = {r["route_id"]: i for i, r in enumerate(routes)}
    groups: dict[tuple[str, str, tuple[str, ...]], list[str]] = defaultdict(list)
    for trip_id, s in seq.items():
        t = trips[trip_id]
        groups[(t["route_id"], t["direction_id"], tuple(x for _, x in sorted(s)))].append(trip_id)

    patterns = []
    trip_pattern: dict[str, int] = {}
    order = sorted(groups, key=lambda k: (routes[route_index[k[0]]]["route_short_name"], k[1], -len(groups[k])))
    for n, key in enumerate(order):
        route_id, direction, stop_ids = key
        trip_ids = sorted(groups[key])
        shape_id = Counter(trips[t]["shape_id"] for t in trip_ids).most_common(1)[0][0]
        line = [xy(lat, lon) for _, lat, lon in sorted(shapes[shape_id])]
        points = resample(line, STEP_M)
        path, where, bridged = match(graph, points)
        stop_xy = [xy(float(stops[stop_index[s]]["stop_lat"]), float(stops[stop_index[s]]["stop_lon"])) for s in stop_ids]
        placed = place_stops(graph, path, where, points, stop_xy)
        matched = [t for t, w in enumerate(where) if w >= 0]
        contra = [de for de in path if graph.contra(de)]
        code = routes[route_index[route_id]]["route_short_name"]
        pattern_id = f"{code}-{direction}-{n}"
        patterns.append({
            "id": pattern_id,
            "route": route_index[route_id],
            "direction": int(direction),
            "gtfs_shape_id": shape_id,
            "trips": len(trip_ids),
            "stops": [stop_index[s] for s in stop_ids],
            "path": path,
            "stop_positions": [list(p) for p in placed],
            "quality": {
                "shape_m": round(sum(math.dist(a, b) for a, b in zip(line, line[1:])), 1),
                "path_m": round(sum(graph.length[de >> 1] for de in path), 1),
                "matched_share": round(len(matched) / len(points), 4),
                "bridged_m": round(bridged, 1),
                "stop_distance_max_m": max(p[2] for p in placed),
                # Where the schedule runs against an OSM one-way tag: evidence for A-008.
                "contraflow_m": round(sum(graph.length[de >> 1] for de in contra), 1),
                "contraflow_osm_ways": sorted(
                    {graph.raw["ways"]["osm_id"][graph.raw["edges"]["way"][de >> 1]] for de in contra}
                ),
            },
        })
        for t in trip_ids:
            trip_pattern[t] = n
        q = patterns[-1]["quality"]
        log(f"  {pattern_id:14} {len(stop_ids):3} stops  shape {q['shape_m'] / 1000:5.1f} km  path {q['path_m'] / 1000:5.1f} km"
            f"  matched {q['matched_share']:.1%}  bridged {q['bridged_m']:.0f} m  worst stop {q['stop_distance_max_m']:.0f} m"
            f"  contraflow {q['contraflow_m']:.0f} m")

    return {
        "format": "routeshield-network/1",
        "graph_sha256": hashlib.sha256((graph_dir / "road_graph.json").read_bytes()).hexdigest(),
        "routes": [
            {"gtfs_route_id": r["route_id"], "public_code": r["route_short_name"], "name": r["route_long_name"]}
            for r in routes
        ],
        "stops": [
            {"gtfs_stop_id": s["stop_id"], "code": s["stop_code"], "name": s["stop_name"],
             "location": [float(s["stop_lat"]), float(s["stop_lon"])]}
            for s in stops
        ],
        "patterns": patterns,
        "trips": {"gtfs_trip_id": sorted(trip_pattern), "pattern": [trip_pattern[t] for t in sorted(trip_pattern)]},
        "edge_index": edge_index(graph),
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--gtfs", type=Path, default=GTFS_DIR)
    ap.add_argument("--graph", type=Path, default=GRAPH_DIR)
    ap.add_argument("--out", type=Path, default=OUT_DIR)
    args = ap.parse_args(argv)

    network = build(args.gtfs, args.graph)
    args.out.mkdir(parents=True, exist_ok=True)
    data = json.dumps(network, separators=(",", ":")).encode("utf-8")
    (args.out / "network.json").write_bytes(data)
    manifest = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "inputs": {
            str(p.relative_to(ROOT)).replace("\\", "/") if p.is_relative_to(ROOT) else p.name:
                hashlib.sha256(p.read_bytes()).hexdigest()
            for p in (args.gtfs / "manifest.json", args.graph / "manifest.json")
        },
        "parameters": {
            "step_m": STEP_M, "radius_m": RADIUS_M, "max_candidates": MAX_CANDIDATES,
            "sigma_m": SIGMA_M, "beta_m": BETA_M, "uturn_m": UTURN_M, "index_cell_m": INDEX_CELL_M,
        },
        "licence": [
            "Contains National Transport Authority data, licensed under CC BY 4.0.",
            "Contains data © OpenStreetMap contributors, available under the Open Database Licence.",
        ],
        "files": {
            "network.json": {
                "routes": len(network["routes"]),
                "stops": len(network["stops"]),
                "patterns": len(network["patterns"]),
                "trips": len(network["trips"]["gtfs_trip_id"]),
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        },
    }
    (args.out / "manifest.json").write_bytes((json.dumps(manifest, indent=2) + "\n").encode("utf-8"))
    print(f"{len(network['patterns'])} patterns, {len(data)} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
