"""Tests for pipeline/fleet_scene.py and the committed synthetic fleet scene."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))

import fleet_scene  # noqa: E402

COMMITTED = ROOT / "data" / "fixtures" / "scenario" / "fleet.json"


def test_seconds_allows_times_past_midnight() -> None:
    assert fleet_scene.seconds("08:00:00") == 28_800
    assert fleet_scene.seconds("25:10:30") == 90_630


def test_committed_scene_is_current(tmp_path: Path) -> None:
    out = tmp_path / "fleet.json"
    assert fleet_scene.main(["--out", str(out)]) == 0
    assert out.read_bytes() == COMMITTED.read_bytes(), "fleet scene is stale: rerun pipeline/fleet_scene.py"


def test_every_vehicle_sits_on_its_pattern_between_two_stops() -> None:
    scene = json.loads(COMMITTED.read_bytes())
    network = json.loads((ROOT / "data" / "fixtures" / "network" / "network.json").read_bytes())
    lengths = json.loads((ROOT / "data" / "fixtures" / "osm-graph" / "road_graph.json").read_bytes())["edges"][
        "length_m"
    ]
    trip_pattern = dict(zip(network["trips"]["gtfs_trip_id"], network["trips"]["pattern"], strict=True))

    def along(path: list[int], index: int, offset: float) -> float:
        return sum(lengths[de >> 1] for de in path[:index]) + offset

    assert scene["classification"] == "SYNTHETIC"
    assert len(scene["vehicles"]) > 100
    assert len({v["vehicle"] for v in scene["vehicles"]}) == len(scene["vehicles"])
    for v in scene["vehicles"]:
        p = network["patterns"][v["pattern"]]
        assert trip_pattern[v["trip"]] == v["pattern"]
        assert 0 <= v["pathIndex"] < len(p["path"])
        assert 1 <= v["nextStop"] < len(p["stops"])
        # Compare distances along the path: a vehicle at the end of one edge is at the start of the next.
        here = along(p["path"], v["pathIndex"], v["offsetM"])
        assert abs(here - v["alongM"]) < 0.5
        previous, following = p["stop_positions"][v["nextStop"] - 1], p["stop_positions"][v["nextStop"]]
        assert along(p["path"], previous[0], previous[1]) - 0.5 <= here
        assert here <= along(p["path"], following[0], following[1]) + 0.5
