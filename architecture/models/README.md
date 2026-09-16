# Models

Architecture content held as data, so it can be checked mechanically.

| File | Contents | Checked by |
|---|---|---|
| [`traceability.toml`](traceability.toml) | Capabilities, components, technical components, business and architecture requirements, user stories, test cases | [`tools/traceability/check.py`](../../tools/traceability/check.py) |

The TOML file is the source of truth for the [traceability matrix](../../docs/01-stage-one-architecture/phase-g-implementation-governance/traceability-matrix.md). Edit the model, then run:

```bash
python tools/traceability/check.py --render
```

CI fails if the model disagrees with the architecture documents or the rendered matrix is stale. No dependencies beyond Python 3.11+.
