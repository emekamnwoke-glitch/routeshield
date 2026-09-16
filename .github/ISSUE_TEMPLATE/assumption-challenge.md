---
name: Assumption challenge
about: Record that a registered assumption looks wrong, or that a new one is needed
title: '[ASSUMPTION] '
labels: assumption
---

## Assumption

<!-- The identifier, e.g. A-007. Or "new" if this is a supposition currently unregistered. -->

## What prompted this

- [ ] Building against it showed it does not hold
- [ ] A public source contradicts it
- [ ] It turned out to be unnecessary — nothing actually depends on it
- [ ] It is load-bearing but was never registered
- [ ] Its stated impact grade looks wrong

## Detail

<!-- What is actually the case, and how is that known? -->

## What depends on it

<!-- Which components, designs or decisions rest on this assumption? -->

## Consequence if it is wrong

<!-- Against the register's grades: High (invalidates an architecture artefact), Medium (component rework), Low (parameter change). Does the registered grade still look right? -->

## Action

- [ ] Update the register entry
- [ ] Retire the assumption — nothing depends on it
- [ ] Promote to FACT, with the source cited
- [ ] Raise an architecture change (High impact → P-11 feedback loop)
