"""Tests for pipeline/osm_graph.py."""
from __future__ import annotations

import csv
import hashlib
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))

import osm_graph  # noqa: E402


def node(i: int, lat: float, lon: float) -> dict:
    return {"type": "node", "id": i, "lat": lat, "lon": lon}


def way(i: int, nodes: list[int], **tags: str) -> dict:
    return {"type": "way", "id": i, "nodes": nodes, "tags": {"highway": "residential", **tags}}


# A crossroads at node 2, a one-way street, a private road, and a detached fragment.
#
#   1 --- 2 --- 3        (way 10, two-way, passes through 2)
#         |
#         4 --- 5        (way 11: 2-4 one-way; way 12: 4-5 private)
#   8 --- 9              (way 13, not connected)
RAW = {
    "elements": [
        node(1, 53.30, -6.30), node(2, 53.30, -6.29), node(3, 53.30, -6.28),
        node(4, 53.29, -6.29), node(5, 53.29, -6.28),
        node(8, 53.20, -6.40), node(9, 53.20, -6.39),
        way(10, [1, 2, 3], name="Main Street"),
        way(11, [2, 4], oneway="yes", maxheight="4.2"),
        way(12, [4, 5], access="private"),
        way(13, [8, 9]),
    ]
}


def edges(graph: dict) -> list[tuple[int, int, int, int]]:
    ids = graph["nodes"]["osm_id"]
    e = graph["edges"]
    ways = graph["ways"]["osm_id"]
    return sorted((ids[u], ids[v], ways[w], d) for u, v, w, d in zip(e["u"], e["v"], e["way"], e["dir"]))


def tags_of(graph: dict, way_id: int) -> dict[str, str]:
    i = graph["ways"]["osm_id"].index(way_id)
    return graph["tag_sets"][graph["ways"]["tags"][i]]


def test_splits_ways_at_junctions_and_drops_closed_and_detached_roads() -> None:
    assert edges(osm_graph.build(RAW)) == [(1, 2, 10, 0), (2, 3, 10, 0), (2, 4, 11, 1)]


def test_keeps_bus_relevant_tags_only() -> None:
    graph = osm_graph.build(RAW)
    assert tags_of(graph, 11) == {"highway": "residential", "oneway": "yes", "maxheight": "4.2"}
    assert graph["feasibility"] == "verified_open"


def test_roads_in_bus_route_relations_are_kept_even_if_closed() -> None:
    raw = {
        "bus_route_ways": [2],
        "elements": [
            node(1, 53.3, -6.3), node(2, 53.3, -6.29), node(3, 53.3, -6.28),
            way(1, [1, 2]),
            {"type": "way", "id": 2, "nodes": [2, 3], "tags": {"highway": "service", "access": "private"}},
        ],
    }
    assert edges(osm_graph.build(raw)) == [(1, 2, 1, 0), (2, 3, 2, 0)]
    del raw["bus_route_ways"]
    assert edges(osm_graph.build(raw)) == [(1, 2, 1, 0)]


def test_identical_tag_sets_are_stored_once() -> None:
    raw = {
        "elements": [
            node(1, 53.3, -6.3), node(2, 53.3, -6.29), node(3, 53.3, -6.28),
            way(1, [1, 2], name="Main Street"), way(2, [2, 3], name="Main Street"),
        ]
    }
    graph = osm_graph.build(raw)
    assert graph["tag_sets"] == [{"highway": "residential", "name": "Main Street"}]
    assert graph["ways"]["tags"] == [0, 0]


def test_edge_length_uses_full_shape_and_geometry_keeps_real_bends() -> None:
    # Way 1 is a 100 m dogleg through node 2, which is kept. Way 2 is straight
    # apart from node 5, 0.1 m off the line, which is dropped but still measured.
    raw = {
        "elements": [
            node(1, 53.3, -6.3), node(2, 53.3009, -6.299), node(3, 53.3, -6.298),
            node(4, 53.3, -6.297), node(5, 53.300001, -6.296), node(6, 53.3, -6.295),
            way(1, [1, 2, 3]), way(2, [3, 4, 5, 6]),
        ]
    }
    graph = osm_graph.build(raw)
    geom = dict(zip(graph["edges"]["way"], graph["edges"]["geom"]))
    lengths = dict(zip(graph["edges"]["way"], graph["edges"]["length_m"]))
    assert geom == {0: [[53.3009, -6.299]], 1: []}
    assert lengths[0] == pytest.approx(2 * osm_graph.haversine_m(53.3, -6.3, 53.3009, -6.299), abs=0.1)
    full = sum(
        osm_graph.haversine_m(*a, *b)
        for a, b in [((53.3, -6.298), (53.3, -6.297)), ((53.3, -6.297), (53.300001, -6.296)), ((53.300001, -6.296), (53.3, -6.295))]
    )
    assert lengths[1] == round(full, 1)


def test_simplify_keeps_endpoints_and_drops_near_straight_points() -> None:
    line = [(53.3, -6.3), (53.30000001, -6.299), (53.3, -6.298)]
    assert osm_graph.simplify(line, 2.0) == [line[0], line[-1]]
    bent = [(53.3, -6.3), (53.301, -6.299), (53.3, -6.298)]
    assert osm_graph.simplify(bent, 2.0) == bent


def test_closed_way_becomes_a_loop_edge() -> None:
    raw = {
        "elements": [
            node(1, 53.3, -6.3), node(2, 53.3, -6.29), node(3, 53.31, -6.29),
            way(1, [1, 2, 3, 1], junction="roundabout"),
        ]
    }
    assert edges(osm_graph.build(raw)) == [(1, 1, 1, 1)]


@pytest.mark.parametrize(
    ("tags", "allowed"),
    [
        ({}, True),
        ({"access": "private"}, False),
        ({"access": "no", "bus": "yes"}, True),
        ({"motor_vehicle": "no", "psv": "designated"}, True),
        ({"bus": "no"}, False),
    ],
)
def test_bus_allowed(tags: dict[str, str], allowed: bool) -> None:
    assert osm_graph.bus_allowed(tags) is allowed


@pytest.mark.parametrize(
    ("tags", "expected"),
    [
        ({"highway": "residential"}, 0),
        ({"oneway": "yes"}, 1),
        ({"oneway": "-1"}, -1),
        ({"junction": "roundabout"}, 1),
        ({"highway": "motorway"}, 1),
        ({"highway": "motorway", "oneway": "no"}, 0),
        ({"oneway": "yes", "oneway:bus": "no"}, 0),
        ({"oneway": "yes", "busway:right": "opposite_lane"}, 0),
        ({"oneway": "yes", "lanes:psv:backward": "1"}, 0),
        ({"oneway": "yes", "lanes:psv:backward": "0"}, 1),
        ({"oneway": "yes", "bus:lanes:backward": "none|designated"}, 0),
        ({"oneway": "yes", "psv:lanes": "yes|designated"}, 1),
    ],
)
def test_direction(tags: dict[str, str], expected: int) -> None:
    assert osm_graph.direction(tags) == expected


def test_tiles_cover_the_box() -> None:
    t = osm_graph.tiles((53.0, -6.5, 53.4, -6.1), 2)
    assert t == [(53.0, -6.5, 53.2, -6.3), (53.0, -6.3, 53.2, -6.1), (53.2, -6.5, 53.4, -6.3), (53.2, -6.3, 53.4, -6.1)]


def test_committed_graph_matches_manifest_and_reaches_sample_stops() -> None:
    graph_dir = ROOT / "data" / "fixtures" / "osm-graph"
    data = (graph_dir / "road_graph.json").read_bytes()
    manifest = json.loads((graph_dir / "manifest.json").read_text(encoding="utf-8"))
    assert hashlib.sha256(data).hexdigest() == manifest["files"]["road_graph.json"]["sha256"]

    graph = json.loads(data)
    coord, e = graph["nodes"]["coord"], graph["edges"]
    k, cell = math.cos(math.radians(53.35)), 0.002
    grid: dict[tuple[int, int], list] = defaultdict(list)
    for u, v, geom in zip(e["u"], e["v"], e["geom"]):
        pts = [coord[u], *geom, coord[v]]
        for a, b in zip(pts, pts[1:]):
            for lat, lon in (a, b, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)):
                grid[(int(lat // cell), int(lon // cell))].append((a, b))

    def to_segment(p: tuple[float, float], a: list[float], b: list[float]) -> float:
        x, x1, x2 = p[1] * k, a[1] * k, b[1] * k
        dx, dy = x2 - x1, b[0] - a[0]
        span = dx * dx + dy * dy
        t = 0.0 if span == 0 else max(0.0, min(1.0, ((x - x1) * dx + (p[0] - a[0]) * dy) / span))
        return math.hypot(x - x1 - t * dx, p[0] - a[0] - t * dy) * 111_320

    distances = []
    with (ROOT / "data" / "fixtures" / "gtfs-sample" / "stops.txt").open(encoding="utf-8") as f:
        for stop in csv.DictReader(f):
            p = (float(stop["stop_lat"]), float(stop["stop_lon"]))
            i, j = int(p[0] // cell), int(p[1] // cell)
            near = [s for a in range(-2, 3) for b in range(-2, 3) for s in grid[(i + a, j + b)]]
            distances.append(min((to_segment(p, *s) for s in near), default=math.inf))
    distances.sort()

    # Stops in Blanchardstown Corporate Park sit further out: their service roads
    # are not in OSM's bus route relations, so they are not in the graph.
    assert distances[int(len(distances) * 0.95)] < 25
    assert distances[-1] < 250


def test_main_writes_graph_and_manifest_from_saved_response(tmp_path: Path) -> None:
    raw = tmp_path / "roads.json"
    raw.write_text(json.dumps(RAW), encoding="utf-8")
    out = tmp_path / "out"
    assert osm_graph.main(["--raw", str(raw), "--out", str(out)]) == 0

    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["licence"]["name"] == "ODbL 1.0"
    assert manifest["files"]["road_graph.json"]["edges"] == 3
    assert json.loads((out / "road_graph.json").read_text(encoding="utf-8"))["format"] == "routeshield-road-graph/1"
