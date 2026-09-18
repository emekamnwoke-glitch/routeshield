# data/fixtures/scenario

Seeded scenario data for the demonstrator. **Everything here is SYNTHETIC** ([fact vs assumption](../../../docs/02-stage-two-reference-implementation/fact-vs-assumption-model.md)): invented operational data laid over the real network.

## fleet.json: a static fleet scene

A fictional vehicle for every trip in the [GTFS sample](../gtfs-sample/README.md) that is running on **Monday 21 September 2026 at 08:00**, the first Monday of the sample's Monday–Thursday service. Each vehicle sits where the published timetable puts its trip at that moment, interpolated between the two stops it is travelling between.

| | |
|---|---|
| Vehicles | 162 across the 11 routes |
| Identifiers | `RSV-001` onwards, invented; no real fleet number and nothing that identifies a driver (INV-12) |
| Position | Pattern, edge index along the pattern's path, offset in metres, and `[lat, lon]` |

The scene stands in for the fictional Reference Vehicle GPS Platform. Real vehicles run early and late; these run exactly to time, which is the scheduled network, not the operated one ([A-009](../../../docs/02-stage-two-reference-implementation/assumptions.md#a-009)). The moving fleet simulator replaces this in v1.4.0.

A few express vehicles (41X, 142) are 5–10 km from their next stop: they are on non-stop motorway runs of 12–16 km into the city.

```bash
python pipeline/fleet_scene.py
```

A test fails if this file no longer matches what the script produces.
