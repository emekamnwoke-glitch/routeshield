"""Tests for pipeline/gtfs_sample.py and the committed GTFS sample."""
from __future__ import annotations

import csv
import hashlib
import json
import sys
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))

import gtfs_sample  # noqa: E402

SAMPLE = ROOT / "data" / "fixtures" / "gtfs-sample"

FEED = {
    "agency.txt": "agency_id,agency_name\n1,Test Bus\n",
    "feed_info.txt": "feed_publisher_name,feed_version,feed_start_date,feed_end_date\nNTA,v1,20260101,20261231\n",
    "routes.txt": "route_id,route_short_name\nr1,E2\nr2,99\n",
    "calendar.txt": "service_id,monday\nwk,1\nsat,0\n",
    "calendar_dates.txt": "service_id,date,exception_type\nwk,20261026,2\nsat,20261026,1\n",
    "trips.txt": "route_id,service_id,trip_id,shape_id\nr1,wk,t1,s1\nr1,sat,t2,s2\nr2,wk,t3,s3\n",
    "stop_times.txt": "trip_id,stop_id,stop_sequence\nt1,A,1\nt1,B,2\nt2,C,1\nt3,D,1\n",
    "stops.txt": "stop_id,stop_name\nA,Harristown\nB,UCD\nC,Other\nD,Elsewhere\n",
    "shapes.txt": "shape_id,shape_pt_sequence\ns1,1\ns2,1\ns3,1\n",
}


@pytest.fixture
def feed(tmp_path: Path) -> Path:
    path = tmp_path / "feed.zip"
    with zipfile.ZipFile(path, "w") as z:
        for name, body in FEED.items():
            z.writestr(name, body)
    return path


def rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_keeps_only_selected_routes_service_and_references(feed: Path, tmp_path: Path) -> None:
    out = tmp_path / "out"
    assert gtfs_sample.main(["--zip", str(feed), "--routes", "E2", "--service", "wk", "--out", str(out)]) == 0

    assert [r["route_id"] for r in rows(out / "routes.txt")] == ["r1"]
    assert [r["trip_id"] for r in rows(out / "trips.txt")] == ["t1"]
    assert [r["stop_id"] for r in rows(out / "stop_times.txt")] == ["A", "B"]
    assert [r["stop_id"] for r in rows(out / "stops.txt")] == ["A", "B"]
    assert [r["shape_id"] for r in rows(out / "shapes.txt")] == ["s1"]
    assert [r["service_id"] for r in rows(out / "calendar.txt")] == ["wk"]
    assert [r["service_id"] for r in rows(out / "calendar_dates.txt")] == ["wk"]


def test_manifest_records_source_licence_and_checksums(feed: Path, tmp_path: Path) -> None:
    out = tmp_path / "out"
    gtfs_sample.main(["--zip", str(feed), "--routes", "E2", "--service", "wk", "--out", str(out)])
    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))

    assert manifest["source"]["sha256"] == hashlib.sha256(feed.read_bytes()).hexdigest()
    assert manifest["source"]["feed_version"] == "v1"
    assert manifest["licence"]["name"] == "CC BY 4.0"
    for name, meta in manifest["files"].items():
        assert meta["sha256"] == hashlib.sha256((out / name).read_bytes()).hexdigest()


def test_unknown_route_fails(feed: Path, tmp_path: Path) -> None:
    with pytest.raises(SystemExit, match="routes not in feed: X9"):
        gtfs_sample.main(["--zip", str(feed), "--routes", "E2,X9", "--service", "wk", "--out", str(tmp_path)])


def test_service_with_no_trips_fails(feed: Path, tmp_path: Path) -> None:
    with pytest.raises(SystemExit, match="no trips"):
        gtfs_sample.main(["--zip", str(feed), "--routes", "99", "--service", "sat", "--out", str(tmp_path)])


def test_committed_sample_matches_its_manifest() -> None:
    manifest = json.loads((SAMPLE / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["filter"]["routes"] == sorted(gtfs_sample.DEFAULT_ROUTES)
    for name, meta in manifest["files"].items():
        assert hashlib.sha256((SAMPLE / name).read_bytes()).hexdigest() == meta["sha256"], name


def test_committed_sample_is_referentially_complete() -> None:
    stops = {r["stop_id"] for r in rows(SAMPLE / "stops.txt")}
    trips = rows(SAMPLE / "trips.txt")
    shapes = {r["shape_id"] for r in rows(SAMPLE / "shapes.txt")}
    trip_ids = {t["trip_id"] for t in trips}

    assert {t["shape_id"] for t in trips} <= shapes
    for st in rows(SAMPLE / "stop_times.txt"):
        assert st["trip_id"] in trip_ids
        assert st["stop_id"] in stops


def test_anchor_route_serves_dublin_11_and_ucd() -> None:
    names = {r["stop_id"]: r["stop_name"] for r in rows(SAMPLE / "stops.txt")}
    e2 = {r["route_id"] for r in rows(SAMPLE / "routes.txt") if r["route_short_name"] == "E2"}
    e2_trips = {t["trip_id"] for t in rows(SAMPLE / "trips.txt") if t["route_id"] in e2}
    served = {names[st["stop_id"]] for st in rows(SAMPLE / "stop_times.txt") if st["trip_id"] in e2_trips}

    assert "Belclare Park" in served  # Harristown, Dublin 11
    assert any(n.startswith("UCD") for n in served)
