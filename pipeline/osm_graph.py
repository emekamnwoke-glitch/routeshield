"""Build a drivable Dublin road graph from OpenStreetMap.

    python pipeline/osm_graph.py                   # download, then build
    python pipeline/osm_graph.py --raw ROADS.json  # build from a saved Overpass response

Roads are fetched once from the Overpass API into data/raw/ (git-ignored). The
committed output in data/fixtures/osm-graph/ is an intersection-level graph:
ways are split wherever they meet another way, and only the tags that bear on
whether a bus can use a road are kept (A-008). Every edge is feasibility
`verified_open`, never `verified_operator` (ADR-0011).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_JSON = ROOT / "data" / "raw" / "osm_dublin_roads.json"
OUT_DIR = ROOT / "data" / "fixtures" / "osm-graph"

ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
USER_AGENT = "routeshield-pipeline (https://github.com/emekamnwoke-glitch/routeshield)"

# Covers every shape in data/fixtures/gtfs-sample (south, west, north, east).
DEFAULT_BBOX = (53.18, -6.45, 53.48, -6.10)
HIGHWAYS = "^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|busway)(_link)?$"

# Tags kept on each way: road class, and what OSM says about bus access and limits.
KEEP_TAGS = (
    "highway", "name", "ref", "oneway", "junction", "maxspeed", "maxheight", "maxweight",
    "access", "motor_vehicle", "bus", "psv", "oneway:bus", "oneway:psv", "busway", "lanes",
    "busway:left", "busway:right", "busway:both", "lanes:bus:backward", "lanes:psv:backward",
    "bus:lanes:backward", "psv:lanes:backward",
)
CONTRAFLOW_BUSWAY = "opposite_lane"
NO_ACCESS = {"no", "private"}
YES_ACCESS = {"yes", "designated", "permissive"}
COORD_DP = 6
# Edge shapes are simplified to within this distance; lengths use the full shape.
SIMPLIFY_M = 2.0

LICENCE = {
    "name": "ODbL 1.0",
    "url": "https://opendatacommons.org/licenses/odbl/1-0/",
    "attribution": "Contains data © OpenStreetMap contributors, available under the Open Database Licence.",
}


def query(bbox: tuple[float, float, float, float]) -> str:
    s, w, n, e = bbox
    return f'[out:json][timeout:300];way["highway"~"{HIGHWAYS}"]({s},{w},{n},{e});out body;>;out skel qt;'


def bus_route_query(bbox: tuple[float, float, float, float]) -> str:
    """Service roads that OSM bus route relations use: hospital, airport and campus roads.

    All other service roads (car parks, driveways) stay out of the graph.
    """
    s, w, n, e = bbox
    return (
        f'[out:json][timeout:300];rel["route"="bus"]({s},{w},{n},{e})->.r;'
        f'way(r.r)["highway"="service"]({s},{w},{n},{e});out body;>;out skel qt;'
    )


def tiles(bbox: tuple[float, float, float, float], n: int) -> list[tuple[float, float, float, float]]:
    s, w, north, e = bbox
    dy, dx = (north - s) / n, (e - w) / n
    return [
        (round(s + i * dy, 5), round(w + j * dx, 5), round(s + (i + 1) * dy, 5), round(w + (j + 1) * dx, 5))
        for i in range(n) for j in range(n)
    ]


def fetch(q: str, rounds: int = 4, wait_s: int = 60) -> tuple[str, bytes]:
    """Try each Overpass endpoint in turn, backing off between rounds.

    Public servers rate-limit (429) and time out (504) under load; both pass.
    """
    body = urllib.parse.urlencode({"data": q}).encode()
    errors = []
    for attempt in range(rounds):
        if attempt:
            print(f"    all endpoints busy; retrying in {wait_s * attempt}s")
            time.sleep(wait_s * attempt)
        for url in ENDPOINTS:
            req = urllib.request.Request(url, body, headers={"User-Agent": USER_AGENT})
            try:
                with urllib.request.urlopen(req, timeout=600) as resp:
                    data = resp.read()
                json.loads(data)
                return url, data
            except (OSError, ValueError) as exc:
                errors.append(f"{url}: {exc}")
    raise SystemExit("all Overpass endpoints failed:\n  " + "\n  ".join(errors[-len(ENDPOINTS):]))


def download(bbox: tuple[float, float, float, float], n: int, dest: Path) -> None:
    """Fetch the box as n x n tiles, one at a time, and save the merged response.

    A single query for all of Dublin times out on public Overpass servers. Each
    tile is cached beside dest, so a failed run resumes where it stopped.
    """
    cache = dest.parent / f"{dest.stem}_tiles"
    cache.mkdir(parents=True, exist_ok=True)
    elements: dict[tuple[str, int], dict] = {}
    used, osm_base = [], None
    for k, tile in enumerate(tiles(bbox, n), 1):
        path = cache / ("_".join(f"{c:g}" for c in tile) + ".json")
        if path.exists():
            print(f"  tile {k}/{n * n} {tile} (cached)")
        else:
            print(f"  tile {k}/{n * n} {tile}")
            url, data = fetch(query(tile))
            path.write_bytes(json.dumps({"endpoint": url, **json.loads(data)}, separators=(",", ":")).encode("utf-8"))
            time.sleep(5)
        resp = json.loads(path.read_bytes())
        used.append(resp.get("endpoint", "unknown"))
        osm_base = osm_base or resp.get("osm3s", {}).get("timestamp_osm_base")
        for el in resp["elements"]:
            elements[(el["type"], el["id"])] = el
    path = cache / "bus_route_service_roads.json"
    if path.exists():
        print("  bus route service roads (cached)")
    else:
        print("  bus route service roads")
        url, data = fetch(bus_route_query(bbox))
        path.write_bytes(json.dumps({"endpoint": url, **json.loads(data)}, separators=(",", ":")).encode("utf-8"))
    resp = json.loads(path.read_bytes())
    used.append(resp.get("endpoint", "unknown"))
    bus_route_ways = sorted(el["id"] for el in resp["elements"] if el["type"] == "way")
    for el in resp["elements"]:
        elements[(el["type"], el["id"])] = el
    merged = {
        "osm3s": {"timestamp_osm_base": osm_base},
        "endpoints": sorted(set(used)),
        "bus_route_ways": bus_route_ways,
        "elements": list(elements.values()),
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(json.dumps(merged, separators=(",", ":")).encode("utf-8"))


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 12_742_000 * math.asin(math.sqrt(a))


def simplify(points: list[tuple[float, float]], tol_m: float) -> list[tuple[float, float]]:
    """Douglas-Peucker on (lat, lon) points, using a local equirectangular projection."""
    if len(points) < 3:
        return points
    (lat1, lon1), (lat2, lon2) = points[0], points[-1]
    k = math.cos(math.radians(lat1))
    x1, x2 = lon1 * k, lon2 * k
    dx, dy = x2 - x1, lat2 - lat1
    span = dx * dx + dy * dy
    worst, worst_i = -1.0, 0
    for i, (lat, lon) in enumerate(points[1:-1], 1):
        x = lon * k
        t = 0.0 if span == 0 else max(0.0, min(1.0, ((x - x1) * dx + (lat - lat1) * dy) / span))
        dist = math.hypot(x - (x1 + t * dx), lat - (lat1 + t * dy)) * 111_320
        if dist > worst:
            worst, worst_i = dist, i
    if worst <= tol_m:
        return [points[0], points[-1]]
    return simplify(points[: worst_i + 1], tol_m)[:-1] + simplify(points[worst_i:], tol_m)


def bus_allowed(tags: dict[str, str]) -> bool:
    """False only where OSM closes the road and does not reopen it to buses."""
    if tags.get("bus") in YES_ACCESS or tags.get("psv") in YES_ACCESS:
        return True
    if tags.get("bus") in NO_ACCESS or tags.get("psv") in NO_ACCESS:
        return False
    return tags.get("access") not in NO_ACCESS and tags.get("motor_vehicle") not in NO_ACCESS


def direction(tags: dict[str, str]) -> int:
    """1 = forward only, -1 = reverse only, 0 = both ways, for a bus."""
    if tags.get("oneway:bus") == "no" or tags.get("oneway:psv") == "no":
        return 0
    # A contraflow bus lane on a one-way street.
    if CONTRAFLOW_BUSWAY in {tags.get(k) for k in ("busway", "busway:left", "busway:right", "busway:both")}:
        return 0
    for k in ("lanes:bus:backward", "lanes:psv:backward"):
        if tags.get(k, "0").isdigit() and int(tags.get(k, "0")) > 0:
            return 0
    for k in ("bus:lanes:backward", "psv:lanes:backward"):
        if "designated" in tags.get(k, "").split("|"):
            return 0
    oneway = tags.get("oneway")
    if oneway == "-1":
        return -1
    if oneway in {"yes", "true", "1"}:
        return 1
    if oneway == "no":
        return 0
    if tags.get("junction") in {"roundabout", "circular"} or tags.get("highway") in {"motorway", "motorway_link"}:
        return 1
    return 0


def build(raw: dict) -> dict:
    coords = {el["id"]: (el["lat"], el["lon"]) for el in raw["elements"] if el["type"] == "node"}
    # A road in an OSM bus route relation is one buses use, whatever its access tags say.
    bus_route = set(raw.get("bus_route_ways", []))
    ways = [
        el for el in raw["elements"]
        if el["type"] == "way"
        and (el["id"] in bus_route or bus_allowed(el.get("tags", {})))
        and all(n in coords for n in el["nodes"])
    ]
    uses = Counter(n for w in ways for n in set(w["nodes"]))
    ends = {n for w in ways for n in (w["nodes"][0], w["nodes"][-1])}
    junction = {n for n, c in uses.items() if c > 1} | ends

    edges = []  # (u, v, way index, length, dir, intermediate node ids)
    way_rows = []
    for w in ways:
        tags = w.get("tags", {})
        wi = len(way_rows)
        way_rows.append({"id": w["id"], "tags": {k: tags[k] for k in KEEP_TAGS if k in tags}})
        d = direction(tags)
        seg = [w["nodes"][0]]
        for n in w["nodes"][1:]:
            seg.append(n)
            # A way that loops back through a node it already passed is split there too.
            if n in junction or n == seg[0]:
                length = sum(haversine_m(*coords[a], *coords[b]) for a, b in zip(seg, seg[1:]))
                if seg[0] != seg[-1] or len(seg) > 2:
                    edges.append((seg[0], seg[-1], wi, length, d, seg[1:-1]))
                seg = [n]

    # Keep the largest weakly connected component; fragments cut by the box edge are useless for routing.
    adj = defaultdict(set)
    for u, v, *_ in edges:
        adj[u].add(v)
        adj[v].add(u)
    seen: set[int] = set()
    largest: set[int] = set()
    for start in adj:
        if start in seen:
            continue
        comp, stack = {start}, [start]
        while stack:
            for m in adj[stack.pop()]:
                if m not in comp:
                    comp.add(m)
                    stack.append(m)
        seen |= comp
        if len(comp) > len(largest):
            largest = comp
    edges = [e for e in edges if e[0] in largest]

    node_ids = sorted({n for e in edges for n in e[:2]})
    index = {n: i for i, n in enumerate(node_ids)}
    used_ways = sorted({e[2] for e in edges})
    way_index = {w: i for i, w in enumerate(used_ways)}

    def rounded(p: tuple[float, float]) -> list[float]:
        return [round(p[0], COORD_DP), round(p[1], COORD_DP)]

    def shape(e: tuple) -> list[list[float]]:
        full = [coords[e[0]], *(coords[n] for n in e[5]), coords[e[1]]]
        return [rounded(p) for p in simplify(full, SIMPLIFY_M)[1:-1]]

    # Many ways share identical tags (a street split into pieces), so each tag set is stored once.
    tag_sets: dict[str, int] = {}
    way_tags = [
        tag_sets.setdefault(json.dumps(way_rows[w]["tags"], sort_keys=True), len(tag_sets)) for w in used_ways
    ]

    return {
        "format": "routeshield-road-graph/1",
        "feasibility": "verified_open",
        "nodes": {"osm_id": node_ids, "coord": [rounded(coords[n]) for n in node_ids]},
        "ways": {"osm_id": [way_rows[w]["id"] for w in used_ways], "tags": way_tags},
        "tag_sets": [json.loads(t) for t in tag_sets],
        "edges": {
            "u": [index[e[0]] for e in edges],
            "v": [index[e[1]] for e in edges],
            "way": [way_index[e[2]] for e in edges],
            "length_m": [round(e[3], 1) for e in edges],
            "dir": [e[4] for e in edges],
            "geom": [shape(e) for e in edges],
        },
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", type=Path, help="use this saved Overpass response instead of downloading")
    ap.add_argument("--bbox", type=float, nargs=4, metavar=("S", "W", "N", "E"), default=DEFAULT_BBOX)
    ap.add_argument("--tiles", type=int, default=4, help="split the box into N x N tiles for download")
    ap.add_argument("--out", type=Path, default=OUT_DIR)
    args = ap.parse_args(argv)
    bbox = tuple(args.bbox)

    if args.raw:
        src = args.raw
    else:
        print("downloading roads from Overpass")
        src = RAW_JSON
        download(bbox, args.tiles, RAW_JSON)

    raw_bytes = src.read_bytes()
    raw = json.loads(raw_bytes)
    graph = build(raw)

    args.out.mkdir(parents=True, exist_ok=True)
    data = json.dumps(graph, separators=(",", ":")).encode("utf-8")
    (args.out / "road_graph.json").write_bytes(data)

    manifest = {
        "source": {
            "publisher": "OpenStreetMap contributors",
            "endpoints": raw.get("endpoints", []),
            "query": query(bbox),
            "tiles": args.tiles,
            "bus_route_query": bus_route_query(bbox),
            "bus_route_ways": len(raw.get("bus_route_ways", [])),
            "file": src.name,
            "sha256": hashlib.sha256(raw_bytes).hexdigest(),
            "osm_base": raw.get("osm3s", {}).get("timestamp_osm_base"),
        },
        "licence": LICENCE,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "bbox": {"south": bbox[0], "west": bbox[1], "north": bbox[2], "east": bbox[3]},
        "files": {
            "road_graph.json": {
                "nodes": len(graph["nodes"]["osm_id"]),
                "edges": len(graph["edges"]["u"]),
                "ways": len(graph["ways"]["osm_id"]),
                "tag_sets": len(graph["tag_sets"]),
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        },
    }
    (args.out / "manifest.json").write_bytes((json.dumps(manifest, indent=2) + "\n").encode("utf-8"))
    stats = manifest["files"]["road_graph.json"]
    print(f"{stats['nodes']} nodes, {stats['edges']} edges, {stats['ways']} ways, {stats['bytes']} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
