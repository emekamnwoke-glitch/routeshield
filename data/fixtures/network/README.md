# data/fixtures/network

The DD-1 Network domain for the sample: routes, stops and patterns, with every pattern laid onto the [road graph](../osm-graph/README.md). It is what impact assessment intersects with a disruption footprint ([ADR-0005](../../../docs/05-architecture-decisions/adr-0005-represent-disruptions-as-versioned-static-footprints.md)), and what detour search starts from ([ADR-0014](../../../docs/05-architecture-decisions/adr-0014-constrained-shortest-path-with-rejoin-enumeration.md)).

Built by `pipeline/network.py` from the [GTFS sample](../gtfs-sample/README.md) and the road graph. Entities follow the [logical data model](../../../docs/01-stage-one-architecture/phase-c-information-systems/data-architecture/logical-data-model.md#2-dd-1-network--sourced).

## What is in it

| | |
|---|---|
| Routes | 11 |
| Stops | 948 |
| Patterns | 33 |
| Trips | 1,618, each mapped to its pattern |
| Size | about 0.8 MB |

A **pattern** is one route, one direction and one exact stop sequence. Where trips with the same stops carry different GTFS shape ids, the shapes were checked and found identical, so each pattern has one path.

## How shapes are matched

Each pattern's GTFS shape is matched onto the road graph with a hidden Markov model map matcher (Newson and Krumm, 2009):

1. The shape is resampled every 25 m.
2. Each point takes as candidates the 12 nearest road edges within 60 m, in both directions. An edge the shape was already following stays a candidate out to 120 m, so a drawn shape that wanders off its road does not lose it.
3. A move between candidates is scored by how far the road distance differs from the shape distance, plus how far each point is from its road.
4. A point that cannot be reached plausibly is skipped. After 400 m of skipped shape, the matcher joins across the gap by the best-scoring route.
5. Stops are placed, in order, at their nearest position on the matched path.

**The published schedule outranks OSM one-way tags.** A pattern may run against a one-way restriction where its shape clearly does, at four times the cost per metre. Each pattern records those metres and the OSM ways involved in `quality.contraflow_m` and `quality.contraflow_osm_ways`. Detour search does not get this latitude: a detour must follow OSM's one-way rules ([A-008](../../../docs/02-stage-two-reference-implementation/assumptions.md#a-008)).

## Match quality

| | |
|---|---|
| Shape matched | at least 96.9% on every pattern; 100% on 25 of 33 |
| Path length against shape length | within 0.5 km on 32 patterns; `40D-1-10` is 1.1 km over |
| Gaps joined | none |
| Against a one-way tag | 62 m in total, on three short unnamed segments of 7–14 m |
| Furthest stop from its path | 145 m (Cold Stores, 40D) |

The four stops more than 40 m from their path are all on 40D in Blanchardstown Corporate Park, which the graph lacks (see the [road graph's known gap](../osm-graph/README.md#known-gap-service-roads-outside-osms-bus-routes)). The 1.1 km excess on `40D-1-10` has the same cause: without the park roads, the path doubles back along Cruiserath Road.

The fixture tests hold these figures, so a regression shows up as a failing test.

## Format

`network.json` (`routeshield-network/1`):

| Field | Holds |
|---|---|
| `graph_sha256` | Checksum of the road graph the paths refer to |
| `routes[]` | `gtfs_route_id`, `public_code`, `name` |
| `stops[]` | `gtfs_stop_id`, `code`, `name`, `location` as `[lat, lon]` |
| `patterns[].route`, `.direction` | Index into `routes`, and GTFS `direction_id` |
| `patterns[].stops` | Stop sequence, as indexes into `stops` |
| `patterns[].path` | Directed road edges: `2 × edge` runs the edge from `u` to `v`, `2 × edge + 1` from `v` to `u` |
| `patterns[].stop_positions` | Per stop: `[index into path, metres along that edge, metres from the stop]` |
| `patterns[].quality` | The match measures above |
| `trips` | `gtfs_trip_id[]` and the matching `pattern[]` index |
| `edge_index` | A 250 m grid of road edge indexes, keyed `"x,y"`, with the projection that defines `x` and `y` |

## Regenerating

```bash
python pipeline/network.py
```

It takes about 15 seconds and needs no network access. Rerun it whenever the GTFS sample or the road graph changes; a test fails if `graph_sha256` no longer matches.

## Licence

Contains National Transport Authority data, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and data © OpenStreetMap contributors, available under the [Open Database Licence](https://opendatacommons.org/licenses/odbl/1-0/). As a derived database of OpenStreetMap data, this file is made available under the ODbL. The repository's MIT licence covers code only.
