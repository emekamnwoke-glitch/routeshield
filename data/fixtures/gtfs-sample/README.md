# data/fixtures/gtfs-sample

A small slice of the real Dublin Bus network, cut from the National Transport Authority GTFS feed. It gives tests and the early demonstrator real stops, routes and shapes without committing the full 37.5 MB feed.

**This is FACT-class data** ([fact vs assumption](../../../docs/02-stage-two-reference-implementation/fact-vs-assumption-model.md)): real published timetables, not operational data. Nothing here says anything about how Dublin Bus runs its systems.

## What is in it

| | |
|---|---|
| Source | NTA `GTFS_Dublin_Bus.zip`, feed published 15 Sep 2026 (version and checksum in [`manifest.json`](manifest.json)) |
| Service | `service_id` 284: Monday to Thursday, 21 Sep to 17 Dec 2026 (not running on 26 Oct 2026) |
| Size | 11 routes, 1,618 trips, 948 stops, about 8.9 MB |

Rows are filtered, never edited. `translations.txt` is left out.

## Why these routes

The sample is anchored on a journey from **Dublin 11 to University College Dublin**. No Dublin Bus route calls at both a Finglas stop and UCD. **E2** is the one route that runs from Dublin 11 (Harristown) to UCD Belfield, so it is the anchor. The other ten give a disruption something to collide with.

| Route | Runs | Why it is here |
|---|---|---|
| **E2** | Dun Laoghaire – Harristown | Anchor: Dublin 11 to UCD Belfield |
| E1 | Ballywaltrim – Northwood | Shares E2's north–south corridor and serves UCD |
| 39A | Ongar – UCD Belfield | Serves UCD from the west |
| 142 | Portmarnock – UCD (Belfield) | Serves UCD from the north-east |
| 41X | Swords – UCD Belfield | Express to UCD; a different stopping pattern on the same corridor |
| F1 | The Square Tallaght – IKEA | Dublin 11 local, through Finglas |
| F2 | Charlestown SC – Rossmore | Dublin 11 local |
| N4 | Blanchardstown – Point Village | Orbital crossing Finglas |
| 40D | Tyrrelstown – Parnell Street | Finglas radial into the city centre |
| 23 | Merrion Square – Charlestown SC | Finglas radial, ends in the south city centre |
| 24 | Merrion Square – Dublin Airport | Northside radial next to Dublin 11 |

The start point is the Dublin 11 area rather than a specific address, so no personal location is recorded in this repository.

## Regenerating

```bash
python pipeline/gtfs_sample.py
```

The script downloads the current feed to `data/raw/` (git-ignored), trims it, and rewrites this folder and its manifest. A newer feed may renumber `service_id`; pass `--service` to choose the matching Monday–Thursday calendar.

## Licence

Contains National Transport Authority data, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The repository's MIT licence covers code only, not this data.
