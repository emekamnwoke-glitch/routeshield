"""Tests for pipeline/network.py and the committed network fixture."""

from __future__ import annotations

import hashlib
import itertools
import json
import math
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))


import network  # noqa: E402
import osm_graph  # noqa: E402

NETWORK_DIR = ROOT / "data" / "fixtures" / "network"


def node(i: int, lat: float, lon: float) -> dict:
    return {"type": "node", "id": i, "lat": lat, "lon": lon}


def way(i: int, nodes: list[int], **tags: str) -> dict:
    return {"type": "way", "id": i, "nodes": nodes, "tags": {"highway": "residential", **tags}}


def graph(*elements: dict) -> network.Graph:
    return network.Graph(osm_graph.build({"elements": list(elements)}))


def shape(*latlons: tuple[float, float]) -> list[tuple[float, float]]:
    return network.resample([network.xy(*p) for p in latlons], network.STEP_M)


def edge_ways(g: network.Graph, path: list[int]) -> list[tuple[int, bool]]:
    """(OSM way id, runs u to v) for each directed edge."""
    ways = g.raw["ways"]["osm_id"]
    return [(ways[g.raw["edges"]["way"][de >> 1]], de % 2 == 0) for de in path]


# A straight east-west street, split at a junction with a side street.
#   1 ------ 2 ------ 3      way 1 (1-2-3)
#            |
#            4               way 2 (2-4)
STREET = (
    node(1, 53.35, -6.30),
    node(2, 53.35, -6.295),
    node(3, 53.35, -6.29),
    node(4, 53.345, -6.295),
    way(1, [1, 2, 3]),
    way(2, [2, 4]),
)


def test_resample_spacing_and_endpoints() -> None:
    line = [(0.0, 0.0), (100.0, 0.0), (100.0, 60.0)]
    pts = network.resample(line, 25.0)
    assert pts[0] == line[0] and pts[-1] == line[-1]
    gaps = [math.dist(a, b) for a, b in itertools.pairwise(pts)]
    assert all(g == pytest.approx(25.0) for g in gaps[:-1])
    assert gaps[-1] <= 25.0


def test_project_returns_distance_and_offset() -> None:
    d, along = network.project((30.0, 5.0), [(0.0, 0.0), (100.0, 0.0)])
    assert (d, along) == (pytest.approx(5.0), pytest.approx(30.0))


def test_matches_a_shape_along_one_street_in_its_direction() -> None:
    g = graph(*STREET)
    west_to_east = shape((53.35003, -6.2995), (53.35003, -6.2905))
    path, where, bridged = network.match(g, west_to_east)
    assert edge_ways(g, path) == [(1, True), (1, True)]
    assert all(w >= 0 for w in where) and bridged == 0

    path, _, _ = network.match(g, west_to_east[::-1])
    assert edge_ways(g, path) == [(1, False), (1, False)]


def test_path_turns_at_the_junction() -> None:
    g = graph(*STREET)
    path, _, _ = network.match(g, shape((53.35003, -6.2995), (53.35003, -6.29503), (53.3455, -6.29503)))
    assert edge_ways(g, path) == [(1, True), (2, True)]
    assert all(g.head(a) == g.tail(b) for a, b in itertools.pairwise(path))


def test_schedule_outranks_a_one_way_tag_but_the_cost_is_recorded() -> None:
    g = graph(node(1, 53.35, -6.30), node(2, 53.35, -6.29), way(1, [1, 2], oneway="yes"))
    path, _, _ = network.match(g, shape((53.35003, -6.2905), (53.35003, -6.2995)))
    assert edge_ways(g, path) == [(1, False)]
    assert g.contra(path[0])


def test_short_excursions_off_the_graph_are_skipped_not_broken() -> None:
    g = graph(*STREET)
    # The shape bows 200 m north of the street, past every search radius, for about 130 m.
    path, where, bridged = network.match(
        g,
        shape(
            (53.35003, -6.2995),
            (53.35003, -6.2972),
            (53.3518, -6.2964),
            (53.3518, -6.2944),
            (53.35003, -6.2936),
            (53.35003, -6.2905),
        ),
    )
    assert edge_ways(g, path) == [(1, True), (1, True)]
    assert bridged == 0
    assert any(w < 0 for w in where)


def test_place_stops_is_ordered_along_the_path() -> None:
    g = graph(*STREET)
    pts = shape((53.35003, -6.2995), (53.35003, -6.2905))
    path, where, _ = network.match(g, pts)
    stops = [network.xy(53.35008, -6.298), network.xy(53.35008, -6.296), network.xy(53.35008, -6.292)]
    placed = network.place_stops(g, path, where, pts, stops)
    assert [p[:2] for p in placed] == sorted(p[:2] for p in placed)
    assert [p[0] for p in placed] == [0, 0, 1]
    assert all(p[2] < 10 for p in placed)


# --- The committed fixture ---------------------------------------------------


@pytest.fixture(scope="module")
def committed() -> tuple[dict, network.Graph]:
    data = (NETWORK_DIR / "network.json").read_bytes()
    manifest = json.loads((NETWORK_DIR / "manifest.json").read_text(encoding="utf-8"))
    assert hashlib.sha256(data).hexdigest() == manifest["files"]["network.json"]["sha256"]
    net = json.loads(data)
    graph_bytes = (ROOT / "data" / "fixtures" / "osm-graph" / "road_graph.json").read_bytes()
    assert net["graph_sha256"] == hashlib.sha256(graph_bytes).hexdigest(), "network is stale: rerun network.py"
    return net, network.Graph(json.loads(graph_bytes))


def test_every_trip_has_a_pattern(committed) -> None:
    net, _ = committed
    assert len(net["trips"]["gtfs_trip_id"]) == 1618
    assert set(net["trips"]["pattern"]) == set(range(len(net["patterns"])))


def test_paths_are_continuous_and_stops_are_in_order(committed) -> None:
    net, g = committed
    for p in net["patterns"]:
        assert all(g.head(a) == g.tail(b) for a, b in itertools.pairwise(p["path"])), p["id"]
        positions = [tuple(s[:2]) for s in p["stop_positions"]]
        assert positions == sorted(positions), p["id"]
        assert len(positions) == len(p["stops"]), p["id"]


def test_match_quality_holds(committed) -> None:
    net, _ = committed
    for p in net["patterns"]:
        q = p["quality"]
        assert q["matched_share"] >= 0.95, p["id"]
        assert q["bridged_m"] == 0, p["id"]
        assert abs(q["path_m"] - q["shape_m"]) < 1200, p["id"]
        # Stops beside Blanchardstown Corporate Park sit on service roads the graph lacks.
        assert q["stop_distance_max_m"] < 150, p["id"]
    assert sum(p["quality"]["contraflow_m"] for p in net["patterns"]) < 500


def test_anchor_route_runs_from_dublin_11_to_ucd(committed) -> None:
    net, _ = committed
    e2 = next(i for i, r in enumerate(net["routes"]) if r["public_code"] == "E2")
    served = set()
    patterns = [p for p in net["patterns"] if p["route"] == e2]
    assert {p["direction"] for p in patterns} == {0, 1}
    for p in patterns:
        names = [net["stops"][s]["name"] for s in p["stops"]]
        served.update(names)
        assert any("UCD" in n or "Belfield" in n for n in names)  # southbound calls at Belfield Court
        assert p["quality"]["matched_share"] == 1.0
    assert {"Belclare Park", "Harristown Depot"} <= served  # Dublin 11


def test_edge_index_finds_the_edges_under_a_stop(committed) -> None:
    net, _ = committed
    index = net["edge_index"]
    cell = index["cell_m"]
    for p in net["patterns"][:5]:
        for s, (k, _, _) in zip(p["stops"], p["stop_positions"], strict=True):
            x, y = network.xy(*net["stops"][s]["location"])
            nearby = set()
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    nearby.update(index["cells"].get(f"{int(x // cell) + a},{int(y // cell) + b}", []))
            assert p["path"][k] >> 1 in nearby
