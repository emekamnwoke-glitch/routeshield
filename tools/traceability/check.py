"""Check and render the RouteShield traceability model.

    python tools/traceability/check.py            # check only
    python tools/traceability/check.py --render   # check, then rewrite the matrix
    python tools/traceability/check.py --verify-rendered   # CI: fail if the matrix is stale
"""
from __future__ import annotations

import argparse
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODEL = ROOT / "architecture/models/traceability.toml"
MATRIX = ROOT / "docs/01-stage-one-architecture/phase-g-implementation-governance/traceability-matrix.md"
BR_DOC = ROOT / "docs/01-stage-one-architecture/phase-b-business-architecture/business-requirements.md"
CAP_DOC = ROOT / "docs/01-stage-one-architecture/phase-b-business-architecture/capability-map.md"
COMP_DOC = ROOT / "docs/01-stage-one-architecture/phase-c-information-systems/application-architecture/application-components.md"
PRINCIPLES_DOC = ROOT / "docs/01-stage-one-architecture/methodology/architecture-principles.md"
ADR_DIR = ROOT / "docs/05-architecture-decisions"

TEST_LEVELS = {"unit", "integration", "system", "acceptance", "security", "performance", "resilience", "inspection"}
TEST_STATUSES = {"planned", "implemented", "passing", "failing"}


def ids_in(path: Path, pattern: str) -> set[str]:
    return set(re.findall(pattern, path.read_text(encoding="utf-8")))


def check(m: dict) -> list[str]:
    errors: list[str] = []
    caps = m["capabilities"]
    tech = m["technical"]
    comps = m["components"]
    brs = m["business_requirements"]
    ars = m["architecture_requirements"]
    tests = m["tests"]
    stories = m.get("user_stories", {})

    doc_brs = ids_in(BR_DOC, r"\*\*(BR-\d{3})\*\*")
    doc_caps = ids_in(CAP_DOC, r"\*\*(C\d\.\d)\*\*")
    doc_comps = ids_in(COMP_DOC, r"\| \*\*(AC-\d{2})\*\* \|")
    principles = ids_in(PRINCIPLES_DOC, r"(?m)^## (P-\d+)")
    adrs = {f"ADR-{p.name[4:8]}" for p in ADR_DIR.glob("adr-[0-9][0-9][0-9][0-9]-*.md")}

    def diff(label, model_ids, doc_ids):
        for x in sorted(set(model_ids) - doc_ids):
            errors.append(f"{label}: {x} is in the model but not in the architecture documents")
        for x in sorted(doc_ids - set(model_ids)):
            errors.append(f"{label}: {x} is in the architecture documents but not in the model")

    diff("business requirement", brs, doc_brs)
    diff("capability", caps, doc_caps)
    diff("component", comps, doc_comps)

    # Components realise real capabilities; every capability is realised.
    realised: set[str] = set()
    for cid, c in comps.items():
        if not c["capabilities"]:
            errors.append(f"{cid} realises no capability")
        for cap in c["capabilities"]:
            if cap not in caps:
                errors.append(f"{cid} references unknown capability {cap}")
            realised.add(cap)
    for cap in sorted(set(caps) - realised):
        errors.append(f"{cap} is not realised by any component")

    # Business requirements trace up to capabilities.
    covered_caps: set[str] = set()
    for bid, b in brs.items():
        if b["priority"] not in {"MUST", "SHOULD", "COULD"}:
            errors.append(f"{bid} has invalid priority {b['priority']}")
        if not b["capabilities"]:
            errors.append(f"{bid} traces to no capability")
        for cap in b["capabilities"]:
            if cap not in caps:
                errors.append(f"{bid} references unknown capability {cap}")
            covered_caps.add(cap)
        for sid in b.get("stories", []):
            if sid not in stories:
                errors.append(f"{bid} references unknown user story {sid}")
    for cap in sorted(set(caps) - covered_caps):
        errors.append(f"{cap} has no business requirement")

    # Architecture requirements trace to sources and to components.
    br_to_ar: dict[str, list[str]] = {b: [] for b in brs}
    used_components: set[str] = set()
    for aid, a in ars.items():
        if not a["sources"]:
            errors.append(f"{aid} has no source")
        for src in a["sources"]:
            if src.startswith("BR-"):
                if src not in brs:
                    errors.append(f"{aid} references unknown {src}")
                else:
                    br_to_ar[src].append(aid)
            elif src.startswith("ADR-"):
                if src not in adrs:
                    errors.append(f"{aid} references missing {src}")
            elif src.startswith("P-"):
                if src not in principles:
                    errors.append(f"{aid} references unknown principle {src}")
            else:
                errors.append(f"{aid} has unrecognised source {src}")
        if not a["components"]:
            errors.append(f"{aid} is allocated to no component")
        for cid in a["components"]:
            if cid not in comps:
                errors.append(f"{aid} references unknown component {cid}")
            used_components.add(cid)
        if not a["technical"]:
            errors.append(f"{aid} is allocated to no technical component")
        for t in a["technical"]:
            if t not in tech:
                errors.append(f"{aid} references unknown technical component {t}")
    for bid, a in br_to_ar.items():
        if not a:
            errors.append(f"{bid} is not refined by any architecture requirement")
    for cid in sorted(set(comps) - used_components):
        errors.append(f"{cid} carries no architecture requirement")

    # Tests verify requirements; every requirement is verified.
    verified: set[str] = set()
    for tid, t in tests.items():
        if t["level"] not in TEST_LEVELS:
            errors.append(f"{tid} has invalid level {t['level']}")
        if t["status"] not in TEST_STATUSES:
            errors.append(f"{tid} has invalid status {t['status']}")
        if t["status"] in {"implemented", "passing", "failing"} and not t["implementation"]:
            errors.append(f"{tid} is {t['status']} but names no implementation")
        if t["status"] == "passing" and not t["evidence"]:
            errors.append(f"{tid} is passing but cites no evidence")
        if not t["verifies"]:
            errors.append(f"{tid} verifies nothing")
        for v in t["verifies"]:
            if v not in brs and v not in ars and v not in stories:
                errors.append(f"{tid} verifies unknown {v}")
            verified.add(v)
        impl = t["implementation"]
        if impl and not (ROOT / impl.split("::")[0]).exists():
            errors.append(f"{tid} implementation path does not exist: {impl}")
    for rid in sorted((set(brs) | set(ars)) - verified):
        errors.append(f"{rid} is not verified by any test")

    return errors


def render(m: dict) -> str:
    caps, comps, brs, ars, tests = (m["capabilities"], m["components"], m["business_requirements"],
                                    m["architecture_requirements"], m["tests"])
    br_ar = {b: [a for a, v in ars.items() if b in v["sources"]] for b in brs}
    by_target: dict[str, list[str]] = {}
    for tid, t in tests.items():
        for v in t["verifies"]:
            by_target.setdefault(v, []).append(tid)

    def status_of(ids):
        s = {tests[i]["status"] for i in ids}
        return "planned" if s == {"planned"} else ", ".join(sorted(s))

    counts = {}
    for t in tests.values():
        counts[t["status"]] = counts.get(t["status"], 0) + 1

    out = []
    w = out.append
    w("# Traceability Matrix")
    w("")
    w("> **Generated** from [`architecture/models/traceability.toml`](../../../architecture/models/traceability.toml) "
      "by `tools/traceability/check.py --render`. Do not edit by hand.")
    w("")
    w("## Summary")
    w("")
    w("| Item | Count |")
    w("|---|---|")
    w(f"| Capabilities | {len(caps)} |")
    w(f"| Components | {len(comps)} |")
    w(f"| Business requirements | {len(brs)} |")
    w(f"| Architecture requirements | {len(ars)} |")
    w(f"| User stories | {len(m.get('user_stories', {}))} |")
    w(f"| Test cases | {len(tests)} — " + ", ".join(f"{v} {k}" for k, v in sorted(counts.items())) + " |")
    w("")
    w("## Chain")
    w("")
    w("```mermaid")
    w("flowchart LR")
    w('    BR["Business requirement<br/>BR-nnn"] --> CAP["Capability<br/>Cn.n"]')
    w('    BR --> AR["Architecture requirement<br/>AR-nnn"]')
    w('    CAP --> AC["Application component<br/>AC-nn"]')
    w('    AR --> AC')
    w('    AR --> TECH["Technical component"]')
    w('    BR --> US["User story<br/>US-nnn"]')
    w('    US --> IMPL["Implementation"]')
    w('    AR --> TC["Test case<br/>TC-nnn"]')
    w('    BR --> TC')
    w('    TC --> IMPL')
    w('    TC --> EV["Evidence"]')
    w("```")
    w("")
    w("## Business requirements")
    w("")
    w("| BR | Pri | Capabilities | Architecture requirements | Components | User stories | Tests | Test status |")
    w("|---|---|---|---|---|---|---|---|")
    for bid, b in brs.items():
        comp_ids = sorted({c for a in br_ar[bid] for c in ars[a]["components"]})
        tids = sorted(by_target.get(bid, []) + [t for a in br_ar[bid] for t in by_target.get(a, [])])
        w(f"| **{bid}** {b['title']} | {b['priority']} | {', '.join(b['capabilities'])} | "
          f"{', '.join(br_ar[bid])} | {', '.join(comp_ids)} | {', '.join(b.get('stories', [])) or '—'} | "
          f"{', '.join(tids)} | {status_of(tids)} |")
    w("")
    w("## Architecture requirements")
    w("")
    w("| AR | Statement | Sources | Components | Technical | Tests |")
    w("|---|---|---|---|---|---|")
    for aid, a in ars.items():
        w(f"| **{aid}** | {a['statement']} | {', '.join(a['sources'])} | {', '.join(a['components'])} | "
          f"{', '.join(a['technical'])} | {', '.join(by_target.get(aid, []))} |")
    w("")
    w("## Capability realisation")
    w("")
    w("| Capability | Components | Business requirements |")
    w("|---|---|---|")
    for cap, name in caps.items():
        cs = [c for c, v in comps.items() if cap in v["capabilities"]]
        bs = [b for b, v in brs.items() if cap in v["capabilities"]]
        w(f"| **{cap}** {name} | {', '.join(cs)} | {', '.join(bs)} |")
    w("")
    w("## Test cases")
    w("")
    w("| Test | Verifies | Level | Status | Implementation | Evidence |")
    w("|---|---|---|---|---|---|")
    for tid, t in tests.items():
        w(f"| {tid} | {', '.join(t['verifies'])} | {t['level']} | {t['status']} | "
          f"{t['implementation'] or '—'} | {t['evidence'] or '—'} |")
    w("")
    return "\n".join(out)


def main() -> int:
    p = argparse.ArgumentParser()
    g = p.add_mutually_exclusive_group()
    g.add_argument("--render", action="store_true")
    g.add_argument("--verify-rendered", action="store_true")
    args = p.parse_args()

    model = tomllib.loads(MODEL.read_text(encoding="utf-8"))
    errors = check(model)
    if errors:
        print(f"Traceability check FAILED — {len(errors)} problem(s):")
        for e in errors:
            print(f"  - {e}")
        return 1

    rendered = render(model)
    if args.render:
        MATRIX.write_text(rendered, encoding="utf-8", newline="\n")
        print(f"Rendered {MATRIX.relative_to(ROOT)}")
    elif args.verify_rendered:
        current = MATRIX.read_text(encoding="utf-8") if MATRIX.exists() else ""
        if current != rendered:
            print("Traceability matrix is stale. Run: python tools/traceability/check.py --render")
            return 1
    print(f"Traceability check passed: {len(model['business_requirements'])} BR, "
          f"{len(model['architecture_requirements'])} AR, {len(model['tests'])} TC.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
