"""Tests for pipeline/site_bundle.py and the committed site network."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))

import site_bundle  # noqa: E402

COMMITTED = ROOT / "data" / "fixtures" / "site" / "network.json"


def test_committed_bundle_is_current(tmp_path: Path) -> None:
    out = tmp_path / "network.json"
    assert site_bundle.main(["--out", str(out)]) == 0
    assert out.read_bytes() == COMMITTED.read_bytes(), "site bundle is stale: rerun pipeline/site_bundle.py"


def test_bundle_keeps_every_pattern_and_only_the_roads_they_use() -> None:
    site = json.loads(COMMITTED.read_bytes())
    network = json.loads((ROOT / "data" / "fixtures" / "network" / "network.json").read_bytes())
    assert len(site["patterns"]) == len(network["patterns"])
    used = {de >> 1 for p in site["patterns"] for de in p["path"]}
    assert used == set(range(len(site["edges"])))
    for sp, np_ in zip(site["patterns"], network["patterns"], strict=True):
        assert len(sp["path"]) == len(np_["path"])
        assert [de & 1 for de in sp["path"]] == [de & 1 for de in np_["path"]]


def test_bundle_carries_both_attributions() -> None:
    site = json.loads(COMMITTED.read_bytes())
    assert any("National Transport Authority" in a for a in site["attribution"])
    assert any("OpenStreetMap" in a for a in site["attribution"])
