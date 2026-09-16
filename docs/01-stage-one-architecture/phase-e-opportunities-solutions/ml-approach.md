# Machine Learning Approach

| | |
|---|---|
| **Phase** | E — Opportunities & Solutions |
| **Document version** | 1.0 |
| **Status** | Baseline |

---

## 1. What the baseline concept asks of ML

The proposal assigns ML three jobs: classify the disruption type, estimate its duration from historical patterns, and learn from every event so that contingency routes can be pre-built for recurring corridors.

## 2. The honest starting position

**There is no history.** No corpus of past disruptions, decisions and outcomes exists for this project, and an operator adopting the system would have little in structured form either — that is part of the problem the system solves ([problem statement §2.4](../phase-a-architecture-vision/problem-statement.md#24-the-reasoning-is-not-retained)).

Consequences:

- On day one, ML cannot outperform a controller's declared type and a rule-of-thumb duration.
- Every model in the reference implementation is trained on **synthetic** incidents produced by the project's own generator. It will learn the generator's rules, and its accuracy measures how well it recovers them — not how well it would predict real disruptions ([P-5](../../methodology/architecture-principles.md#p-5--distinguish-what-is-known-from-what-is-supposed)).
- The most valuable "learning" in the architecture is not a model. It is the **decision record** (C7.1) and the **governed contingency library** (C3.5, C7.4). Both work without ML.

ML is therefore placed in T4, after the system can already function and record.

## 3. Models

| Model | Job | Inputs | Output | Used by | Authority |
|---|---|---|---|---|---|
| **M-1 Type classifier** | Suggest disruption type | Source, report category, location class (bridge, riverside, centre, arterial), time, day, event calendar flag | Type + probability | AC-02 | **Suggestion** — a controller confirms type |
| **M-2 Duration estimator** | Estimate time to clearance | Type, location class, time, day, source authority | Median and interval | AC-02 → hold option costing | Estimate, shown with interval |
| **M-3 Corridor recurrence** | Propose contingency candidates | Audit history of disruptions by corridor and type | Ranked corridors | AC-12 → AC-10 | **Candidate only** — human approval required |

M-3 is deliberately simple — counting and clustering, not a learned model — because what matters is that it proposes rather than activates ([autonomy §6](../phase-b-business-architecture/autonomy-model.md#6-what-is-never-automatic)).

## 4. Guardrails

| Guardrail | Why |
|---|---|
| No model output changes service without human confirmation or prior approval | [P-1](../../methodology/architecture-principles.md#p-1--the-human-decides) |
| Low-confidence predictions are shown as "unknown", not as the top class | Avoid anchoring the controller |
| Duration is always an interval | A point estimate would be over-trusted |
| Model version recorded in every recommendation that used it | Reconstruction ([BR-038](../phase-b-business-architecture/business-requirements.md#accountability-and-learning)) |
| No driver-related features | [BR-042](../phase-b-business-architecture/business-requirements.md#accountability-and-learning) |
| Metrics reported as "on synthetic data" wherever shown | Avoid synthetic laundering ([fact/assumption model §5](../../../02-stage-two-reference-implementation/fact-vs-assumption-model.md#5-degradation-modes-to-watch-for)) |
| A rule-based baseline is always reported alongside | A model that does not beat the baseline is not deployed |

## 5. Technology

Training in Python with scikit-learn-compatible gradient-boosted or random-forest tree models; export to JSON; evaluation in TypeScript in the browser ([ADR-0016](../../../05-architecture-decisions/adr-0016-tree-models-exported-as-json.md)). Parity between Python and TypeScript predictions is tested in CI on a fixed fixture set.

## 6. What would make ML genuinely useful

For a real operator, after the decision record has accumulated a year or more of real disruptions:

- Duration estimation per corridor, calibrated against recorded clearance times.
- Refusal clustering to find junctions the feasibility model gets wrong ([BR-R2](../phase-b-business-architecture/as-is-to-be-process.md#6-risks-the-to-be-introduces)).
- Controller override patterns as a signal that the objective weights are wrong — aggregated, never per person.

None of these can be demonstrated honestly without real history. They are recorded as **FUTURE CONSIDERATIONS**.
