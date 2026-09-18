"""Place a synthetic fleet on the network at one moment, from the timetable.

    python pipeline/fleet_scene.py

Every trip in the GTFS sample that is running at the scenario time gets a
fictional vehicle, positioned where the published timetable says the trip
would be. Vehicle identifiers are invented, positions are schedule-derived, and
nothing here comes from any real fleet system (fictional operating model;
A-004). The output stands in for the Reference Vehicle GPS Platform until the
moving fleet simulator arrives in v1.4.0.
"""

from __future__ import annotations

import argparse
import bisect
import csv
import hashlib
import itertools
import json
import math
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
GTFS = ROOT / "data" / "fixtures" / "gtfs-sample"
NETWORK = ROOT / "data" / "fixtures" / "network" / "network.json"
GRAPH = ROOT / "data" / "fixtures" / "osm-graph" / "road_graph.json"
OUT = ROOT / "data" / "fixtures" / "scenario" / "fleet.json"

# Monday 21 September 2026, 08:00: the first Monday of service 284 in the sample.
SERVICE_DATE = "2026-09-21"
SCENARIO_TIME = "08:00:00"

JsonDict = dict[str, Any]


def seconds(hms: str) -> int:
    """GTFS times may pass 24:00 for trips that run after midnight."""
    h, m, s = (int(x) for x in hms.split(":"))
    return h * 3600 + m * 60 + s


def point_along(line: list[list[float]], metres: float, length_m: float) -> list[float]:
    """The [lat, lon] at `metres` along a polyline whose true length is length_m."""
    k = math.cos(math.radians(53.35))
    seg = [math.hypot((b[1] - a[1]) * k, b[0] - a[0]) for a, b in itertools.pairwise(line)]
    total = sum(seg) or 1.0
    target = max(0.0, min(metres / length_m if length_m else 0.0, 1.0)) * total
    for (a, b), s in zip(itertools.pairwise(line), seg, strict=True):
        if target <= s or s == seg[-1]:
            t = 0.0 if s == 0 else min(target / s, 1.0)
            return [round(a[0] + t * (b[0] - a[0]), 6), round(a[1] + t * (b[1] - a[1]), 6)]
        target -= s
    return [round(line[-1][0], 6), round(line[-1][1], 6)]


def build(network: JsonDict, graph: JsonDict, stop_times: dict[str, list[tuple[int, int, int]]]) -> JsonDict:
    coord, e = graph["nodes"]["coord"], graph["edges"]
    now = seconds(SCENARIO_TIME)
    trip_pattern = dict(zip(network["trips"]["gtfs_trip_id"], network["trips"]["pattern"], strict=True))

    def edge_line(de: int) -> list[list[float]]:
        i = de >> 1
        line = [coord[e["u"][i]], *e["geom"][i], coord[e["v"][i]]]
        return line if de % 2 == 0 else line[::-1]

    # Distance along each pattern's path at the start of every path edge, and at every stop.
    starts: list[list[float]] = []
    stop_along: list[list[float]] = []
    for p in network["patterns"]:
        acc = [0.0]
        for de in p["path"]:
            acc.append(acc[-1] + e["length_m"][de >> 1])
        starts.append(acc)
        stop_along.append([acc[k] + off for k, off, _ in p["stop_positions"]])

    vehicles = []
    for trip_id in sorted(stop_times):
        times = stop_times[trip_id]
        if not (times[0][1] <= now <= times[-1][0]):
            continue
        n = trip_pattern[trip_id]
        p = network["patterns"][n]
        # The last stop the trip has departed from by now.
        k = max(0, bisect.bisect_right([dep for _, dep, _ in times], now) - 1)
        k = min(k, len(times) - 2)
        dep, arr = times[k][1], times[k + 1][0]
        frac = 0.0 if arr <= dep else min(max((now - dep) / (arr - dep), 0.0), 1.0)
        along = stop_along[n][k] + frac * (stop_along[n][k + 1] - stop_along[n][k])
        idx = max(0, min(bisect.bisect_right(starts[n], along) - 1, len(p["path"]) - 1))
        offset = along - starts[n][idx]
        de = p["path"][idx]
        vehicles.append(
            {
                "trip": trip_id,
                "pattern": n,
                "alongM": round(along, 1),
                "pathIndex": idx,
                "offsetM": round(offset, 1),
                "nextStop": k + 1,
                "location": point_along(edge_line(de), offset, e["length_m"][de >> 1]),
            }
        )
    for i, v in enumerate(vehicles, 1):
        v["vehicle"] = f"RSV-{i:03d}"  # fictional fleet number

    return {
        "format": "routeshield-fleet-scene/1",
        "classification": "SYNTHETIC",
        "note": "Fictional vehicles placed where the published timetable puts each running trip. Not real positions.",
        "serviceDate": SERVICE_DATE,
        "time": SCENARIO_TIME,
        "vehicles": vehicles,
    }


def read_stop_times(trips: set[str]) -> dict[str, list[tuple[int, int, int]]]:
    """(arrival, departure, stop_sequence) per trip, in sequence order."""
    out: dict[str, list[tuple[int, int, int]]] = defaultdict(list)
    with (GTFS / "stop_times.txt").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["trip_id"] in trips:
                out[r["trip_id"]].append(
                    (seconds(r["arrival_time"]), seconds(r["departure_time"]), int(r["stop_sequence"]))
                )
    return {t: sorted(v, key=lambda x: x[2]) for t, v in out.items()}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args(argv)

    network_bytes, graph_bytes = NETWORK.read_bytes(), GRAPH.read_bytes()
    network, graph = json.loads(network_bytes), json.loads(graph_bytes)
    scene = build(network, graph, read_stop_times(set(network["trips"]["gtfs_trip_id"])))
    scene["sources"] = {
        "network_sha256": hashlib.sha256(network_bytes).hexdigest(),
        "graph_sha256": hashlib.sha256(graph_bytes).hexdigest(),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(scene, separators=(",", ":")).encode("utf-8")
    args.out.write_bytes(data)
    print(f"{len(scene['vehicles'])} vehicles at {SERVICE_DATE} {SCENARIO_TIME}, {len(data)} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
