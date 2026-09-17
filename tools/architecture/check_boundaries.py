"""Check the core's component boundaries (ADR-0006, ADR-0010; TC-105).

    python tools/architecture/check_boundaries.py

Rules:
  1. A component imports other components only through their contract.ts.
  2. The kernel imports nothing outside the kernel.
  3. Core code never imports adapters or third-party packages.
  4. Every SQL statement in a component names only tables with its own prefix;
     the kernel's tables use kn_.
  5. Each component's folder, id and table prefix agree, and prefixes are unique.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KERNEL_PREFIX = "kn_"

IMPORT = re.compile(r"""^\s*(?:import|export)\b[^'"]*?\bfrom\s+['"]([^'"]+)['"]""", re.M)
LITERAL = re.compile(r"`([^`]*)`|\"((?:[^\"\\\n]|\\.)*)\"")
SQL_START = re.compile(r"^\s*(select|insert|update|delete|create|drop|with|alter)\b", re.I)
TABLE_REF = re.compile(
    r"\b(?:into|update|from|join|references|table(?:\s+if\s+(?:not\s+)?exists)?|on)\s+([A-Za-z_][\w$]*)", re.I
)
NOT_TABLES = {"set", "conflict", "if", "not", "exists", "select", "delete", "update", "insert", "sqlite_master"}
MODULE_DIR = re.compile(r"^ac-(\d{2})-[a-z0-9-]+$")
MODULE_ID = re.compile(r"readonly id = \"(AC-\d{2})\"")
MODULE_PREFIX = re.compile(r"readonly tablePrefix = \"([a-z]+_)\"")


def resolve(source: Path, spec: str) -> Path | None:
    """The .ts file a relative import points at, or None for a package import."""
    if not spec.startswith("."):
        return None
    target = (source.parent / spec).resolve()
    return target if target.suffix == ".ts" else target.with_suffix(".ts")


def sql_tables(text: str) -> set[str]:
    tables: set[str] = set()
    for m in LITERAL.finditer(text):
        literal = m.group(1) if m.group(1) is not None else m.group(2)
        if not SQL_START.match(literal):
            continue
        for t in TABLE_REF.findall(literal):
            if t.lower() not in NOT_TABLES and "$" not in t:
                tables.add(t)
    return tables


def check(root: Path = ROOT) -> list[str]:
    core = root / "src" / "core"
    kernel = core / "kernel"
    modules = core / "modules"
    adapters = root / "src" / "adapters"
    errors: list[str] = []

    def rel(p: Path) -> str:
        return p.relative_to(root).as_posix()

    prefixes: dict[str, str] = {}
    for d in sorted(p for p in modules.iterdir() if p.is_dir()) if modules.exists() else []:
        m = MODULE_DIR.match(d.name)
        module_ts = d / "module.ts"
        if not m:
            errors.append(f"{rel(d)}: folder name must look like ac-NN-name")
            continue
        if not (d / "contract.ts").exists() or not module_ts.exists():
            errors.append(f"{rel(d)}: a component needs contract.ts and module.ts")
            continue
        text = module_ts.read_text(encoding="utf-8")
        mid, mprefix = MODULE_ID.search(text), MODULE_PREFIX.search(text)
        if not mid or mid.group(1) != f"AC-{m.group(1)}":
            errors.append(f"{rel(module_ts)}: id does not match folder {d.name}")
        if not mprefix:
            errors.append(f"{rel(module_ts)}: declares no tablePrefix")
            continue
        if mprefix.group(1) in prefixes.values() or mprefix.group(1) == KERNEL_PREFIX:
            errors.append(f"{rel(module_ts)}: table prefix {mprefix.group(1)} is already taken")
        prefixes[d.name] = mprefix.group(1)

    for f in sorted(core.rglob("*.ts")):
        text = f.read_text(encoding="utf-8")
        in_kernel = kernel in f.parents
        module = f.relative_to(modules).parts[0] if modules in f.parents else None

        for spec in IMPORT.findall(text):
            target = resolve(f, spec)
            if target is None:
                errors.append(f"{rel(f)}: core code must not import the package {spec}")
                continue
            if adapters in target.parents:
                errors.append(f"{rel(f)}: core code must not import adapters ({spec})")
            elif in_kernel and kernel not in target.parents:
                errors.append(f"{rel(f)}: the kernel must not import {spec}")
            elif module and modules in target.parents:
                other = target.relative_to(modules).parts[0]
                if other != module and target.name != "contract.ts":
                    errors.append(f"{rel(f)}: reaches into {other} other than through its contract ({spec})")

        if in_kernel or module:
            own = KERNEL_PREFIX if in_kernel else prefixes.get(module or "")
            if own is None:
                continue
            for table in sorted(sql_tables(text)):
                if not table.startswith(own):
                    errors.append(f"{rel(f)}: uses table {table}, which is not prefixed {own}")
    return errors


def main() -> int:
    errors = check()
    for e in errors:
        print(e)
    if errors:
        print(f"\nBoundary check failed: {len(errors)} problem(s).")
        return 1
    print("Boundary check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
