## What this changes

<!-- One or two sentences. What is different after this merges? -->

## Why

<!-- The requirement, ADR, assumption or learning that motivated it. Link it. -->

## Type

- [ ] Architecture artefact (Stage One)
- [ ] Reference implementation (Stage Two)
- [ ] Architecture decision (ADR)
- [ ] Documentation
- [ ] Tooling / CI

---

## Architecture compliance

Per [governance §4](../docs/01-stage-one-architecture/methodology/architecture-governance.md#4-architecture-compliance):

- [ ] Realises a requirement that exists in the traceability matrix
- [ ] Does not contradict an accepted ADR, or supersedes one
- [ ] Does not violate a principle, or the violation is recorded with justification
- [ ] Depends on no unregistered assumption
- [ ] Respects Phase C component boundaries, or changed them through the feedback loop first

**Compliance outcome:** Compliant / Compliant with dispensation / Non-compliant

<!-- If "with dispensation": which condition, why, and what triggers review. -->

## Classification

For changes touching Stage Two — per the [Fact / Assumption Model](../docs/02-stage-two-reference-implementation/fact-vs-assumption-model.md):

- [ ] Every new environmental claim is classified
- [ ] Every new assumption is registered with all seven fields, **before** the code depending on it
- [ ] No existing assumption has been silently promoted to fact
- [ ] Figures derived from synthetic data are labelled as such at the point of use
- [ ] Fictional systems are labelled as fictional at each point of use

## Traceability

- [ ] Traceability matrix updated **in this PR**, not a follow-up
- [ ] No orphaned requirements introduced in either direction

## If this change originated from implementation learning

Per [P-11](../docs/01-stage-one-architecture/methodology/architecture-principles.md#p-11--architecture-changes-before-implementation-does), the architecture changes first:

- [ ] Problem documented
- [ ] ADR raised
- [ ] Impact assessed across affected artefacts
- [ ] Architecture artefacts updated
- [ ] Requirements and traceability updated
- [ ] *Then* implemented

## Checks

- [ ] No secrets, credentials or real personal data
- [ ] Diagrams communicate a decision rather than decorate
- [ ] No AI or fabricated contributor attribution anywhere in the diff
