"""Cut the network down to what the demonstrator site draws.

    python pipeline/site_bundle.py

Reads data/fixtures/network/ and data/fixtures/osm-graph/ and writes
data/fixtures/site/network.json: the routes, the stops the patterns call at,
and only the road edges the patterns run along, re-indexed. The full road
graph stays out of the page until detour search needs it.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
NETWORK = ROOT / "data" / "fixtures" / "network" / "network.json"
GRAPH = ROOT / "data" / "fixtures" / "osm-graph" / "road_graph.json"
OUT = ROOT / "data" / "fixtures" / "site" / "network.json"

COORD_DP = 5  # about 1 m, enough to draw

ATTRIBUTION = [
    "Contains National Transport Authority data, licensed under CC BY 4.0.",
    "Contains data © OpenStreetMap contributors, available under the Open Database Licence.",
]

JsonDict = dict[str, Any]


def build(network: JsonDict, graph: JsonDict, network_sha: str, graph_sha: str) -> JsonDict:
    coord = graph["nodes"]["coord"]
    e = graph["edges"]

    used = sorted({de >> 1 for p in network["patterns"] for de in p["path"]})
    remap = {edge: i for i, edge in enumerate(used)}

    def line(edge: int) -> list[float]:
        pts = [coord[e["u"][edge]], *e["geom"][edge], coord[e["v"][edge]]]
        return [round(c, COORD_DP) for p in pts for c in p]

    stop_ids = sorted({s for p in network["patterns"] for s in p["stops"]})
    stop_remap = {s: i for i, s in enumerate(stop_ids)}
    lines = [line(edge) for edge in used]
    lats = [v for ln in lines for v in ln[0::2]]
    lons = [v for ln in lines for v in ln[1::2]]

    return {
        "format": "routeshield-site-network/1",
        "sources": {"network_sha256": network_sha, "graph_sha256": graph_sha},
        "attribution": ATTRIBUTION,
        "bounds": [min(lats), min(lons), max(lats), max(lons)],
        # Each edge is a flat [lat, lon, lat, lon, ...] line from its u end to its v end.
        "edges": lines,
        "routes": [{"code": r["public_code"], "name": r["name"]} for r in network["routes"]],
        "stops": [
            {
                "code": network["stops"][s]["code"],
                "name": network["stops"][s]["name"],
                "location": [round(c, COORD_DP) for c in network["stops"][s]["location"]],
            }
            for s in stop_ids
        ],
        "patterns": [
            {
                "id": p["id"],
                "route": p["route"],
                "direction": p["direction"],
                "trips": p["trips"],
                # Directed edges into "edges": 2i runs the line forwards, 2i + 1 backwards.
                "path": [2 * remap[de >> 1] + (de & 1) for de in p["path"]],
                "stops": [stop_remap[s] for s in p["stops"]],
                "matchedShare": p["quality"]["matched_share"],
            }
            for p in network["patterns"]
        ],
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args(argv)

    network_bytes, graph_bytes = NETWORK.read_bytes(), GRAPH.read_bytes()
    bundle = build(
        json.loads(network_bytes),
        json.loads(graph_bytes),
        hashlib.sha256(network_bytes).hexdigest(),
        hashlib.sha256(graph_bytes).hexdigest(),
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(bundle, separators=(",", ":")).encode("utf-8")
    args.out.write_bytes(data)
    counts = f"{len(bundle['edges'])} edges, {len(bundle['stops'])} stops, {len(bundle['patterns'])} patterns"
    print(f"{counts}, {len(data)} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
