# data/fixtures/site

What the demonstrator site draws, cut down by `pipeline/site_bundle.py` from the [network](../network/README.md) and the [road graph](../osm-graph/README.md).

| | |
|---|---|
| Contents | 11 routes, 948 stops, 33 patterns, and the 3,649 road edges those patterns run along |
| Size | about 300 KB, 75 KB compressed |
| Format | `routeshield-site-network/1`; the checksums of its two sources are in `sources` |

This is what the page draws. The full road graph (5.9 MB, 1.6 MB compressed) is loaded separately by the core worker, for impact assessment and detour search.

Each edge is a flat `[lat, lon, lat, lon, …]` line at five decimal places, about 1 m. A pattern's `path` lists directed edges: `2 × i` runs edge `i` forwards, `2 × i + 1` backwards.

```bash
python pipeline/site_bundle.py
```

A test fails if this file no longer matches what the script produces from the current network.

## Licence

Contains National Transport Authority data, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and data © OpenStreetMap contributors, available under the [Open Database Licence](https://opendatacommons.org/licenses/odbl/1-0/). The site shows both attributions.
