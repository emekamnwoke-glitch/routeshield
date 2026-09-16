"""Check that relative Markdown links and their #anchors resolve.

    python tools/docs/check_links.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LINK = re.compile(r"(?<!!)\[[^\]]*\]\(([^)\s]+)\)")
HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
FENCE = re.compile(r"^(```|~~~)")


def slug(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = text.replace("`", "").replace("*", "").strip().lower()
    text = re.sub(r"[^\w\- ]", "", text)
    return text.replace(" ", "-")


def anchors(path: Path) -> set[str]:
    seen: dict[str, int] = {}
    out: set[str] = set()
    in_fence = False
    for line in path.read_text(encoding="utf-8").splitlines():
        if FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = HEADING.match(line)
        if not m:
            continue
        s = slug(m.group(2))
        n = seen.get(s, 0)
        out.add(s if n == 0 else f"{s}-{n}")
        seen[s] = n + 1
    return out


def links(path: Path):
    in_fence = False
    for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if FENCE.match(line):
            in_fence = not in_fence
            continue
        if not in_fence:
            for m in LINK.finditer(line):
                yield i, m.group(1)


def main() -> int:
    cache: dict[Path, set[str]] = {}
    problems = []
    files = [p for p in ROOT.rglob("*.md") if ".git" not in p.parts and "node_modules" not in p.parts]
    for f in files:
        for line, target in links(f):
            if re.match(r"^[a-z]+:", target):
                continue
            path_part, _, frag = target.partition("#")
            dest = f if not path_part else (f.parent / path_part).resolve()
            if not dest.exists():
                problems.append(f"{f.relative_to(ROOT)}:{line}: missing {path_part}")
                continue
            if frag and dest.is_file() and dest.suffix == ".md":
                if dest not in cache:
                    cache[dest] = anchors(dest)
                if frag not in cache[dest]:
                    problems.append(f"{f.relative_to(ROOT)}:{line}: no anchor #{frag} in {dest.relative_to(ROOT)}")
    if problems:
        print(f"Link check FAILED — {len(problems)} problem(s):")
        for p in problems:
            print("  -", p)
        return 1
    print(f"Link check passed: {len(files)} Markdown files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
