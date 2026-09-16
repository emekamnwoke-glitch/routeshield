"""Trim the NTA Dublin Bus GTFS feed to a small, committed test sample.

    python pipeline/gtfs_sample.py                 # download, then trim
    python pipeline/gtfs_sample.py --zip FEED.zip  # trim a feed already on disk

The full feed is downloaded to data/raw/ (git-ignored). Only the trimmed files
and a manifest recording source, licence, fetch date and checksums are written
to data/fixtures/gtfs-sample/ (ADR-0011). Rows are filtered, never edited.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://www.transportforireland.ie/transitData/Data/GTFS_Dublin_Bus.zip"
RAW_ZIP = ROOT / "data" / "raw" / "GTFS_Dublin_Bus.zip"
OUT_DIR = ROOT / "data" / "fixtures" / "gtfs-sample"

# E2 is the anchor: the one route joining Dublin 11 (Harristown) to UCD Belfield.
# The rest share its corridor, serve UCD, or serve Dublin 11 locally.
DEFAULT_ROUTES = ("E2", "E1", "39A", "142", "41X", "F1", "F2", "N4", "40D", "23", "24")
# Monday-Thursday timetable, 21 Sep - 17 Dec 2026 in the 2026-09-15 feed.
DEFAULT_SERVICE = "284"

LICENCE = {
    "name": "CC BY 4.0",
    "url": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "Contains National Transport Authority data (NTA GTFS), licensed under CC BY 4.0.",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as resp, dest.open("wb") as out:
        while chunk := resp.read(1 << 20):
            out.write(chunk)


def read(feed: zipfile.ZipFile, name: str) -> tuple[list[str], list[dict[str, str]]]:
    with feed.open(name) as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
        return list(reader.fieldnames or []), list(reader)


def filter_rows(feed: zipfile.ZipFile, name: str, keep) -> tuple[list[str], list[dict[str, str]]]:
    """Filter row by row, so large files are never held in memory whole."""
    with feed.open(name) as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
        rows = [r for r in reader if keep(r)]
        return list(reader.fieldnames or []), rows


def to_csv(fields: list[str], rows: list[dict[str, str]]) -> bytes:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


def trim(feed: zipfile.ZipFile, routes: set[str], service: str) -> dict[str, tuple[list[str], list[dict[str, str]]]]:
    out = {}
    out["agency.txt"] = read(feed, "agency.txt")
    out["feed_info.txt"] = read(feed, "feed_info.txt")
    out["routes.txt"] = filter_rows(feed, "routes.txt", lambda r: r["route_short_name"] in routes)
    found = {r["route_short_name"] for r in out["routes.txt"][1]}
    if missing := routes - found:
        raise SystemExit(f"routes not in feed: {', '.join(sorted(missing))}")
    route_ids = {r["route_id"] for r in out["routes.txt"][1]}

    out["trips.txt"] = filter_rows(
        feed, "trips.txt", lambda r: r["route_id"] in route_ids and r["service_id"] == service
    )
    if not out["trips.txt"][1]:
        raise SystemExit(f"no trips for service {service} on the selected routes")
    trip_ids = {r["trip_id"] for r in out["trips.txt"][1]}
    shape_ids = {r["shape_id"] for r in out["trips.txt"][1] if r.get("shape_id")}

    out["calendar.txt"] = filter_rows(feed, "calendar.txt", lambda r: r["service_id"] == service)
    if "calendar_dates.txt" in feed.namelist():
        out["calendar_dates.txt"] = filter_rows(feed, "calendar_dates.txt", lambda r: r["service_id"] == service)
    out["stop_times.txt"] = filter_rows(feed, "stop_times.txt", lambda r: r["trip_id"] in trip_ids)
    stop_ids = {r["stop_id"] for r in out["stop_times.txt"][1]}
    out["stops.txt"] = filter_rows(feed, "stops.txt", lambda r: r["stop_id"] in stop_ids)
    if "shapes.txt" in feed.namelist():
        out["shapes.txt"] = filter_rows(feed, "shapes.txt", lambda r: r["shape_id"] in shape_ids)
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--zip", type=Path, help="use this feed instead of downloading")
    ap.add_argument("--routes", default=",".join(DEFAULT_ROUTES), help="comma-separated route short names")
    ap.add_argument("--service", default=DEFAULT_SERVICE, help="service_id to keep")
    ap.add_argument("--out", type=Path, default=OUT_DIR)
    args = ap.parse_args(argv)

    if args.zip:
        src, url = args.zip, None
    else:
        print(f"downloading {SOURCE_URL}")
        download(SOURCE_URL, RAW_ZIP)
        src, url = RAW_ZIP, SOURCE_URL

    routes = {r.strip() for r in args.routes.split(",") if r.strip()}
    with zipfile.ZipFile(src) as feed:
        tables = trim(feed, routes, args.service)

    args.out.mkdir(parents=True, exist_ok=True)
    files = {}
    for name, (fields, rows) in sorted(tables.items()):
        data = to_csv(fields, rows)
        (args.out / name).write_bytes(data)
        files[name] = {"rows": len(rows), "bytes": len(data), "sha256": sha256(data)}

    feed_info = tables["feed_info.txt"][1][0]
    manifest = {
        "source": {
            "publisher": feed_info.get("feed_publisher_name"),
            "url": url or SOURCE_URL,
            "file": src.name,
            "sha256": sha256(src.read_bytes()),
            "feed_version": feed_info.get("feed_version"),
            "feed_start_date": feed_info.get("feed_start_date"),
            "feed_end_date": feed_info.get("feed_end_date"),
        },
        "licence": LICENCE,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "filter": {"routes": sorted(routes), "service_id": args.service},
        "files": files,
    }
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    for name, meta in files.items():
        print(f"{name:20} {meta['rows']:>8} rows {meta['bytes']:>10} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
