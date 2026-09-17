"""Tests for tools/architecture/check_boundaries.py (TC-105)."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "architecture"))

import check_boundaries  # noqa: E402

GOOD_MODULE = '''import type { Tx } from "../../kernel/store";
import type { Other } from "../ac-02-other/contract";

export class Thing {
  readonly id = "AC-01";
  readonly tablePrefix = "th_";
  migrate(tx: Tx): void {
    tx.run(`create table if not exists th_thing (id text primary key)`);
    tx.run("insert into th_thing (id) values (?) on conflict (id) do update set id = excluded.id", []);
    throw new Error("cannot read from the source");
  }
}
'''

OTHER_MODULE = '''export class Other {
  readonly id = "AC-02";
  readonly tablePrefix = "ot_";
}
'''


def tree(tmp_path: Path, files: dict[str, str]) -> Path:
    base = {
        "src/core/kernel/store.ts": "export interface Tx {}\n",
        "src/core/modules/ac-01-thing/contract.ts": "export interface Thing {}\n",
        "src/core/modules/ac-01-thing/module.ts": GOOD_MODULE,
        "src/core/modules/ac-02-other/contract.ts": "export interface Other {}\n",
        "src/core/modules/ac-02-other/module.ts": OTHER_MODULE,
    }
    for path, text in {**base, **files}.items():
        p = tmp_path / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    return tmp_path


def test_the_repository_passes() -> None:
    assert check_boundaries.check() == []


def test_a_clean_tree_passes(tmp_path: Path) -> None:
    assert check_boundaries.check(tree(tmp_path, {})) == []


@pytest.mark.parametrize(
    ("files", "expected"),
    [
        (
            {"src/core/modules/ac-01-thing/extra.ts": 'import { Other } from "../ac-02-other/module";\n'},
            "reaches into ac-02-other other than through its contract",
        ),
        (
            {"src/core/kernel/bus.ts": 'import type { Thing } from "../modules/ac-01-thing/contract";\n'},
            "the kernel must not import",
        ),
        (
            {"src/core/modules/ac-01-thing/extra.ts": 'import { SqliteStore } from "../../../adapters/sqlite/sqlite-store";\n'},
            "must not import adapters",
        ),
        (
            {"src/core/modules/ac-01-thing/extra.ts": 'import sqlite from "@sqlite.org/sqlite-wasm";\n'},
            "must not import the package @sqlite.org/sqlite-wasm",
        ),
        (
            {"src/core/modules/ac-01-thing/extra.ts": 'const q = "select * from ot_other join th_thing on 1";\n'},
            "uses table ot_other, which is not prefixed th_",
        ),
        (
            {"src/core/modules/ac-01-thing/extra.ts": "const q = `update ot_other set x = 1`;\n"},
            "uses table ot_other",
        ),
        (
            {"src/core/kernel/outbox.ts": 'const q = "insert into outbox (id) values (?)";\n'},
            "uses table outbox, which is not prefixed kn_",
        ),
        (
            {"src/core/modules/ac-02-other/module.ts": OTHER_MODULE.replace('"ot_"', '"th_"')},
            "table prefix th_ is already taken",
        ),
        (
            {"src/core/modules/ac-02-other/module.ts": OTHER_MODULE.replace("AC-02", "AC-03")},
            "id does not match folder ac-02-other",
        ),
        (
            {"src/core/modules/misc/contract.ts": ""},
            "folder name must look like ac-NN-name",
        ),
    ],
)
def test_violations_are_reported(tmp_path: Path, files: dict[str, str], expected: str) -> None:
    errors = check_boundaries.check(tree(tmp_path, files))
    assert any(expected in e for e in errors), errors


def test_prose_in_strings_is_not_mistaken_for_sql() -> None:
    assert check_boundaries.sql_tables('throw new Error("event 3 does not chain from its predecessor");') == set()
