# data/fixtures/osm-graph

A drivable road graph for the Dublin area, built from OpenStreetMap. It is the network that detours are searched on ([ADR-0014](../../../docs/05-architecture-decisions/adr-0014-constrained-shortest-path-with-rejoin-enumeration.md)), and it covers every route in the [GTFS sample](../gtfs-sample/README.md).

**This is FACT-class data about the road network, with an ASSUMPTION attached.** The roads are real. Whether a twelve-metre bus can use a given road is not something OpenStreetMap reliably records ([A-008](../../../docs/02-stage-two-reference-implementation/assumptions.md#a-008)), so every edge carries feasibility `verified_open`, never `verified_operator` ([ADR-0011](../../../docs/05-architecture-decisions/adr-0011-open-network-data-via-build-time-pipeline.md)).

## What is in it

| | |
|---|---|
| Area | 53.18–53.48 N, 6.45–6.10 W (Bray to Swords, Ongar to the coast) |
| Roads | Motorway through residential, their link roads, busways, and the 231 service roads that OSM bus route relations use |
| OSM data as of | 16 Sep 2026, 15:14 UTC (exact value and checksums in [`manifest.json`](manifest.json)) |
| Size | 48,945 junctions, 56,129 edges, 37,187 OSM ways, about 5.9 MB |

## How it is built

- Ways are split wherever they meet another way, so every edge runs junction to junction.
- Service roads are included only when an OSM bus route relation uses them: hospital, airport and campus roads, not car parks or driveways. Such a road is kept whatever its access tags say, because OSM itself records buses using it.
- Other roads that OSM closes (`access` or `motor_vehicle` = `no` or `private`) are dropped, unless they are reopened with `bus` or `psv` = `yes`, `designated` or `permissive`. `bus=no` or `psv=no` also drops a road.
- One-way rules come from `oneway`, roundabouts and motorways. A bus may use both directions where OSM says so: `oneway:bus=no`, `oneway:psv=no`, a `busway` of `opposite_lane`, a positive `lanes:bus:backward` or `lanes:psv:backward`, or `designated` in `bus:lanes:backward` or `psv:lanes:backward`.
- Only the largest connected network is kept. Fragments cut off by the edge of the box are dropped.
- Edge lengths are measured on the full OSM shape. The stored shape is simplified to within 2 m to keep the file small.
- Tags that bear on bus feasibility are kept: road class, name, `ref`, one-way rules, speed, height and weight limits, access, `bus`, `psv`, `busway` and lanes. Identical tag sets are stored once.

## Format

`road_graph.json` is columnar JSON (`routeshield-road-graph/1`):

| Field | Holds |
|---|---|
| `nodes.osm_id`, `nodes.coord` | OSM node id and `[lat, lon]` of each junction |
| `ways.osm_id`, `ways.tags` | OSM way id, and an index into `tag_sets` |
| `tag_sets` | Each distinct set of kept tags |
| `edges.u`, `edges.v` | Start and end, as indexes into `nodes` |
| `edges.way` | Index into `ways` |
| `edges.length_m` | Length in metres |
| `edges.dir` | `1` from `u` to `v` only, `-1` from `v` to `u` only, `0` both ways |
| `edges.geom` | Intermediate `[lat, lon]` points, excluding `u` and `v` |

## Known gap: service roads outside OSM's bus routes

Of the 948 stops in the GTFS sample, the median is 6 m from a graph edge and 95% are within 12 m. Adding the service roads from OSM's bus route relations brought the Connolly Hospital and Mill Road stops onto the graph.

Four stops remain 84–145 m out, all on route 40D in Blanchardstown Corporate Park: Cold Stores, Corporate Park 4B, and the Texaco Garage stop in each direction. The published 40D shape runs through the park's service roads, but OSM's 40D route relation does not include them, so they are not in the graph. OSM's bus route mapping is incomplete here, which is further evidence for [A-008](../../../docs/02-stage-two-reference-implementation/assumptions.md#a-008).

## Regenerating

```bash
python pipeline/osm_graph.py
```

The script queries the public Overpass API in 16 tiles, plus one query for the bus route service roads, retrying and moving between servers when they are busy. Responses are saved under `data/raw/` (git-ignored), so an interrupted run resumes where it stopped. To rebuild from a saved download without fetching again:

```bash
python pipeline/osm_graph.py --raw data/raw/osm_dublin_roads.json
```

## Licence

Contains data © OpenStreetMap contributors, available under the [Open Database Licence](https://opendatacommons.org/licenses/odbl/1-0/). This derived graph is made available under the same licence. The repository's MIT licence covers code only.
