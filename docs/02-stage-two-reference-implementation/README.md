# Stage Two — Fictional Reference Implementation

> ## ⚠️ This stage is fictional
>
> Every external system referenced here is **invented for this project**. Nothing in this stage describes the real architecture, APIs, data models, infrastructure or operational systems of Dublin Bus, the National Transport Authority, or any transport operator. The author has no access to those systems and makes no claim about them.

---

Stage Two answers a deliberately narrower question than Stage One: **if an operational environment of the right shape existed, how would you actually build this?**

## Why it is fictional

RouteShield is an integrating system — almost everything it does depends on something else. Those systems cannot be observed from outside, and no amount of research closes that gap; it is structural.

The alternative was to design against abstractions. That was rejected in [ADR-0002](../05-architecture-decisions/adr-0002-two-stage-architecture-implementation-split.md) because **abstraction hides assumptions rather than removing them**. An abstract interface still assumes request/response semantics, still assumes availability, still assumes a data model — it just does not write them down.

So the environment is invented, labelled, and every supposition it rests on is registered.

## Start here

| Document | |
|---|---|
| [The Fact / Assumption Model](fact-vs-assumption-model.md) | How every claim is classified, and the five ways this discipline quietly degrades |
| [Assumptions Register](assumptions.md) | What is being supposed, what it costs if wrong, and how a real implementation would check it |
| [Fictional Operating Model](fictional-operating-model.md) | The seven invented systems and what they stand in for |
| [Architecture at v1.2.0](solution-design/architecture-v1.2.0.md) | The reference implementation as built: containers, components, data, interfaces, deployment, and every departure from the Stage One target |

## Design artefacts

| Area | Status |
|---|---|
| [Requirements](requirements/) | ⬜ Not yet written |
| [Solution Design](solution-design/) | 🟢 [Architecture at v1.2.0](solution-design/architecture-v1.2.0.md) |
| [API Design](api/) | 🟡 Covered at v1.2.0 in [architecture §9](solution-design/architecture-v1.2.0.md#9-interfaces) |
| [Data Model](data-model/) | 🟡 Covered at v1.2.0 in [architecture §8](solution-design/architecture-v1.2.0.md#8-data) |
| [Security](security/) | 🟡 Outline in [architecture §11](solution-design/architecture-v1.2.0.md#11-security-as-far-as-a-browser-allows); full design not yet written |
| [Deployment](deployment/) | 🟡 Covered at v1.2.0 in [architecture §10](solution-design/architecture-v1.2.0.md#10-deployment-and-quality) |

## The register is the interesting output

Every entry records what breaks if the assumption is wrong, and how a real implementation would check it on day one. Taken together those fields form a **day-one discovery backlog** for anyone attempting this for real.

That is arguably more useful than the implementation itself. An implementation built on invented integrations demonstrates that the design is buildable. A well-maintained register demonstrates something rarer: knowing precisely which parts of your own design you cannot yet stand behind.

## The rule

**No unregistered assumption may be load-bearing.** If building something requires supposing that a fictional system behaves a certain way, the assumption is registered *before* the code that relies on it exists — not documented afterwards.

The ordering is the entire control. Retrospective registration produces a register that describes the code rather than constraining it.
